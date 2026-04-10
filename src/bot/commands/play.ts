import type { CommandExecutionContext } from "./types";

export async function handlePlayCommand(
  context: CommandExecutionContext,
  argsText: string,
): Promise<string> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return context.player.play(
    context.event.guildId,
    context.event.channelId,
    context.event.authorId,
    argsText,
  );
}
