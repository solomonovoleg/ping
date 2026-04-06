type LogLevel = "debug" | "info" | "warn" | "error";

const rank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  private canLog(level: LogLevel): boolean {
    return rank[level] >= rank[this.level];
  }

  private write(level: LogLevel, message: string, context?: unknown): void {
    if (!this.canLog(level)) return;
    const payload = {
      level,
      message,
      ts: new Date().toISOString(),
      context: context ?? null,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }

  debug(message: string, context?: unknown): void {
    this.write("debug", message, context);
  }
  info(message: string, context?: unknown): void {
    this.write("info", message, context);
  }
  warn(message: string, context?: unknown): void {
    this.write("warn", message, context);
  }
  error(message: string, context?: unknown): void {
    this.write("error", message, context);
  }
}
