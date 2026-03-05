type LogLevel = "debug" | "info" | "warn" | "error"

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info"

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= (LEVELS[currentLevel] ?? LEVELS.info)
}

function formatMessage(level: LogLevel, data: Record<string, unknown>, msg?: string) {
  try {
    const entry = {
      level,
      time: Date.now(),
      ...(msg ? { msg } : {}),
      ...data,
    }
    return JSON.stringify(entry)
  } catch {
    return JSON.stringify({ level, time: Date.now(), msg: msg || "log serialization failed" })
  }
}

export const logger = {
  debug(data: Record<string, unknown>, msg?: string) {
    if (shouldLog("debug")) console.debug(formatMessage("debug", data, msg))
  },
  info(data: Record<string, unknown>, msg?: string) {
    if (shouldLog("info")) console.info(formatMessage("info", data, msg))
  },
  warn(data: Record<string, unknown>, msg?: string) {
    if (shouldLog("warn")) console.warn(formatMessage("warn", data, msg))
  },
  error(data: Record<string, unknown>, msg?: string) {
    if (shouldLog("error")) console.error(formatMessage("error", data, msg))
  },
}
