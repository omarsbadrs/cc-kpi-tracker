import pino from "pino"

function createLogger() {
  try {
    const isDev = process.env.NODE_ENV === "development"
    return pino({
      level: process.env.LOG_LEVEL || "info",
      ...(isDev
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : {}),
    })
  } catch {
    // Fallback if pino fails to initialize (e.g., during build)
    return pino({ level: "info" })
  }
}

export const logger = createLogger()
