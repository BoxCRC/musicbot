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
}
