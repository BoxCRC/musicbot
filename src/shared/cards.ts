import { Card } from "kasumi.js";
import type { ParsedLyrics, PlaybackTrack, PlaybackState } from "../music/types";
import { BUTTON_ACTIONS, buildButtonValue } from "./button-values";

const Theme = Card.Theme;

// ── 辅助函数 ──────────────────────────────────────────────

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "未知";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function getCurrentLyricLines(
  lyrics: ParsedLyrics | undefined,
  startedAt: number | undefined,
): string | undefined {
  if (!lyrics || lyrics.lines.length === 0 || !startedAt) {
    return undefined;
  }

  const elapsed = Date.now() - startedAt;

  // 找到当前歌词行（最后一个 timeMs <= elapsed 的行）
  let currentIdx = -1;
  for (let i = lyrics.lines.length - 1; i >= 0; i--) {
    if (lyrics.lines[i].timeMs <= elapsed) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx === -1) {
    currentIdx = 0;
  }

  // 取当前行前后各 2 行，共 5 行
  const start = Math.max(0, currentIdx - 2);
  const end = Math.min(lyrics.lines.length, start + 5);
  const window = lyrics.lines.slice(start, end);

  return window
    .map((line, i) => {
      const idx = start + i;
      if (idx === currentIdx) {
        return `**(font)${line.text}(font)[primary]**`;
      }
      return `${line.text}`;
    })
    .join("\n");
}

// ── 卡片构建器 ──────────────────────────────────────────────

export function buildNowPlayingCard(params: {
  track: PlaybackTrack;
  stateLabel: string;
  startedAt?: number;
  lyrics?: ParsedLyrics;
}): Card {
  const { track, stateLabel, startedAt, lyrics } = params;

  const card = new Card();
  card.setTheme(Theme.INFO);
  card.addTitle("正在播放");

  card.addText(`**${track.title}** - ${track.artistNames}`);

  // 状态 + 播放进度 + 点歌人
  const total = formatDuration(track.durationMs);
  let progress: string;
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    progress = `${formatDuration(elapsed)} / ${total}`;
  } else {
    progress = total;
  }
  card.addText(`(font)${stateLabel}(font)[success]　|　${progress}　|　点歌 ${track.requestedBy}`);

  // 歌词
  const lyricText = getCurrentLyricLines(lyrics, startedAt);
  if (lyricText) {
    card.addDivider();
    card.addText(lyricText);
  }

  card.addContext("发送 /当前播放 查看实时歌词");
  return card;
}

export function buildQueuedCard(
  track: PlaybackTrack,
  position: number,
  started: boolean,
): Card {
  const card = new Card();

  if (started) {
    card.setTheme(Theme.SUCCESS);
    card.addTitle("已开始播放");
  } else {
    card.setTheme(Theme.INFO);
    card.addTitle("已加入队列");
  }

  card.addText(`**${track.title}** - ${track.artistNames}`);

  if (!started) {
    card.addContext(`队列第 ${position} 位`);
  }

  return card;
}

export function buildQueueListCard(
  current: PlaybackTrack | undefined,
  queue: PlaybackTrack[],
): Card {
  const card = new Card();
  card.setTheme(Theme.PRIMARY);
  card.addTitle("播放队列");

  if (current) {
    card.addText(`(font)正在播放：(font)[success]\n**${current.title}** - ${current.artistNames}`);
  }

  if (queue.length === 0) {
    card.addDivider();
    card.addText("排队：无");
  } else {
    card.addDivider();
    const lines = queue
      .slice(0, 10)
      .map((t, i) => `${i + 1}. **${t.title}** - ${t.artistNames}`)
      .join("\n");
    card.addText(lines);

    if (queue.length > 10) {
      card.addContext(`……还有 ${queue.length - 10} 首`);
    }
  }

  const total = (current ? 1 : 0) + queue.length;
  card.addContext(`共 ${total} 首`);
  return card;
}

export function buildHelpCard(
  prefix: string,
  commands: Array<{ name: string; desc: string }>,
): Card {
  const card = new Card();
  card.setTheme(Theme.PRIMARY);
  card.addTitle("可用指令");

  const lines = commands
    .map((cmd) => `\`${prefix}${cmd.name}\`　${cmd.desc}`)
    .join("\n");
  card.addText(lines);

  return card;
}

export function buildStatusCard(
  message: string,
  theme: (typeof Theme)[keyof typeof Theme] = Theme.INFO,
): Card {
  const card = new Card();
  card.setTheme(theme);
  card.addText(message);
  return card;
}

export function buildPlaylistLoadedCard(
  playlistName: string,
  totalTracks: number,
  loadedTracks: number,
  skippedTracks: number,
): Card {
  const card = new Card();
  card.setTheme(Theme.SUCCESS);
  card.addTitle("歌单已加载");
  card.addText(`**${playlistName}**`);
  card.addDivider();
  card.addText(`共 ${totalTracks} 首，成功入队 ${loadedTracks} 首${skippedTracks > 0 ? `，跳过 ${skippedTracks} 首` : ""}`);
  card.addContext("发送 /队列 查看完整播放列表");
  return card;
}

export function buildTopListCard(
  chartName: string,
  total: number,
  loaded: number,
  skipped: number,
): Card {
  const card = new Card();
  card.setTheme(Theme.SUCCESS);
  card.addTitle("榜单已加载");
  card.addText(`**${chartName}**`);
  card.addDivider();
  card.addText(`共 ${total} 首，成功入队 ${loaded} 首${skipped > 0 ? `，跳过 ${skipped} 首（无版权/VIP）` : ""}`);
  card.addContext("发送 /队列 查看完整播放列表");
  return card;
}

export function buildSimiSongsCard(
  currentTrack: PlaybackTrack,
  loaded: number,
): Card {
  const card = new Card();
  card.setTheme(Theme.SUCCESS);
  card.addTitle("相似歌曲已入队");
  card.addText(`基于 **${currentTrack.title}** - ${currentTrack.artistNames}`);
  card.addDivider();
  card.addText(`已加入 ${loaded} 首相似歌曲到队列`);
  card.addContext("发送 /队列 查看完整播放列表");
  return card;
}

export function buildArtistTopSongsCard(
  artistName: string,
  total: number,
  loaded: number,
): Card {
  const card = new Card();
  card.setTheme(Theme.SUCCESS);
  card.addTitle("歌手热门歌曲已加载");
  card.addText(`**${artistName}** 热门歌曲`);
  card.addDivider();
  card.addText(`共 ${total} 首，成功入队 ${loaded} 首`);
  card.addContext("发送 /队列 查看完整播放列表");
  return card;
}

export function buildPlaybackEndedCard(): Card {
  const card = new Card();
  card.setTheme(Theme.SECONDARY);
  card.addTitle("播放已结束");
  card.addText("当前没有正在播放的歌曲");
  card.addContext("发送 /点歌 歌曲名 开始播放");
  return card;
}

export function buildPlayerPanelCard(params: {
  track: PlaybackTrack;
  state: PlaybackState;
  startedAt?: number;
  lyrics?: ParsedLyrics;
  queue: PlaybackTrack[];
}): Card {
  const { track, state, startedAt, lyrics, queue } = params;

  const card = new Card();
  card.setTheme(state === "paused" ? Theme.WARNING : Theme.INFO);

  // 标题
  const stateText = state === "paused" ? "已暂停" : "正在播放";
  card.addTitle(stateText);

  // 歌曲信息
  card.addText(`**${track.title}** - ${track.artistNames}`);

  // 进度和状态
  const total = formatDuration(track.durationMs);
  let progress: string;
  if (startedAt) {
    const elapsed = Date.now() - startedAt;
    progress = `${formatDuration(elapsed)} / ${total}`;
  } else {
    progress = total;
  }
  const stateLabel = state === "playing" ? "播放中" : state === "paused" ? "已暂停" : "缓冲中";
  card.addText(`(font)${stateLabel}(font)[success]　|　${progress}　|　点歌 ${track.requestedBy}`);

  // 歌词
  const lyricText = getCurrentLyricLines(lyrics, startedAt);
  if (lyricText) {
    card.addDivider();
    card.addText(lyricText);
  }

  // 队列预览
  if (queue.length > 0) {
    card.addDivider();
    const preview = queue
      .slice(0, 3)
      .map((t, i) => `${i + 1}. ${t.title} - ${t.artistNames}`)
      .join("\n");
    card.addText(`**队列预览**\n${preview}`);
    if (queue.length > 3) {
      card.addContext(`……还有 ${queue.length - 3} 首`);
    }
  }

  // 控制按钮（使用 action-group 实现横排）
  card.addDivider();
  const pauseResumeAction = state === "paused" ? BUTTON_ACTIONS.RESUME : BUTTON_ACTIONS.PAUSE;
  const pauseResumeText = state === "paused" ? "继续" : "暂停";
  const pauseResumeTheme = state === "paused" ? Theme.SUCCESS : Theme.WARNING;

  // 手动构建 action-group 模块
  card.addModule({
    type: "action-group" as any,
    elements: [
      {
        type: "button",
        theme: pauseResumeTheme,
        value: buildButtonValue(pauseResumeAction),
        click: "return-val",
        text: { type: "plain-text", content: pauseResumeText },
      },
      {
        type: "button",
        theme: Theme.PRIMARY,
        value: buildButtonValue(BUTTON_ACTIONS.SKIP),
        click: "return-val",
        text: { type: "plain-text", content: "切歌" },
      },
      {
        type: "button",
        theme: Theme.DANGER,
        value: buildButtonValue(BUTTON_ACTIONS.STOP),
        click: "return-val",
        text: { type: "plain-text", content: "停止" },
      },
    ],
  } as any);

  return card;
}
