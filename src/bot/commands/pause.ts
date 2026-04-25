import type { CommandExecutionContext } from "./types";

export async function handlePauseCommand(
  context: CommandExecutionContext,
): Promise<string> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  await context.player.pause(context.event.guildId);
  return "";
}
