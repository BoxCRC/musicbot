import type Kasumi from "kasumi.js";
import type { ButtonClickedEvent } from "kasumi.js";
import type { Player } from "../music/player";
import type { AppLogger } from "../shared/logger";
import { parseButtonValue } from "../shared/button-values";

export function setupButtonHandlers(
  client: Kasumi<Record<string, never>>,
  player: Player,
  logger: AppLogger,
): void {
  // 监听按钮点击事件
  client.on("event.button", async (event: ButtonClickedEvent) => {
    const { value, guildId } = event;
    if (!value || !guildId) {
      return;
    }

    const action = parseButtonValue(value);
    if (!action) {
      return;
    }

    try {
      logger.info(`用户点击按钮：${action}，服务器：${guildId}`);
      switch (action) {
        case "pause":
          await player.pause(guildId);
          break;
        case "resume":
          await player.resume(guildId);
          break;
        case "skip":
          await player.skip(guildId);
          break;
        case "stop":
          await player.stop(guildId);
          break;
      }
    } catch (error) {
      logger.warn(`按钮处理失败: ${action}`, error);
    }
  });
}
