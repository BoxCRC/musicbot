import Kasumi, { MessageType } from "kasumi.js";


import Koice from "koice";
import type { AppConfig } from "../config/env";
import { messages } from "../shared/messages";
import type { AppLogger } from "../shared/logger";
import { createAudioSource, type ActiveAudioSource, type AudioSourceClosedEvent } from "../services/audio-source";
import { NeteaseService } from "../services/netease-service";
import { QueueManager } from "./queue-manager";
import { SessionManager } from "./session-manager";
import type { GuildMusicSession, PlaybackTrack, VoiceChannelRef } from "./types";

export class Player {
  constructor(
    private readonly client: Kasumi<Record<string, never>>,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly neteaseService: NeteaseService,
    private readonly queueManager: QueueManager,
    private readonly sessionManager: SessionManager,
  ) {}

  async play(
    guildId: string,
    textChannelId: string,
    requesterId: string,
    keyword: string,
  ): Promise<string> {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return messages.playUsage(this.config.commandPrefix);
    }

    const voiceChannel = await this.resolveUserVoiceChannel(guildId, requesterId);
    if (!voiceChannel) {
      return messages.userNotInVoiceChannel;
    }

    const session = this.sessionManager.setContext(guildId, {
      textChannelId,
      voiceChannelId: voiceChannel.id,
      voiceChannelName: voiceChannel.name,
    });

    if (
      session.connection &&
      session.voiceChannelId &&
      session.voiceChannelId !== voiceChannel.id
    ) {
      return messages.botBusyInAnotherVoiceChannel;
    }

    try {
      const track = await this.neteaseService.searchFirstPlayable(trimmedKeyword, requesterId);
      const position = this.queueManager.enqueue(session, track);

      if (!session.currentTrack && !session.source) {
        await this.playNext(guildId, false);
        return messages.queued(track, 1, true);
      }

      return messages.queued(track, position, false);
    } catch (error) {
      this.logger.warn("点歌失败", error);
      return messages.searchFailed(trimmedKeyword);
    }
  }

  async pause(guildId: string): Promise<string> {
    const session = this.sessionManager.get(guildId);
    if (!session?.source || !session.currentTrack) {
      return messages.pauseWhenIdle;
    }

    if (session.state === "paused") {
      return messages.alreadyPaused;
    }

    session.source.pause();
    this.sessionManager.setState(guildId, "paused");
    return messages.paused;
  }

  async resume(guildId: string): Promise<string> {
    const session = this.sessionManager.get(guildId);
    if (!session?.source || !session.currentTrack) {
      return messages.resumeWhenIdle;
    }

    if (session.state !== "paused") {
      return messages.notPaused;
    }

    session.source.resume();
    this.sessionManager.setState(guildId, "playing");
    return messages.resumed;
  }

  async skip(guildId: string): Promise<string> {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack || !session.source) {
      return messages.nothingPlaying;
    }

    await session.source.stop("skip");
    return messages.skipped;
  }

  async stop(guildId: string): Promise<string> {
    const session = this.sessionManager.get(guildId);
    if (!session || (!session.currentTrack && session.queue.length === 0 && !session.connection)) {
      return messages.nothingPlaying;
    }

    this.queueManager.clear(session);

    if (session.source) {
      await session.source.stop("stop");
    } else {
      await this.closeConnection(session, "stop command");
      session.currentTrack = undefined;
      this.sessionManager.setState(guildId, "idle");
    }

    return messages.stopped;
  }

  getQueueText(guildId: string): string {
    const session = this.sessionManager.get(guildId);
    if (!session || (!session.currentTrack && session.queue.length === 0)) {
      return messages.queueEmpty;
    }

    return messages.queueList(session.currentTrack, this.queueManager.list(session));
  }

  getNowPlayingText(guildId: string): string {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack) {
      return messages.nothingPlaying;
    }

    return messages.nowPlaying(session.currentTrack, this.stateLabel(session.state));
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessionManager.values()) {
      this.clearIdleTimer(session);
      this.stopVoiceKeepAlive(session);
      if (session.source) {
        await session.source.stop("stop");
      } else {
        await this.closeConnection(session, "shutdown");
      }
    }
  }

  private async playNext(guildId: string, announceInChannel: boolean): Promise<void> {
    const session = this.sessionManager.getOrCreate(guildId);
    if (session.source) {
      return;
    }

    const nextTrack = this.queueManager.dequeue(session);
    if (!nextTrack) {
      session.currentTrack = undefined;
      this.sessionManager.setState(guildId, "idle");
      this.scheduleIdleDisconnect(session);
      return;
    }

    this.clearIdleTimer(session);
    session.currentTrack = nextTrack;
    this.sessionManager.setState(guildId, "buffering");

    let connection: Koice;
    try {
      connection = await this.ensureConnection(session);
    } catch (error) {
      this.logger.error("语音连接失败", error);
      session.currentTrack = undefined;
      session.consecutiveErrors += 1;
      this.sessionManager.setState(guildId, "idle");
      if (session.consecutiveErrors >= 3) {
        session.consecutiveErrors = 0;
        this.queueManager.clear(session);
        if (session.textChannelId) {
          await this.sendTextMessage(session.textChannelId, messages.playbackAborted);
        }
        return;
      }
      if (session.textChannelId) {
        await this.sendTextMessage(
          session.textChannelId,
          messages.playbackError(nextTrack, "无法连接语音频道"),
        );
      }
      await this.playNext(guildId, announceInChannel);
      return;
    }

    session.consecutiveErrors = 0;

    const source = createAudioSource(
      nextTrack,
      this.config.ffmpegPath,
      this.logger,
      (chunk) => connection.push(chunk),
    );

    session.source = source;
    this.sessionManager.setState(guildId, "playing");
    source.once("closed", async (payload) => {
      await this.handleSourceClosed(guildId, source, payload);
    });

    if (announceInChannel && session.textChannelId) {
      await this.sendTextMessage(
        session.textChannelId,
        messages.nowPlaying(nextTrack, this.stateLabel("playing")),
      );
    }
  }

  private async handleSourceClosed(
    guildId: string,
    source: ActiveAudioSource,
    payload: AudioSourceClosedEvent,
  ): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session || session.source !== source) {
      return;
    }

    const finishedTrack = session.currentTrack;
    session.source = undefined;
    session.currentTrack = undefined;
    this.sessionManager.setState(guildId, "idle");

    if (payload.reason === "error") {
      this.logger.warn("歌曲播放失败", payload.error);

      // ffmpeg 找不到 → 致命错误，停止整个队列
      const isFfmpegMissing =
        payload.error &&
        "code" in payload.error &&
        (payload.error as NodeJS.ErrnoException).code === "ENOENT";

      if (isFfmpegMissing) {
        this.queueManager.clear(session);
        await this.closeConnection(session, "ffmpeg not found");
        if (session.textChannelId) {
          await this.sendTextMessage(session.textChannelId, messages.ffmpegNotFound);
        }
        return;
      }

      // 连续错误熔断：超过 3 首连续失败则停止
      session.consecutiveErrors += 1;
      if (session.consecutiveErrors >= 3) {
        session.consecutiveErrors = 0;
        this.queueManager.clear(session);
        await this.closeConnection(session, "too many consecutive errors");
        if (session.textChannelId) {
          await this.sendTextMessage(session.textChannelId, messages.playbackAborted);
        }
        return;
      }

      if (finishedTrack && session.textChannelId) {
        await this.sendTextMessage(
          session.textChannelId,
          messages.playbackError(finishedTrack, payload.error?.message ?? "未知错误"),
        );
      }
      await this.playNext(guildId, true);
      return;
    }

    // 正常播放完或 skip，重置连续错误计数
    session.consecutiveErrors = 0;

    if (payload.reason === "stop") {
      await this.closeConnection(session, "stop requested");
      return;
    }

    await this.playNext(guildId, true);
  }

  private async ensureConnection(session: GuildMusicSession): Promise<Koice> {
    if (session.connection && !session.connection.isClose) {
      return session.connection;
    }

    if (!session.voiceChannelId) {
      throw new Error("缺少语音频道上下文");
    }

    const connection = await Koice.create(
      this.client,
      session.voiceChannelId,
      {
        forceRealSpeed: true,
        rtcpMux: false,
        bitrateFactor: 2.0,
      },
      this.config.ffmpegPath,
    );

    if (!connection) {
      throw new Error("Koice 连接初始化失败");
    }

    session.connection = connection;
    connection.once("close", () => {
      if (session.connection === connection) {
        session.connection = undefined;
      }
    });
    this.startVoiceKeepAlive(session);

    return connection;
  }

  private async closeConnection(session: GuildMusicSession, reason: string): Promise<void> {
    this.clearIdleTimer(session);
    this.stopVoiceKeepAlive(session);

    if (!session.connection) {
      session.voiceChannelId = undefined;
      session.voiceChannelName = undefined;
      return;
    }

    const connection = session.connection;
    session.connection = undefined;
    session.voiceChannelId = undefined;
    session.voiceChannelName = undefined;

    try {
      await connection.close(reason);
    } catch (error) {
      this.logger.warn("关闭语音连接失败", error);
    }
  }

  private static readonly VOICE_KEEPALIVE_MS = 30_000;

  private startVoiceKeepAlive(session: GuildMusicSession): void {
    this.stopVoiceKeepAlive(session);

    if (!session.voiceChannelId) {
      return;
    }

    const channelId = session.voiceChannelId;

    session.voiceKeepAliveTimer = setInterval(async () => {
      if (!session.connection || session.connection.isClose) {
        this.stopVoiceKeepAlive(session);
        return;
      }

      try {
        await this.client.API.voice.keepAlive(channelId);
      } catch (error) {
        this.logger.debug("语音保活请求异常", error);
      }
    }, Player.VOICE_KEEPALIVE_MS);
  }

  private stopVoiceKeepAlive(session: GuildMusicSession): void {
    if (session.voiceKeepAliveTimer) {
      clearInterval(session.voiceKeepAliveTimer);
      session.voiceKeepAliveTimer = undefined;
    }
  }

  private scheduleIdleDisconnect(session: GuildMusicSession): void {
    this.clearIdleTimer(session);

    if (!session.connection || this.config.idleDisconnectSeconds <= 0) {
      return;
    }

    session.idleTimer = setTimeout(async () => {
      if (session.currentTrack || session.queue.length > 0 || session.source) {
        return;
      }

      await this.closeConnection(session, "idle timeout");
      if (session.textChannelId) {
        await this.sendTextMessage(session.textChannelId, messages.autoDisconnected);
      }
    }, this.config.idleDisconnectSeconds * 1000);
  }

  private clearIdleTimer(session: GuildMusicSession): void {
    if (!session.idleTimer) {
      return;
    }

    clearTimeout(session.idleTimer);
    session.idleTimer = undefined;
  }

  private async sendTextMessage(channelId: string, content: string): Promise<void> {
    const result = await this.client.API.message.create(
      MessageType.TextMessage,
      channelId,
      content,
    );

    if (result.err) {
      this.logger.warn("发送文字消息失败", result.err);
    }
  }

  private async resolveUserVoiceChannel(
    guildId: string,
    userId: string,
  ): Promise<VoiceChannelRef | undefined> {
    try {
      for await (const page of this.client.API.channel.user.joinedChannel(guildId, userId)) {
        if (page.err) {
          this.logger.warn("获取用户所在语音频道失败", page.err);
          return undefined;
        }

        const items = page.data.items;
        if (items.length > 0) {
          const ch = items[0];
          return { id: ch.id, name: ch.name };
        }
      }
    } catch (error) {
      this.logger.warn("查询用户语音频道异常", error);
    }

    return undefined;
  }

  private stateLabel(state: GuildMusicSession["state"]): string {
    switch (state) {
      case "playing":
        return "播放中";
      case "paused":
        return "已暂停";
      case "buffering":
        return "缓冲中";
      default:
        return "空闲";
    }
  }
}
