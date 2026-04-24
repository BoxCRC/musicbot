import type Koice from "koice";
import type { ActiveAudioSource } from "../services/audio-source";

export type PlaybackState = "idle" | "buffering" | "playing" | "paused";

export type PlaybackTrack = {
  id: string;
  title: string;
  artistNames: string;
  durationMs?: number;
  sourceUrl: string;
  requestedBy: string;
};

export type VoiceChannelRef = {
  id: string;
  name: string;
};

export type GuildMusicSession = {
  guildId: string;
  textChannelId?: string;
  voiceChannelId?: string;
  voiceChannelName?: string;
  queue: PlaybackTrack[];
  currentTrack?: PlaybackTrack;
  connection?: Koice;
  source?: ActiveAudioSource;
  state: PlaybackState;
  idleTimer?: NodeJS.Timeout;
  voiceKeepAliveTimer?: NodeJS.Timeout;
  consecutiveErrors: number;
};
