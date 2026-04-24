import type { Card } from "kasumi.js";
import type { CommandExecutionContext } from "./types";
import { COMMANDS } from "../../shared/commands";
import { buildHelpCard } from "../../shared/cards";

export function handleHelpCommand(context: CommandExecutionContext): string | Card {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return buildHelpCard(context.commandPrefix, Object.values(COMMANDS));
}
