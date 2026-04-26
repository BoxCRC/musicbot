import * as NeteaseCloudMusicApi from "NeteaseCloudMusicApi";
import type { ParsedLyrics, PlaybackTrack } from "../music/types";
import type { AppLogger } from "../shared/logger";

interface NeteaseArtist {
  id?: number;
  name: string;
}

interface NeteaseSong {
  id: number;
  name: string;
  dt?: number;
  duration?: number;
  ar?: NeteaseArtist[];
  artists?: NeteaseArtist[];
}

interface SearchResponseBody {
  result?: {
    songs?: NeteaseSong[];
    playlists?: NeteasePlaylist[];
    artists?: NeteaseArtist[];
  };
}

interface ArtistTopSongResponseBody {
  artist?: { name: string };
  songs?: NeteaseSong[];
}

interface SimiSongResponseBody {
  songs?: NeteaseSong[];
}

interface NeteasePlaylist {
  id: number;
  name: string;
  trackCount?: number;
  playCount?: number;
  creator?: { nickname: string };
}

interface PlaylistDetailResponseBody {
  playlist?: {
    id: number;
    name: string;
    trackCount: number;
    tracks?: NeteaseSong[];
  };
}

interface PlaylistTrackAllResponseBody {
  songs?: NeteaseSong[];
}

interface SongUrlResponseBody {
  data?: Array<{
    id: number;
    url?: string | null;
    br?: number;
  }>;
}

interface LoginStatusResponseBody {
  data?: {
    profile?: {
      userId: number;
      nickname: string;
    };
  };
  profile?: {
    userId: number;
    nickname: string;
  };
}

export interface NeteaseCredentials {
  phone?: string;
  password?: string;
  cookie?: string;
}

export interface PlaylistInfo {
  id: number;
  name: string;
  trackCount: number;
}

// 音质等级（从高到低）
const QUALITY_LEVELS = ["hires", "lossless", "exhigh"] as const;

// 榜单名称到 ID 的映射
const CHART_MAP: Record<string, number> = {
  "飙升榜": 19723756,
  "飙升": 19723756,
  "新歌榜": 3779629,
  "新歌": 3779629,
  "原创榜": 2884035,
  "原创": 2884035,
  "热歌榜": 3778678,
  "热歌": 3778678,
};

export class NeteaseService {
  private cookie: string;

  constructor(
    private readonly searchLimit: number,
    private readonly logger: AppLogger,
    credentials?: NeteaseCredentials,
  ) {
    this.cookie = credentials?.cookie ?? "";
  }

  /**
   * 使用手机号登录网易云音乐
   * @returns 登录是否成功
   */
  async login(phone: string, password: string): Promise<boolean> {
    try {
      this.logger.info("正在登录网易云音乐账号...");

      const response = await NeteaseCloudMusicApi.login_cellphone({
        phone,
        password,
      });

      if (response.status === 200 && response.body?.code === 200) {
        // 保存登录后的 cookie
        if (response.cookie) {
          this.cookie = response.cookie.join(";");
        }
        this.logger.info("网易云音乐账号登录成功");
        return true;
      }

      this.logger.warn("网易云音乐登录失败", response.body);
      return false;
    } catch (error) {
      this.logger.error("网易云音乐登录异常", error);
      return false;
    }
  }

  /**
   * 设置 Cookie（用于已登录状态恢复）
   */
  setCookie(cookie: string): void {
    this.cookie = cookie;
  }

  /**
   * 获取当前 Cookie
   */
  getCookie(): string {
    return this.cookie;
  }

  /**
   * 创建二维码登录会话，返回二维码图片（base64）和 key
   */
  async createQrLogin(): Promise<{ key: string; qrimg: string }> {
    const keyResponse = await NeteaseCloudMusicApi.login_qr_key({});
    const keyBody = keyResponse.body as { data?: { unikey?: string } };
    const unikey = keyBody.data?.unikey;
    if (!unikey) {
      throw new Error("获取二维码 key 失败");
    }

    const createResponse = await NeteaseCloudMusicApi.login_qr_create({
      key: unikey,
      qrimg: true as unknown as string,
    });
    const createBody = createResponse.body as { data?: { qrimg?: string; qrurl?: string } };
    const qrimg = createBody.data?.qrimg;
    if (!qrimg) {
      throw new Error("生成二维码失败");
    }

    return { key: unikey, qrimg };
  }

  /**
   * 检查二维码扫码状态
   * 返回状态码：800=过期 801=等待扫码 802=已扫码等待确认 803=登录成功
   */
  async checkQrLoginStatus(key: string): Promise<{ code: number; cookie?: string; message: string }> {
    const response = await NeteaseCloudMusicApi.login_qr_check({ key });
    const body = response.body as { code?: number; cookie?: string; message?: string };

    const code = body.code ?? 0;
    let message: string;

    switch (code) {
      case 800:
        message = "二维码已过期，请重新生成";
        break;
      case 801:
        message = "等待扫码...";
        break;
      case 802:
        message = "已扫码，请在手机上确认";
        break;
      case 803:
        message = "登录成功";
        break;
      default:
        message = body.message ?? "未知状态";
    }

    // 登录成功时，从响应中提取 cookie
    let cookie: string | undefined;
    if (code === 803) {
      if (body.cookie) {
        cookie = body.cookie;
      } else if (response.cookie) {
        cookie = Array.isArray(response.cookie) ? response.cookie.join(";") : response.cookie;
      }
      // 使用获取到的 cookie 验证并保存
      if (cookie) {
        this.setCookie(cookie);
      }
    }

    return { code, cookie, message };
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(): Promise<boolean> {
    if (!this.cookie) {
      return false;
    }

    try {
      const response = await NeteaseCloudMusicApi.login_status({
        cookie: this.cookie,
      });

      const body = response.body as LoginStatusResponseBody;
      // 检查 profile 是否存在来判断登录状态
      const hasProfile = !!(body.data?.profile || body.profile);
      return response.status === 200 && hasProfile;
    } catch {
      return false;
    }
  }

  async searchFirstPlayable(keyword: string, requestedBy: string): Promise<PlaybackTrack> {
    const trimmedKeyword = keyword.trim();
    this.logger.info(`搜索网易云歌曲：${trimmedKeyword}`);

    // 构建搜索参数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: any = {
      keywords: trimmedKeyword,
      type: 1, // 1 = 单曲
      limit: this.searchLimit,
      offset: 0,
    };

    // 如果有登录态，携带 cookie
    if (this.cookie) {
      searchParams.cookie = this.cookie;
    }

    const response = await NeteaseCloudMusicApi.cloudsearch(searchParams);

    const body = response.body as SearchResponseBody;
    const songs = body.result?.songs ?? [];

    for (const song of songs) {
      const result = await this.resolvePlayableUrl(song.id);
      if (!result?.url) {
        continue;
      }

      return {
        id: String(song.id),
        title: song.name,
        artistNames: this.getArtistNames(song),
        durationMs: song.dt,
        sourceUrl: result.url,
        requestedBy,
      };
    }

    throw new Error("NOT_FOUND");
  }

  /**
   * 搜索网易云歌单，返回匹配的歌单列表
   */
  async searchPlaylists(keyword: string): Promise<PlaylistInfo[]> {
    const trimmedKeyword = keyword.trim();
    this.logger.info(`搜索网易云歌单：${trimmedKeyword}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: any = {
      keywords: trimmedKeyword,
      type: 1000, // 1000 = 歌单
      limit: 5,
      offset: 0,
    };

    if (this.cookie) {
      searchParams.cookie = this.cookie;
    }

    const response = await NeteaseCloudMusicApi.cloudsearch(searchParams);
    const body = response.body as SearchResponseBody;
    const playlists = body.result?.playlists ?? [];

    return playlists.map((pl) => ({
      id: pl.id,
      name: pl.name,
      trackCount: pl.trackCount ?? 0,
    }));
  }

  /**
   * 获取歌单详情（含曲目列表）
   */
  async getPlaylistDetail(playlistId: number): Promise<{ name: string; tracks: NeteaseSong[] }> {
    this.logger.info(`获取歌单详情：${playlistId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = { id: playlistId };
    if (this.cookie) {
      params.cookie = this.cookie;
    }

    const response = await NeteaseCloudMusicApi.playlist_detail(params);
    const body = response.body as PlaylistDetailResponseBody;
    const playlist = body.playlist;

    if (!playlist) {
      throw new Error("PLAYLIST_NOT_FOUND");
    }

    // playlist_detail 返回的 tracks 可能不完整（默认最多 100 首）
    // 对于大歌单，需要使用 playlist_track_all 获取全部曲目
    let tracks = playlist.tracks ?? [];

    if (playlist.trackCount > tracks.length) {
      this.logger.info(`歌单共 ${playlist.trackCount} 首，playlist_detail 仅返回 ${tracks.length} 首，使用 playlist_track_all 获取全部`);
      tracks = await this.fetchAllPlaylistTracks(playlistId);
    }

    return { name: playlist.name, tracks };
  }

  /**
   * 从 URL 或纯数字中提取歌单 ID
   * 支持格式：
   *   - 纯数字 ID：123456789
   *   - 网易云链接：https://music.163.com/#/playlist?id=123456789
   *   - y.music.163.com/m/playlist?id=123456789
   */
  extractPlaylistId(input: string): number | undefined {
    const trimmed = input.trim();

    // 纯数字
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    // URL 中提取 id 参数
    const urlMatch = trimmed.match(/[?&]id=(\d+)/);
    if (urlMatch) {
      return parseInt(urlMatch[1], 10);
    }

    return undefined;
  }

  /**
   * 批量解析歌单内歌曲的可播放 URL，并发控制
   * 返回可播放的 PlaybackTrack 列表
   */
  async resolvePlaylistTracks(
    songs: NeteaseSong[],
    requestedBy: string,
    concurrency: number = 5,
  ): Promise<PlaybackTrack[]> {
    const results: PlaybackTrack[] = [];
    this.logger.info(`开始批量解析 ${songs.length} 首歌曲的播放地址（并发 ${concurrency}）`);

    for (let i = 0; i < songs.length; i += concurrency) {
      const batch = songs.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (song) => {
          const urlResult = await this.resolvePlayableUrl(song.id);
          if (!urlResult?.url) {
            return undefined;
          }
          return {
            id: String(song.id),
            title: song.name,
            artistNames: this.getArtistNames(song),
            durationMs: song.dt ?? song.duration,
            sourceUrl: urlResult.url,
            requestedBy,
          } satisfies PlaybackTrack;
        }),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }

      // 每批解析完后记录进度
      const processed = Math.min(i + concurrency, songs.length);
      this.logger.debug(`播放地址解析进度：${processed}/${songs.length}，已找到 ${results.length} 首可播放`);
    }

    return results;
  }

  private async fetchAllPlaylistTracks(playlistId: number): Promise<NeteaseSong[]> {
    const allTracks: NeteaseSong[] = [];
    let offset = 0;
    const limit = 200; // playlist_track_all 每次最多返回的曲目数

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = { id: playlistId, limit, offset };
      if (this.cookie) {
        params.cookie = this.cookie;
      }

      const response = await NeteaseCloudMusicApi.playlist_track_all(params);
      const body = response.body as PlaylistTrackAllResponseBody;
      const songs = body.songs ?? [];

      allTracks.push(...songs);

      if (songs.length < limit) {
        break;
      }
      offset += limit;
    }

    this.logger.info(`playlist_track_all 共获取 ${allTracks.length} 首歌曲`);
    return allTracks;
  }

  /**
   * 获取歌曲播放链接
   * 优先尝试无损音质，依次降级
   */
  private async resolvePlayableUrl(songId: number): Promise<{ url: string; br: number } | undefined> {
    // 尝试使用 song_url_v1 获取无损音质（需要 VIP）
    if (this.cookie) {
      for (const level of QUALITY_LEVELS) {
        try {
          const response = await NeteaseCloudMusicApi.song_url_v1({
            id: String(songId),
            level: level as NeteaseCloudMusicApi.SoundQualityType,
            cookie: this.cookie,
          });

          const body = response.body as SongUrlResponseBody;
          const data = body.data?.find((item) => item.id === songId);

          if (data?.url) {
            this.logger.debug(`获取歌曲 ${songId} 音质 ${level} 成功，码率: ${data.br}`);
            return { url: data.url, br: data.br ?? 0 };
          }
        } catch (error) {
          this.logger.debug(`获取歌曲 ${songId} 音质 ${level} 失败，尝试下一级`);
        }
      }
    }

    // 降级：使用 song_url 接口，请求最高码率
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        id: String(songId),
        br: 999000, // 最高码率
      };

      if (this.cookie) {
        params.cookie = this.cookie;
      }

      const response = await NeteaseCloudMusicApi.song_url(params);

      const body = response.body as SongUrlResponseBody;
      const data = body.data?.find((item) => item.id === songId);

      if (data?.url) {
        this.logger.debug(`获取歌曲 ${songId} 普通音质成功，码率: ${data.br}`);
        return { url: data.url, br: data.br ?? 0 };
      }
    } catch (error) {
      this.logger.warn(`获取歌曲 ${songId} 播放链接失败`, error);
    }

    return undefined;
  }

  /**
   * 解析榜单名称，返回对应的榜单 ID
   */
  resolveChartId(name: string): number | undefined {
    return CHART_MAP[name.trim()];
  }

  /**
   * 获取热门榜单歌曲
   */
  async getTopList(chartId: number): Promise<{ name: string; tracks: NeteaseSong[] }> {
    this.logger.info(`获取热门榜单：${chartId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = { id: chartId };
    if (this.cookie) {
      params.cookie = this.cookie;
    }

    const response = await NeteaseCloudMusicApi.top_list(params);
    const body = response.body as { playlist?: { name: string; tracks?: NeteaseSong[] } };
    const playlist = body.playlist;

    if (!playlist) {
      throw new Error("CHART_NOT_FOUND");
    }

    return {
      name: playlist.name,
      tracks: playlist.tracks ?? [],
    };
  }

  /**
   * 获取相似歌曲
   */
  async getSimiSongs(songId: number, limit: number = 10): Promise<NeteaseSong[]> {
    this.logger.info(`获取相似歌曲：${songId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = { id: songId, limit };
    if (this.cookie) {
      params.cookie = this.cookie;
    }

    const response = await NeteaseCloudMusicApi.simi_song(params);
    const body = response.body as SimiSongResponseBody;
    return body.songs ?? [];
  }

  /**
   * 搜索歌手并获取热门歌曲
   */
  async searchArtistTopSongs(keyword: string): Promise<{ artistName: string; tracks: NeteaseSong[] }> {
    const trimmedKeyword = keyword.trim();
    this.logger.info(`搜索歌手：${trimmedKeyword}`);

    // 先搜索歌手
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: any = {
      keywords: trimmedKeyword,
      type: 100, // 100 = 歌手
      limit: 1,
      offset: 0,
    };
    if (this.cookie) {
      searchParams.cookie = this.cookie;
    }

    const searchResponse = await NeteaseCloudMusicApi.cloudsearch(searchParams);
    const searchBody = searchResponse.body as SearchResponseBody;
    const artists = searchBody.result?.artists ?? [];

    if (artists.length === 0) {
      throw new Error("ARTIST_NOT_FOUND");
    }

    const artist = artists[0];
    this.logger.info(`找到歌手：${artist.name} (ID: ${artist.id})`);

    // 获取歌手热门歌曲
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topParams: any = { id: artist.id! };
    if (this.cookie) {
      topParams.cookie = this.cookie;
    }

    const topResponse = await NeteaseCloudMusicApi.artist_top_song(topParams);
    const topBody = topResponse.body as ArtistTopSongResponseBody;

    return {
      artistName: topBody.artist?.name ?? artist.name,
      tracks: topBody.songs ?? [],
    };
  }

  async fetchLyrics(songId: string): Promise<ParsedLyrics | undefined> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = { id: songId };
      if (this.cookie) {
        params.cookie = this.cookie;
      }

      const response = await NeteaseCloudMusicApi.lyric_new(params);
      const body = response.body as { lrc?: { lyric?: string }; code?: number };

      const lrcText = body.lrc?.lyric;
      if (!lrcText) {
        return undefined;
      }

      return this.parseLrc(lrcText);
    } catch (error) {
      this.logger.debug("获取歌词失败", error);
      return undefined;
    }
  }

  private parseLrc(lrcText: string): ParsedLyrics {
    const lines: Array<{ timeMs: number; text: string }> = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const line of lrcText.split("\n")) {
      const match = line.match(regex);
      if (!match) continue;

      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3];
      const ms = msStr.length === 2
        ? parseInt(msStr, 10) * 10
        : parseInt(msStr, 10);
      const text = match[4].trim();

      if (!text) continue;

      lines.push({ timeMs: min * 60000 + sec * 1000 + ms, text });
    }

    lines.sort((a, b) => a.timeMs - b.timeMs);
    return { lines };
  }

  getArtistNames(song: NeteaseSong): string {
    const artists = song.ar ?? song.artists ?? [];
    return artists.map((artist) => artist.name).join("/") || "未知歌手";
  }
}
