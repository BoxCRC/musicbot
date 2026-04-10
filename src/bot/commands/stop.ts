import type { CommandExecutionContext } from "./types";

export async function handleStopCommand(
  context: CommandExecutionContext,
): Promise<string> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return context.player.stop(context.event.guildId);
}
