import { createBotClient } from "./bot/client";
import { MessageRouter } from "./bot/message-router";
import { loadConfig } from "./config/env";
import { Player } from "./music/player";
import { QueueManager } from "./music/queue-manager";
import { SessionManager } from "./music/session-manager";
import { NeteaseService } from "./services/netease-service";
import { NeteaseAuthService } from "./services/netease-auth";
import { createLogger } from "./shared/logger";
import { startDashboardServer } from "./dashboard/server";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const client = await createBotClient(config, logger.child("client"));
  const queueManager = new QueueManager();
  const sessionManager = new SessionManager();
  const neteaseService = new NeteaseService(
    config.neteaseSearchLimit,
    logger.child("netease"),
  );
  const neteaseAuthService = new NeteaseAuthService(
    neteaseService,
    logger.child("netease-auth"),
  );

  // 初始化网易云登录
  await neteaseAuthService.initialize({
    phone: config.neteasePhone,
    password: config.neteasePassword,
    cookie: config.neteaseCookie,
  });

  const player = new Player(
    client,
    config,
    logger.child("player"),
    neteaseService,
    queueManager,
    sessionManager,
  );
  
  const dashboardServer = startDashboardServer(
    player,
    sessionManager,
    config.dashboardPort,
    logger.child("dashboard"),
  );

  const router = new MessageRouter(client, player, config.commandPrefix, logger.child("router"));

  client.on("message.text", (event) => {
    void router.handle(event);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`收到退出信号：${signal}`);
    dashboardServer.close();
    await player.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  logger.info("KOOK 网易云点歌机器人已启动");
}

void main().catch((error) => {
  console.error("启动失败", error);
  process.exit(1);
});
