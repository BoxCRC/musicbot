import Kasumi from "kasumi.js";
import type { AppConfig } from "../config/env";
import type { AppLogger } from "../shared/logger";

export async function createBotClient(
  config: AppConfig,
  logger: AppLogger,
): Promise<Kasumi<Record<string, never>>> {

  const client = new Kasumi<Record<string, never>>(
    {
      type: "websocket",
      token: config.kookBotToken,
      vendor: "hexona",
    },
    false,
    false,
  );

  client.on("connect.websocket", (event) => {
    logger.info(`KOOK 已连接，连接方式：${event.vendor}`);
  });

  await client.connect();

  return client;
}
