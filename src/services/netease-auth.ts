import * as crypto from "crypto";
import type { NeteaseService, NeteaseCredentials } from "./netease-service";
import type { AppLogger } from "../shared/logger";

export interface NeteaseAuthConfig {
  phone?: string;
  password?: string;
  cookie?: string;
}

/**
 * 网易云音乐认证管理器
 */
export class NeteaseAuthService {
  private hasLoggedIn = false;

  constructor(
    private readonly neteaseService: NeteaseService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * 初始化认证：尝试登录或恢复会话
   */
  async initialize(config: NeteaseAuthConfig): Promise<void> {
    // 优先使用 Cookie 恢复会话
    if (config.cookie) {
      this.logger.info("检测到网易云 Cookie 配置，尝试恢复登录态...");
      this.neteaseService.setCookie(config.cookie);

      const isValid = await this.neteaseService.checkLoginStatus();
      if (isValid) {
        this.hasLoggedIn = true;
        this.logger.info("网易云登录态恢复成功");
        return;
      }

      this.logger.warn("网易云 Cookie 已失效");
    }

    // 尝试手机号登录
    if (config.phone && config.password) {
      this.logger.info("检测到网易云账号配置，尝试登录...");

      // 密码需要 MD5 加密
      const md5Password = crypto.createHash("md5").update(config.password).digest("hex");

      const success = await this.neteaseService.login(config.phone, md5Password);
      if (success) {
        this.hasLoggedIn = true;
        this.logger.info("网易云登录成功，可播放 VIP 歌曲");

        // 输出当前 Cookie 供保存
        const cookie = this.neteaseService.getCookie();
        if (cookie) {
          this.logger.info(`登录成功，Cookie 已获取。如需持久化登录态，可将以下内容保存到 .env 的 NETEASE_COOKIE：`);
          this.logger.info(`NETEASE_COOKIE=${cookie.substring(0, 50)}...`);
        }
        return;
      }

      this.logger.warn("网易云登录失败，将以未登录状态运行（可能无法播放 VIP 歌曲）");
      return;
    }

    this.logger.info("未配置网易云账号，将以未登录状态运行");
  }

  /**
   * 是否已登录
   */
  isLoggedIn(): boolean {
    return this.hasLoggedIn;
  }
}
