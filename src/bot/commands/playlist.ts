import type { Card } from "kasumi.js";
import { messages } from "../../shared/messages";
import type { CommandExecutionContext } from "./types";

function parsePlaylistArgs(argsText: string): { input: string; shuffle: boolean } {
  const trimmed = argsText.trim();
  if (!trimmed) {
    return { input: "", shuffle: false };
  }

  if (trimmed === "随机") {
    return { input: "", shuffle: true };
  }

  if (trimmed.startsWith("随机 ")) {
    return { input: trimmed.slice(2).trim(), shuffle: true };
  }

  return { input: trimmed, shuffle: false };
}

export async function handlePlaylistCommand(
  context: CommandExecutionContext,
  argsText: string,
): Promise<string | Card> {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  const { input, shuffle } = parsePlaylistArgs(argsText);
  if (!input) {
    return messages.playlistUsage(context.commandPrefix);
  }

  return context.player.playPlaylist(
    context.event.guildId,
    context.event.channelId,
    context.event.authorId,
    context.event.author.nickname,
    input,
    { shuffle },
  );
}
