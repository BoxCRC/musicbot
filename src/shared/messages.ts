import type { PlaybackTrack } from "../music/types";

export const messages = {
  guildOnly: "请在服务器文字频道中使用该指令。",
  commandFailed: "指令处理失败，请稍后重试。",

  userNotInVoiceChannel: "你当前不在语音频道，请先进入语音频道后再点歌。",
  botBusyInAnotherVoiceChannel: "机器人已经在另一个语音频道播放中，请到同一语音频道操作。",
  playUsage: (prefix: string) => `用法：${prefix}点歌 歌曲名`,
  queueEmpty: "当前队列为空。",
  nothingPlaying: "当前没有正在播放的歌曲。",
  pauseWhenIdle: "当前没有可暂停的歌曲。",
  alreadyPaused: "当前已经是暂停状态。",
  paused: "已暂停当前播放。",
  resumeWhenIdle: "当前没有可继续播放的歌曲。",
  notPaused: "当前不是暂停状态。",
  resumed: "已继续播放。",
  skipped: "已切到下一首。",
  skippedTo: (position: number) => `已切到队列第 ${position} 首。`,
  skipOutOfRange: (queueLength: number) => `队列中没有第 ${queueLength > 0 ? `该位置的歌曲，队列共 ${queueLength} 首` : "歌曲，队列为空"}。`,
  stopped: "已停止播放并清空队列。",
  searchFailed: (keyword: string) => `没有在网易云找到可播放的结果：${keyword}`,
  playlistUsage: (prefix: string) => `用法：${prefix}歌单 <歌单名/ID/链接>`,
  playlistSearchFailed: (keyword: string) => `没有在网易云找到歌单：${keyword}`,
  playlistLoadFailed: "获取歌单详情失败，请检查歌单 ID 或链接是否正确。",
  playlistEmpty: "该歌单内没有歌曲。",
  playlistNoPlayable: "该歌单内没有可播放的歌曲（可能均为 VIP 或下架歌曲）。",
  playlistLoading: (name: string) => `正在加载歌单「${name}」的歌曲，请稍候...`,
  playlistLoaded: (name: string, total: number, loaded: number, skipped: number) =>
    `歌单「${name}」已加载：共 ${total} 首，成功 ${loaded} 首${skipped > 0 ? `，跳过 ${skipped} 首（无版权/VIP）` : ""}`,
  autoDisconnected: "队列已空，机器人已自动离开语音频道。",
  nowPlaying: (track: PlaybackTrack, stateLabel: string) =>
    `当前播放：${track.title} - ${track.artistNames}（${stateLabel}）`,
  queued: (track: PlaybackTrack, position: number, started: boolean) =>
    started
      ? `已开始播放：${track.title} - ${track.artistNames}`
      : `已加入队列第 ${position} 位：${track.title} - ${track.artistNames}`,
  topListUsage: (prefix: string) => `用法：${prefix}榜单 <榜单名>　可选：飙升榜、新歌榜、原创榜、热歌榜`,
  topListNotFound: (name: string) => `未找到榜单：${name}，可选：飙升榜、新歌榜、原创榜、热歌榜`,
  simiNoPlaying: "当前没有正在播放的歌曲，无法查找相似歌曲。",
  simiNotFound: "没有找到相似歌曲。",
  artistUsage: (prefix: string) => `用法：${prefix}歌手 <歌手名>`,
  artistNotFound: (keyword: string) => `没有找到歌手：${keyword}`,
  ffmpegNotFound: "ffmpeg 未找到，无法播放音频。请在 .env 中配置正确的 FFMPEG_PATH（例如 C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe）后重启机器人。",
  playbackAborted: "连续播放失败次数过多，已停止队列。请检查 ffmpeg 是否正常可用。",
  playbackError: (track: PlaybackTrack, reason: string) =>
    `播放失败，已跳过：${track.title} - ${track.artistNames}；原因：${reason}`,
  queueList: (current: PlaybackTrack | undefined, queue: PlaybackTrack[]) => {
    const lines: string[] = [];

    if (current) {
      lines.push(`当前：${current.title} - ${current.artistNames}`);
    }

    if (queue.length === 0) {
      lines.push("排队：无");
    } else {
      lines.push("排队：");
      queue.slice(0, 10).forEach((track, index) => {
        lines.push(`${index + 1}. ${track.title} - ${track.artistNames}`);
      });
      if (queue.length > 10) {
        lines.push(`……还有 ${queue.length - 10} 首`);
      }
    }

    return lines.join("\n");
  },
};
