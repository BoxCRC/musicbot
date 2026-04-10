export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLogger {
  child(scope: string): AppLogger;
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class ConsoleLogger implements AppLogger {
  constructor(
    private readonly level: LogLevel,
    private readonly scope: string,
  ) {}

  child(scope: string): AppLogger {
    return new ConsoleLogger(this.level, `${this.scope}:${scope}`);
  }

  debug(message: string, meta?: unknown): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    if (levelOrder[level] < levelOrder[this.level]) {
      return;
    }

    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this.scope}]`;

    if (meta === undefined) {
      console.log(`${prefix} ${message}`);
      return;
    }

    console.log(`${prefix} ${message}`, meta);
  }
}

export function createLogger(level: LogLevel): AppLogger {
  return new ConsoleLogger(level, "app");
}
