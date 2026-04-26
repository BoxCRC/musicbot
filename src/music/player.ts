import Kasumi, { Card, MessageType } from "kasumi.js";


import Koice from "koice";
import type { AppConfig } from "../config/env";
import { messages } from "../shared/messages";
import { buildPlayerPanelCard, buildPlaybackEndedCard, buildStatusCard, buildPlaylistLoadedCard, buildTopListCard, buildSimiSongsCard, buildArtistTopSongsCard } from "../shared/cards";
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
        // playNext 已发送播放器面板卡片，无需重复发送
        return "";
      }

      // 更新播放器面板卡片（如果存在）
      await this.updatePlayerPanel(guildId);
      return "";
    } catch (error) {
      this.logger.warn("点歌失败", error);
      return messages.searchFailed(trimmedKeyword);
    }
  }

  async playPlaylist(
    guildId: string,
    textChannelId: string,
    requesterId: string,
    requesterName: string,
    input: string,
  ): Promise<string | Card> {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return messages.playlistUsage(this.config.commandPrefix);
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
      // 尝试从输入中提取歌单 ID
      let playlistId = this.neteaseService.extractPlaylistId(trimmedInput);

      if (!playlistId) {
        // 不是 ID/链接，按关键词搜索歌单
        this.logger.info(`按关键词搜索歌单：${trimmedInput}`);
        const playlists = await this.neteaseService.searchPlaylists(trimmedInput);
        if (playlists.length === 0) {
          return messages.playlistSearchFailed(trimmedInput);
        }
        playlistId = playlists[0].id;
      }

      // 发送加载提示
      if (session.textChannelId) {
        await this.sendMessage(session.textChannelId, messages.playlistLoading(String(playlistId)));
      }

      // 获取歌单详情和全部曲目
      const { name: playlistName, tracks } = await this.neteaseService.getPlaylistDetail(playlistId);

      if (tracks.length === 0) {
        return messages.playlistEmpty;
      }

      // 更新加载提示为歌单名
      if (session.textChannelId) {
        await this.sendMessage(session.textChannelId, messages.playlistLoading(playlistName));
      }

      // 批量解析可播放 URL
      const playableTracks = await this.neteaseService.resolvePlaylistTracks(tracks, requesterName);

      if (playableTracks.length === 0) {
        return messages.playlistNoPlayable;
      }

      // 批量入队
      const wasEmpty = !session.currentTrack && !session.source;
      for (const track of playableTracks) {
        this.queueManager.enqueue(session, track);
      }

      const skipped = tracks.length - playableTracks.length;
      this.logger.info(`歌单「${playlistName}」加载完成：${playableTracks.length}/${tracks.length} 首可播放`);

      // 如果队列之前为空，立即开始播放
      if (wasEmpty) {
        await this.playNext(guildId, false);
      }

      return buildPlaylistLoadedCard(playlistName, tracks.length, playableTracks.length, skipped);
    } catch (error) {
      this.logger.warn("歌单加载失败", error);
      if (error instanceof Error && error.message === "PLAYLIST_NOT_FOUND") {
        return messages.playlistLoadFailed;
      }
      return messages.playlistLoadFailed;
    }
  }

  async playTopList(
    guildId: string,
    textChannelId: string,
    requesterId: string,
    requesterName: string,
    chartName: string,
  ): Promise<string | Card> {
    if (!chartName.trim()) {
      return messages.topListUsage(this.config.commandPrefix);
    }

    const chartId = this.neteaseService.resolveChartId(chartName);
    if (!chartId) {
      return messages.topListNotFound(chartName);
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
      const { name, tracks } = await this.neteaseService.getTopList(chartId);
      if (tracks.length === 0) {
        return messages.playlistEmpty;
      }

      // 限制最多取前 10 首
      const topTracks = tracks.slice(0, 10);
      const playableTracks = await this.neteaseService.resolvePlaylistTracks(topTracks, requesterName);

      if (playableTracks.length === 0) {
        return messages.playlistNoPlayable;
      }

      const wasEmpty = !session.currentTrack && !session.source;
      for (const track of playableTracks) {
        this.queueManager.enqueue(session, track);
      }

      const skipped = topTracks.length - playableTracks.length;
      if (wasEmpty) {
        await this.playNext(guildId, false);
      }

      return buildTopListCard(name, topTracks.length, playableTracks.length, skipped);
    } catch (error) {
      this.logger.warn("榜单加载失败", error);
      return messages.topListNotFound(chartName);
    }
  }

  async playSimiSongs(
    guildId: string,
    textChannelId: string,
    requesterId: string,
    requesterName: string,
  ): Promise<string | Card> {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack) {
      return messages.simiNoPlaying;
    }

    const currentTrackId = Number(session.currentTrack.id);
    if (isNaN(currentTrackId)) {
      return messages.simiNotFound;
    }

    try {
      const songs = await this.neteaseService.getSimiSongs(currentTrackId, 10);
      if (songs.length === 0) {
        return messages.simiNotFound;
      }

      const playableTracks = await this.neteaseService.resolvePlaylistTracks(songs, requesterName);
      if (playableTracks.length === 0) {
        return messages.simiNotFound;
      }

      for (const track of playableTracks) {
        this.queueManager.enqueue(session, track);
      }

      return buildSimiSongsCard(session.currentTrack, playableTracks.length);
    } catch (error) {
      this.logger.warn("获取相似歌曲失败", error);
      return messages.simiNotFound;
    }
  }

  async playArtistTopSongs(
    guildId: string,
    textChannelId: string,
    requesterId: string,
    requesterName: string,
    keyword: string,
  ): Promise<string | Card> {
    if (!keyword.trim()) {
      return messages.artistUsage(this.config.commandPrefix);
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
      const { artistName, tracks } = await this.neteaseService.searchArtistTopSongs(keyword);
      if (tracks.length === 0) {
        return messages.artistNotFound(keyword);
      }

      // 限制最多取前 10 首
      const topTracks = tracks.slice(0, 10);
      const playableTracks = await this.neteaseService.resolvePlaylistTracks(topTracks, requesterName);

      if (playableTracks.length === 0) {
        return messages.playlistNoPlayable;
      }

      const wasEmpty = !session.currentTrack && !session.source;
      for (const track of playableTracks) {
        this.queueManager.enqueue(session, track);
      }

      if (wasEmpty) {
        await this.playNext(guildId, false);
      }

      return buildArtistTopSongsCard(artistName, topTracks.length, playableTracks.length);
    } catch (error) {
      this.logger.warn("歌手热门歌曲加载失败", error);
      if (error instanceof Error && error.message === "ARTIST_NOT_FOUND") {
        return messages.artistNotFound(keyword);
      }
      return messages.artistNotFound(keyword);
    }
  }

  async pause(guildId: string): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session?.source || !session.currentTrack) {
      return;
    }

    if (session.state === "paused") {
      return;
    }

    session.source.pause();
    this.sessionManager.setState(guildId, "paused");
    await this.updatePlayerPanel(guildId);
  }

  async resume(guildId: string): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session?.source || !session.currentTrack) {
      return;
    }

    if (session.state !== "paused") {
      return;
    }

    session.source.resume();
    this.sessionManager.setState(guildId, "playing");
    await this.updatePlayerPanel(guildId);
  }

  async seek(guildId: string, offsetMs: number): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session?.source || !session.currentTrack) {
      return;
    }

    // 校验偏移范围
    const durationMs = session.currentTrack.durationMs;
    if (offsetMs < 0) {
      offsetMs = 0;
    }
    if (durationMs && offsetMs >= durationMs) {
      // 超出歌曲时长，直接切歌
      await session.source.stop("skip");
      return;
    }

    await session.source.seek(offsetMs);

    // 重置播放起始时间，保持进度和歌词同步
    session.playbackStartedAt = Date.now() - offsetMs;
    session.lastLyricIdx = undefined;

    // 确保状态为播放中
    if (session.state !== "playing") {
      this.sessionManager.setState(guildId, "playing");
    }

    await this.updatePlayerPanel(guildId);
  }

  async skip(guildId: string, position?: number): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack || !session.source) {
      return;
    }

    if (position !== undefined && position > 1) {
      if (position > session.queue.length) {
        return;
      }
      this.queueManager.removeBefore(session, position);
    }

    await session.source.stop("skip");
  }

  async stop(guildId: string): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session || (!session.currentTrack && session.queue.length === 0 && !session.connection)) {
      return;
    }

    this.queueManager.clear(session);

    if (session.source) {
      // 停止音频源会触发 handleSourceClosed，由它来更新卡片
      await session.source.stop("stop");
    } else {
      // 没有音频源时，直接更新卡片并关闭连接
      if (session.nowPlayingMsgId) {
        const card = buildPlaybackEndedCard();
        await this.updateMessage(session.nowPlayingMsgId, card);
      }
      await this.closeConnection(session, "stop command");
      session.currentTrack = undefined;
      session.nowPlayingMsgId = undefined;
      this.sessionManager.setState(guildId, "idle");
    }
  }

  getQueue(guildId: string): string | Card {
    const session = this.sessionManager.get(guildId);
    if (!session || (!session.currentTrack && session.queue.length === 0)) {
      return messages.queueEmpty;
    }

    // 返回播放器面板卡片，包含队列预览
    if (session.currentTrack) {
      return buildPlayerPanelCard({
        track: session.currentTrack,
        state: session.state,
        startedAt: session.playbackStartedAt,
        lyrics: session.currentLyrics,
        queue: this.queueManager.list(session),
      });
    }

    return messages.queueEmpty;
  }

  getNowPlaying(guildId: string): string | Card {
    const session = this.sessionManager.get(guildId);
    if (!session?.currentTrack) {
      return messages.nothingPlaying;
    }

    return buildPlayerPanelCard({
      track: session.currentTrack,
      state: session.state,
      startedAt: session.playbackStartedAt,
      lyrics: session.currentLyrics,
      queue: this.queueManager.list(session),
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

  private async playNext(guildId: string, announceInChannel: boolean, previousMsgId?: string): Promise<void> {
    const session = this.sessionManager.getOrCreate(guildId);
    if (session.source) {
      return;
    }

    const nextTrack = this.queueManager.dequeue(session);
    if (!nextTrack) {
      this.stopProgressUpdater(session);
      this.stopLyricsUpdater(session);

      // 更新卡片为"播放已结束"
      const msgId = previousMsgId || session.nowPlayingMsgId;
      if (msgId) {
        const card = buildPlaybackEndedCard();
        await this.updateMessage(msgId, card);
      }

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
      await this.playNext(guildId, announceInChannel, previousMsgId);
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
      // 歌词加载后立即更新播放器面板
      if (session.nowPlayingMsgId && session.currentTrack === nextTrack) {
        await this.updatePlayerPanel(guildId);
      }
    }).catch(() => {});

    // 音频首帧到达时才开始计时，避免 ffmpeg 启动延迟导致歌词超前
    source.once("firstData", async () => {
      session.playbackStartedAt = Date.now();
      this.logger.info(`正在播放：${nextTrack.title} - ${nextTrack.artistNames}`);
      this.startProgressUpdater(session, guildId);
      this.startLyricsUpdater(session, guildId);

      // 立即更新播放器面板，刷新进度和歌词
      if (session.nowPlayingMsgId && session.currentTrack === nextTrack) {
        await this.updatePlayerPanel(guildId);
      }
    });

    source.once("closed", async (payload) => {
      await this.handleSourceClosed(guildId, source, payload);
    });

    // 更新或发送卡片
    const card = buildPlayerPanelCard({
      track: nextTrack,
      state: "playing",
      queue: this.queueManager.list(session),
    });

    const msgIdToUse = previousMsgId || session.nowPlayingMsgId;
    if (msgIdToUse) {
      // 更新现有卡片
      await this.updateMessage(msgIdToUse, card);
      session.nowPlayingMsgId = msgIdToUse;
    } else if (session.textChannelId) {
      // 发送新卡片
      const msgId = await this.sendMessage(session.textChannelId, card);
      session.nowPlayingMsgId = msgId;
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
    const previousMsgId = session.nowPlayingMsgId;
    this.stopProgressUpdater(session);
    this.stopLyricsUpdater(session);
    session.source = undefined;
    session.currentTrack = undefined;
    session.playbackStartedAt = undefined;
    session.currentLyrics = undefined;
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
      // 更新卡片为"播放已结束"
      if (previousMsgId) {
        const card = buildPlaybackEndedCard();
        await this.updateMessage(previousMsgId, card);
      }
      session.nowPlayingMsgId = undefined;
      await this.closeConnection(session, "stop requested");
      return;
    }

    // 切歌或播放完毕，继续播放下一首
    await this.playNext(guildId, true, previousMsgId);
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

  private startProgressUpdater(session: GuildMusicSession, guildId: string): void {
    this.stopProgressUpdater(session);

    session.progressUpdateTimer = setInterval(async () => {
      if (!session.currentTrack || !session.nowPlayingMsgId || !session.playbackStartedAt) {
        this.stopProgressUpdater(session);
        return;
      }

      // 每秒更新卡片以刷新进度时间
      try {
        await this.updatePlayerPanel(guildId);
      } catch {
        this.stopProgressUpdater(session);
      }
    }, 1_000);
  }

  private stopProgressUpdater(session: GuildMusicSession): void {
    if (session.progressUpdateTimer) {
      clearInterval(session.progressUpdateTimer);
      session.progressUpdateTimer = undefined;
    }
  }

  private startLyricsUpdater(session: GuildMusicSession, guildId: string): void {
    this.stopLyricsUpdater(session);
    session.lastLyricIdx = undefined;

    session.lyricsUpdateTimer = setInterval(async () => {
      if (!session.currentTrack || !session.nowPlayingMsgId || !session.playbackStartedAt) {
        this.stopLyricsUpdater(session);
        return;
      }

      // 计算当前歌词行索引
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

        // 只在歌词行变化时更新
        if (currentIdx !== session.lastLyricIdx) {
          session.lastLyricIdx = currentIdx;
          lyricChanged = true;
        }
      }

      // 歌词变化时更新卡片
      if (lyricChanged) {
        try {
          await this.updatePlayerPanel(guildId);
        } catch {
          this.stopLyricsUpdater(session);
        }
      }
    }, 500);
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

  private async updatePlayerPanel(guildId: string): Promise<void> {
    const session = this.sessionManager.get(guildId);
    if (!session?.nowPlayingMsgId || !session.currentTrack) {
      return;
    }

    const card = buildPlayerPanelCard({
      track: session.currentTrack,
      state: session.state,
      startedAt: session.playbackStartedAt,
      lyrics: session.currentLyrics,
      queue: this.queueManager.list(session),
    });

    await this.updateMessage(session.nowPlayingMsgId, card);
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
