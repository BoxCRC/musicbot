import type { GuildMusicSession, PlaybackState } from "./types";

export class SessionManager {
  private readonly sessions = new Map<string, GuildMusicSession>();

  get(guildId: string): GuildMusicSession | undefined {
    return this.sessions.get(guildId);
  }

  getOrCreate(guildId: string): GuildMusicSession {
    const existing = this.sessions.get(guildId);
    if (existing) {
      return existing;
    }

    const created: GuildMusicSession = {
      guildId,
      queue: [],
      state: "idle",
      consecutiveErrors: 0,
    };

    this.sessions.set(guildId, created);
    return created;
  }

  setContext(
    guildId: string,
    context: {
      textChannelId?: string;
      voiceChannelId?: string;
      voiceChannelName?: string;
    },
  ): GuildMusicSession {
    const session = this.getOrCreate(guildId);

    if (context.textChannelId) {
      session.textChannelId = context.textChannelId;
    }

    if (context.voiceChannelId) {
      session.voiceChannelId = context.voiceChannelId;
    }

    if (context.voiceChannelName) {
      session.voiceChannelName = context.voiceChannelName;
    }

    return session;
  }

  setState(guildId: string, state: PlaybackState): GuildMusicSession {
    const session = this.getOrCreate(guildId);
    session.state = state;
    return session;
  }

  values(): GuildMusicSession[] {
    return [...this.sessions.values()];
  }
}
