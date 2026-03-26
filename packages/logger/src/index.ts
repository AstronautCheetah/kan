// Lightweight logger compatible with Cloudflare Workers
// Replaces Pino — uses console API which Workers support natively

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (
  (typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined) ?? "info"
) as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= (LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info);
}

interface Logger {
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function createLoggerInstance(bindings: Record<string, unknown> = {}): Logger {
  const log = (level: LogLevel, obj: Record<string, unknown>, msg?: string) => {
    if (!shouldLog(level)) return;
    const entry = { level, ...bindings, ...obj, msg };
    switch (level) {
      case "debug":
        console.debug(JSON.stringify(entry));
        break;
      case "info":
        console.log(JSON.stringify(entry));
        break;
      case "warn":
        console.warn(JSON.stringify(entry));
        break;
      case "error":
        console.error(JSON.stringify(entry));
        break;
    }
  };

  return {
    debug: (obj, msg) => log("debug", obj, msg),
    info: (obj, msg) => log("info", obj, msg),
    warn: (obj, msg) => log("warn", obj, msg),
    error: (obj, msg) => log("error", obj, msg),
    child: (childBindings) => createLoggerInstance({ ...bindings, ...childBindings }),
  };
}

export const logger = createLoggerInstance();

export const createLogger = (module: string) => logger.child({ module });
