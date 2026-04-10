import type { MarkdownMessageEvent, PlainTextMessageEvent } from "kasumi.js";
import { COMMANDS, type CommandKey } from "../shared/commands";
import { messages } from "../shared/messages";
import type { AppLogger } from "../shared/logger";
import type { Player } from "../music/player";
import { handleNowPlayingCommand } from "./commands/now-playing";
import { handlePauseCommand } from "./commands/pause";
import { handlePlayCommand } from "./commands/play";
import { handleQueueCommand } from "./commands/queue";
import { handleResumeCommand } from "./commands/resume";
import { handleSkipCommand } from "./commands/skip";
import { handleStopCommand } from "./commands/stop";
import { handleHelpCommand } from "./commands/help";

export class MessageRouter {
  private readonly commandAliasMap = new Map<string, CommandKey>();

  constructor(
    private readonly player: Player,
    private readonly commandPrefix: string,
    private readonly logger: AppLogger,
  ) {
    (Object.entries(COMMANDS) as Array<[CommandKey, (typeof COMMANDS)[CommandKey]]>).forEach(
      ([key, value]) => {
        value.aliases.forEach((alias) => {
          this.commandAliasMap.set(alias.toLowerCase(), key);
        });
      },
    );
  }

  async handle(event: PlainTextMessageEvent | MarkdownMessageEvent): Promise<void> {
    if (event.author.bot) {
      return;
    }

    const content = event.content.trim();
    if (!content.startsWith(this.commandPrefix)) {
      return;
    }

    const withoutPrefix = content.slice(this.commandPrefix.length).trim();
    if (!withoutPrefix) {
      return;
    }

    const [rawCommand, ...rest] = withoutPrefix.split(/\s+/);
    const commandKey = this.commandAliasMap.get(rawCommand.toLowerCase());
    if (!commandKey) {
      return;
    }

    try {
      const argsText = rest.join(" ").trim();
      let reply = "";
      const context = {
        event,
        player: this.player,
        commandPrefix: this.commandPrefix,
      };

      switch (commandKey) {
        case "play":
          reply = await handlePlayCommand(context, argsText);
          break;
        case "pause":
          reply = await handlePauseCommand(context);
          break;
        case "resume":
          reply = await handleResumeCommand(context);
          break;
        case "skip":
          reply = await handleSkipCommand(context);
          break;
        case "stop":
          reply = await handleStopCommand(context);
          break;
        case "queue":
          reply = handleQueueCommand(context);
          break;
        case "nowPlaying":
          reply = handleNowPlayingCommand(context);
          break;
        case "help":
          reply = handleHelpCommand(context);
          break;
      }

      if (reply) {
        await event.reply(reply);
      }
    } catch (error) {
      this.logger.error("消息路由处理失败", error);
      await event.reply(messages.commandFailed);
    }

  }
}
