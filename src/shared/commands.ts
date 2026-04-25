export const COMMANDS = {
  play: { name: "点歌", aliases: ["点歌", "播放", "play"], desc: "搜索并播放歌曲，用法：点歌 歌曲名" },
  playlist: { name: "歌单", aliases: ["歌单", "playlist", "pl"], desc: "播放网易云歌单，用法：歌单 歌单名/ID/链接" },
  pause: { name: "暂停", aliases: ["暂停", "pause"], desc: "暂停当前播放" },
  resume: { name: "继续", aliases: ["继续", "恢复", "resume"], desc: "继续播放" },
  skip: { name: "切歌", aliases: ["切歌", "下一首", "skip", "next"], desc: "切歌，用法：切歌（下一首）或 切歌 3（跳到第3首）" },
  stop: { name: "停止", aliases: ["停止", "停播", "清空", "stop"], desc: "停止播放并清空队列" },
  queue: { name: "队列", aliases: ["队列", "歌单列表", "queue", "list"], desc: "查看当前播放队列" },
  nowPlaying: { name: "当前播放", aliases: ["当前播放", "正在播放", "np", "nowplaying"], desc: "查看当前播放的歌曲和歌词" },
  help: { name: "帮助", aliases: ["帮助", "菜单", "help", "menu"], desc: "查看所有可用指令" },
  topList: { name: "榜单", aliases: ["榜单", "排行榜", "chart", "top"], desc: "播放热门榜单，用法：榜单 热歌榜/飙升榜/新歌榜/原创榜" },
  simi: { name: "相似", aliases: ["相似", "相似歌曲", "simi"], desc: "查找并播放与当前歌曲相似的歌曲" },
  artist: { name: "歌手", aliases: ["歌手", "artist"], desc: "播放歌手热门歌曲，用法：歌手 歌手名" },
} as const;

export type CommandKey = keyof typeof COMMANDS;
