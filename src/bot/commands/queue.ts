import type { Card } from "kasumi.js";
import type { CommandExecutionContext } from "./types";

export function handleQueueCommand(context: CommandExecutionContext): string | Card {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return context.player.getQueue(context.event.guildId);
}
