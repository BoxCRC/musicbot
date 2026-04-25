import type { Card } from "kasumi.js";
import type { CommandExecutionContext } from "./types";

export async function handleSimiCommand(
  context: CommandExecutionContext,
): Promise<string | Card> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return context.player.playSimiSongs(
    context.event.guildId,
    context.event.channelId,
    context.event.authorId,
    context.event.author.nickname,
  );
}
