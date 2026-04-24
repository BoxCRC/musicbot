import { Card } from "kasumi.js";
import type { ParsedLyrics, PlaybackTrack } from "../music/types";

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
  commands: Array<{ name: string; aliases: readonly string[] }>,
): Card {
  const card = new Card();
  card.setTheme(Theme.PRIMARY);
  card.addTitle("可用指令");

  const lines = commands
    .map((cmd) => `\`${prefix}${cmd.name}\`　别名：${cmd.aliases.join("、")}`)
    .join("\n");
  card.addText(lines);

  card.addDivider();
  card.addContext(`发送 ${prefix}点歌 歌曲名 即可开始播放`);
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
