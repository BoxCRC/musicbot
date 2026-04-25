import type { CommandExecutionContext } from "./types";

export async function handleSkipCommand(
  context: CommandExecutionContext,
  argsText: string,
): Promise<string> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  const trimmed = argsText.trim();
  let position: number | undefined;

  if (trimmed) {
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1) {
      position = num;
    }
  }

  await context.player.skip(context.event.guildId, position);
  return "";
}
