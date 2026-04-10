export const COMMANDS = {
  play: { name: "点歌", aliases: ["点歌", "播放", "play"] },
  pause: { name: "暂停", aliases: ["暂停", "pause"] },
  resume: { name: "继续", aliases: ["继续", "恢复", "resume"] },
  skip: { name: "切歌", aliases: ["切歌", "下一首", "skip", "next"] },
  stop: { name: "停止", aliases: ["停止", "停播", "清空", "stop"] },
  queue: { name: "队列", aliases: ["队列", "歌单", "queue", "list"] },
  nowPlaying: { name: "当前播放", aliases: ["当前播放", "正在播放", "np", "nowplaying"] },
  help: { name: "帮助", aliases: ["帮助", "菜单", "help", "menu"] },
} as const;

export type CommandKey = keyof typeof COMMANDS;
