import type { CommandExecutionContext } from "./types";

export async function handleResumeCommand(
  context: CommandExecutionContext,
): Promise<string> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  await context.player.resume(context.event.guildId);
  return "";
}
