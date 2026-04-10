import type { MarkdownMessageEvent, PlainTextMessageEvent } from "kasumi.js";
import type { Player } from "../../music/player";

export type TextMessageEvent = PlainTextMessageEvent | MarkdownMessageEvent;

export type CommandExecutionContext = {
  event: TextMessageEvent;
  player: Player;
  commandPrefix: string;
};
