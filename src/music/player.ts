import Kasumi, { Card, MessageType } from "kasumi.js";


import Koice from "koice";
import type { AppConfig } from "../config/env";
import { messages } from "../shared/messages";
import { buildNowPlayingCard, buildQueuedCard, buildQueueListCard, buildStatusCard } from "../shared/cards";
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
    requesterName: string,
    keyword: string,
  ): Promise<string | Card> {
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
      const track = await this.neteaseService.searchFirstPlayable(trimmedKeyword, requesterName);
      const position = this.queueManager.enqueue(session, track);

      if (!session.currentTrack && !session.source) {
        await this.playNext(guildId, false);
        // playNext 已发送正在播放和队列卡片，无需重复发送
        return "";
      }

      return buildQueuedCard(track, position, false);
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

  getQueue(guildId: string): string | Card {
    const session = this.sessionManager.get(guildId);
    if (!session || (!session.currentTrack && session.queue.length === 0)) {
      return messages.queueEmpty;
    }

    return buildQueueListCard(session.currentTrack, this.queueManager.list(session));
  }

  getNowPlaying(guildId: string): string | Card {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack) {
      return messages.nothingPlaying;
    }

    return buildNowPlayingCard({
      track: session.currentTrack,
      stateLabel: this.stateLabel(session.state),
      startedAt: session.playbackStartedAt,
      lyrics: session.currentLyrics,
    });
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessionManager.values()) {
      this.clearIdleTimer(session);
      this.stopVoiceKeepAlive(session);
      this.stopLyricsUpdater(session);
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
      this.stopLyricsUpdater(session);
      session.currentTrack = undefined;
      session.playbackStartedAt = undefined;
      session.currentLyrics = undefined;
      session.nowPlayingMsgId = undefined;
      session.lastLyricIdx = undefined;
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
          await this.sendMessage(session.textChannelId, buildStatusCard(messages.playbackAborted, Card.Theme.DANGER));
        }
        return;
      }
      if (session.textChannelId) {
        await this.sendMessage(
          session.textChannelId,
          buildStatusCard(messages.playbackError(nextTrack, "无法连接语音频道"), Card.Theme.WARNING),
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
    session.playbackStartedAt = undefined;
    session.currentLyrics = undefined;
    this.sessionManager.setState(guildId, "playing");

    // 异步获取歌词，获取后更新卡片
    this.neteaseService.fetchLyrics(nextTrack.id).then(async (lyrics) => {
      session.currentLyrics = lyrics;
      // 歌词加载后立即更新正在播放卡片
      if (session.nowPlayingMsgId && session.currentTrack === nextTrack) {
        const card = buildNowPlayingCard({
          track: nextTrack,
          stateLabel: this.stateLabel(session.state),
          startedAt: session.playbackStartedAt,
          lyrics: session.currentLyrics,
        });
        await this.updateMessage(session.nowPlayingMsgId, card);
      }
    }).catch(() => {});

    // 音频首帧到达时才开始计时，避免 ffmpeg 启动延迟导致歌词超前
    source.once("firstData", async () => {
      session.playbackStartedAt = Date.now();
      this.startLyricsUpdater(session, guildId);

      // 立即更新卡片，刷新进度和歌词
      if (session.nowPlayingMsgId && session.currentTrack === nextTrack) {
        const card = buildNowPlayingCard({
          track: nextTrack,
          stateLabel: this.stateLabel(session.state),
          startedAt: session.playbackStartedAt,
          lyrics: session.currentLyrics,
        });
        await this.updateMessage(session.nowPlayingMsgId, card);
      }
    });

    source.once("closed", async (payload) => {
      await this.handleSourceClosed(guildId, source, payload);
    });

    if (session.textChannelId) {
      const card = buildNowPlayingCard({
        track: nextTrack,
        stateLabel: this.stateLabel("playing"),
      });
      const msgId = await this.sendMessage(session.textChannelId, card);
      session.nowPlayingMsgId = msgId;

      // 同时发送队列卡片
      const queueCard = buildQueueListCard(nextTrack, this.queueManager.list(session));
      await this.sendMessage(session.textChannelId, queueCard);
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
    this.stopLyricsUpdater(session);
    session.source = undefined;
    session.currentTrack = undefined;
    session.playbackStartedAt = undefined;
    session.currentLyrics = undefined;
    session.nowPlayingMsgId = undefined;
    session.lastLyricIdx = undefined;
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
          await this.sendMessage(session.textChannelId, buildStatusCard(messages.ffmpegNotFound, Card.Theme.DANGER));
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
          await this.sendMessage(session.textChannelId, buildStatusCard(messages.playbackAborted, Card.Theme.DANGER));
        }
        return;
      }

      if (finishedTrack && session.textChannelId) {
        await this.sendMessage(
          session.textChannelId,
          buildStatusCard(messages.playbackError(finishedTrack, payload.error?.message ?? "未知错误"), Card.Theme.WARNING),
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
        bitrateFactor: 1.0,
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

    // 包装 koice 的 retry 方法，记录断开原因
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const koiceAny = connection as any;
    const originalRetry = koiceAny.retry.bind(connection);
    koiceAny.retry = async (reason: unknown) => {
      this.logger.warn("语音连接断开，koice 正在重试", reason);
      return originalRetry(reason);
    };

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
        await this.sendMessage(session.textChannelId, buildStatusCard(messages.autoDisconnected, Card.Theme.INFO));
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

  private startLyricsUpdater(session: GuildMusicSession, guildId: string): void {
    this.stopLyricsUpdater(session);
    session.lastLyricIdx = undefined;

    session.lyricsUpdateTimer = setInterval(async () => {
      if (!session.currentTrack || !session.nowPlayingMsgId || !session.playbackStartedAt) {
        this.stopLyricsUpdater(session);
        return;
      }

      // 计算当前歌词行索引，判断是否需要更新
      let lyricChanged = false;
      if (session.currentLyrics && session.currentLyrics.lines.length > 0) {
        const elapsed = Date.now() - session.playbackStartedAt;
        let currentIdx = -1;
        for (let i = session.currentLyrics.lines.length - 1; i >= 0; i--) {
          if (session.currentLyrics.lines[i].timeMs <= elapsed) {
            currentIdx = i;
            break;
          }
        }
        lyricChanged = currentIdx !== session.lastLyricIdx;
        session.lastLyricIdx = currentIdx;
      }

      // 重建卡片并更新消息
      const card = buildNowPlayingCard({
        track: session.currentTrack,
        stateLabel: this.stateLabel(session.state),
        startedAt: session.playbackStartedAt,
        lyrics: session.currentLyrics,
      });

      try {
        await this.updateMessage(session.nowPlayingMsgId, card);
      } catch {
        // 消息更新失败，停止定时器
        this.stopLyricsUpdater(session);
      }
    }, 1_000);
  }

  private stopLyricsUpdater(session: GuildMusicSession): void {
    if (session.lyricsUpdateTimer) {
      clearInterval(session.lyricsUpdateTimer);
      session.lyricsUpdateTimer = undefined;
    }
  }

  private async sendMessage(channelId: string, content: string | Card): Promise<string | undefined> {
    const type = typeof content === "string" ? MessageType.TextMessage : MessageType.CardMessage;
    const result = await this.client.API.message.create(type, channelId, content);

    if (result.err) {
      this.logger.warn("发送消息失败", result.err);
      return undefined;
    }
    return result.data?.msg_id;
  }

  private async updateMessage(msgId: string, content: string | Card): Promise<void> {
    const result = await this.client.API.message.update(msgId, content);
    if (result.err) {
      this.logger.debug("更新消息失败", result.err);
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
