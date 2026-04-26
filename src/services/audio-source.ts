import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { EventEmitter } from "events";
import type { PlaybackTrack } from "../music/types";
import type { AppLogger } from "../shared/logger";

export type AudioSourceCloseReason = "finished" | "skip" | "stop" | "error";

export type AudioSourceClosedEvent = {
  reason: AudioSourceCloseReason;
  error?: Error;
};

export interface ActiveAudioSource {
  readonly track: PlaybackTrack;
  readonly state: "playing" | "paused" | "stopped";
  on(event: "closed", listener: (payload: AudioSourceClosedEvent) => void): this;
  once(event: "closed", listener: (payload: AudioSourceClosedEvent) => void): this;
  on(event: "firstData", listener: () => void): this;
  once(event: "firstData", listener: () => void): this;
  pause(): void;
  resume(): void;
  stop(reason?: "skip" | "stop"): Promise<void>;
}

class FfmpegAudioSource extends EventEmitter implements ActiveAudioSource {
  private process?: ChildProcessWithoutNullStreams;
  private currentState: "playing" | "paused" | "stopped" = "playing";
  private plannedStopReason?: "skip" | "stop";
  private readonly waiters: Array<() => void> = [];
  private finalized = false;
  private stderrLines: string[] = [];
  private firstDataEmitted = false;

  constructor(
    public readonly track: PlaybackTrack,
    private readonly ffmpegPath: string,
    private readonly logger: AppLogger,
    private readonly onChunk: (chunk: Buffer) => void,
  ) {
    super();
    this.start();
  }

  get state(): "playing" | "paused" | "stopped" {
    return this.currentState;
  }

  pause(): void {
    if (!this.process || this.currentState !== "playing") {
      return;
    }

    this.process.stdout.pause();
    this.currentState = "paused";
  }

  resume(): void {
    if (!this.process || this.currentState !== "paused") {
      return;
    }

    this.process.stdout.resume();
    this.currentState = "playing";
  }

  async stop(reason: "skip" | "stop" = "stop"): Promise<void> {
    if (this.finalized) {
      return;
    }

    this.plannedStopReason = reason;

    if (!this.process || this.process.killed || this.process.exitCode !== null) {
      this.finalize({ reason });
      return;
    }

    const completed = new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });

    this.process.kill();
    await completed;
  }

  private start(): void {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-re",
      "-i",
      this.track.sourceUrl,
      "-vn",
      "-filter:a",
      "loudnorm=I=-16:LRA=11:TP=-1.5,volume=0.2",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "2",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "mp3",
      "pipe:1",
    ];

    this.process = spawn(this.ffmpegPath, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.on("data", (chunk: Buffer) => {
      if (!this.firstDataEmitted) {
        this.firstDataEmitted = true;
        this.emit("firstData");
      }
      this.onChunk(chunk);
    });

    this.process.stderr.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (!line) {
        return;
      }

      this.stderrLines.push(line);
      this.stderrLines = this.stderrLines.slice(-5);
      this.logger.debug("音源转码输出", line);
    });

    this.process.once("error", (error) => {
      this.finalize({ reason: "error", error });
    });

    this.process.once("close", (code) => {
      if (this.plannedStopReason) {
        this.finalize({ reason: this.plannedStopReason });
        return;
      }

      if (code === 0) {
        this.finalize({ reason: "finished" });
        return;
      }

      const stderr = this.stderrLines.join(" | ");
      const error = new Error(stderr || `ffmpeg 退出码异常：${code ?? "unknown"}`);
      this.finalize({ reason: "error", error });
    });
  }

  private finalize(payload: AudioSourceClosedEvent): void {
    if (this.finalized) {
      return;
    }

    this.finalized = true;
    this.currentState = "stopped";
    this.emit("closed", payload);

    while (this.waiters.length > 0) {
      this.waiters.shift()?.();
    }
  }
}

export function createAudioSource(
  track: PlaybackTrack,
  ffmpegPath: string,
  logger: AppLogger,
  onChunk: (chunk: Buffer) => void,
): ActiveAudioSource {
  return new FfmpegAudioSource(track, ffmpegPath, logger.child("audio-source"), onChunk);
}
