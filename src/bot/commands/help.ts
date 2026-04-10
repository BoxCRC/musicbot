import type { CommandExecutionContext } from "./types";
import { COMMANDS } from "../../shared/commands";

export function handleHelpCommand(context: CommandExecutionContext): string {
  if (!context.event.guildId) {
    return "请在服务器频道内使用该指令。";
  }

  const lines = [
    "**KOOK 网易云点歌机器人 - 可用指令**",
    "---",
  ];

  Object.values(COMMANDS).forEach((cmd) => {
    lines.push(`- \`${context.commandPrefix}${cmd.name}\` (别名: ${cmd.aliases.join(", ")})`);
  });

  lines.push("---");
  lines.push(`💡 发送 \`${context.commandPrefix}点歌 歌曲名\` 即可将歌曲加入播放队列！`);

  return lines.join("\n");
}
