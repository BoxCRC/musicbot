import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  KOOK_BOT_TOKEN: z.string().min(1, "缺少 KOOK_BOT_TOKEN"),
  COMMAND_PREFIX: z.string().trim().min(1).default("!"),
  NETEASE_SEARCH_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  FFMPEG_PATH: z.string().trim().optional(),
  IDLE_DISCONNECT_SECONDS: z.coerce.number().int().min(0).max(3600).default(120),
  // 网易云音乐登录配置（可选）
  NETEASE_PHONE: z.string().trim().optional(),
  NETEASE_PASSWORD: z.string().trim().optional(),
  NETEASE_COOKIE: z.string().trim().optional(),
  DASHBOARD_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
});

export type AppConfig = {
  kookBotToken: string;
  commandPrefix: string;
  neteaseSearchLimit: number;
  logLevel: "debug" | "info" | "warn" | "error";
  ffmpegPath: string;
  idleDisconnectSeconds: number;
  neteasePhone?: string;
  neteasePassword?: string;
  neteaseCookie?: string;
  dashboardPort: number;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("；"));
  }

  const ffmpegPath = parsed.data.FFMPEG_PATH || "ffmpeg";

  return {
    kookBotToken: parsed.data.KOOK_BOT_TOKEN,
    commandPrefix: parsed.data.COMMAND_PREFIX,
    neteaseSearchLimit: parsed.data.NETEASE_SEARCH_LIMIT,
    logLevel: parsed.data.LOG_LEVEL,
    ffmpegPath,
    idleDisconnectSeconds: parsed.data.IDLE_DISCONNECT_SECONDS,
    neteasePhone: parsed.data.NETEASE_PHONE,
    neteasePassword: parsed.data.NETEASE_PASSWORD,
    neteaseCookie: parsed.data.NETEASE_COOKIE,
    dashboardPort: parsed.data.DASHBOARD_PORT,
  };
}
