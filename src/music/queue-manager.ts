import type { GuildMusicSession, PlaybackTrack } from "./types";

export class QueueManager {
  enqueue(session: GuildMusicSession, track: PlaybackTrack): number {
    session.queue.push(track);
    return session.queue.length;
  }

  dequeue(session: GuildMusicSession): PlaybackTrack | undefined {
    return session.queue.shift();
  }

  clear(session: GuildMusicSession): void {
    session.queue.length = 0;
  }

  list(session: GuildMusicSession): PlaybackTrack[] {
    return [...session.queue];
  }

  /**
   * 移除队列中指定位置之前的所有歌曲（1-indexed）
   * 例如 removeBefore(session, 3) 会移除第 1、2 首，保留第 3 首及之后的歌曲
   */
  removeBefore(session: GuildMusicSession, position: number): void {
    const removeCount = Math.max(0, position - 1);
    session.queue.splice(0, removeCount);
  }
}
