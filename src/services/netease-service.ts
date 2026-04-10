import * as NeteaseCloudMusicApi from "NeteaseCloudMusicApi";
import type { PlaybackTrack } from "../music/types";
import type { AppLogger } from "../shared/logger";

interface NeteaseArtist {
  name: string;
}

interface NeteaseSong {
  id: number;
  name: string;
  dt?: number;
  ar?: NeteaseArtist[];
  artists?: NeteaseArtist[];
}

interface SearchResponseBody {
  result?: {
    songs?: NeteaseSong[];
  };
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

// 音质等级（从高到低）
const QUALITY_LEVELS = ["hires", "lossless", "exhigh"] as const;

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

  private getArtistNames(song: NeteaseSong): string {
    const artists = song.ar ?? song.artists ?? [];
    return artists.map((artist) => artist.name).join("/") || "未知歌手";
  }
}
