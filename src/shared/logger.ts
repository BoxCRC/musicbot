export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  meta?: string;
}

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

// ── 环形缓冲区 ──
const LOG_BUFFER_SIZE = 500;
const logBuffer: LogEntry[] = [];
let logIdCounter = 0;
const subscribers = new Set<(entry: LogEntry) => void>();

function pushLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  for (const fn of subscribers) {
    try {
      fn(entry);
    } catch {
      // 防止订阅者异常影响日志写入
    }
  }
}

export function getRecentLogs(count = 100, afterId?: number): LogEntry[] {
  let entries = logBuffer;
  if (afterId !== undefined) {
    entries = entries.filter((e) => e.id > afterId);
  }
  return entries.slice(-count);
}

export function subscribeLog(fn: (entry: LogEntry) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

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

    const entry: LogEntry = {
      id: ++logIdCounter,
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      message,
      meta: meta !== undefined ? String(meta).slice(0, 500) : undefined,
    };

    pushLog(entry);

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.scope}]`;

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
