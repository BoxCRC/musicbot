import type { Card } from "kasumi.js";
import type { CommandExecutionContext } from "./types";

export async function handlePlaylistCommand(
  context: CommandExecutionContext,
  argsText: string,
): Promise<string | Card> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  return context.player.playPlaylist(
    context.event.guildId,
    context.event.channelId,
    context.event.authorId,
    context.event.author.nickname,
    argsText,
  );
}
