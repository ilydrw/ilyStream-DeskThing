export interface Logger {
  info: (msg: string, ...rest: unknown[]) => void
  warn: (msg: string, ...rest: unknown[]) => void
  error: (msg: string, ...rest: unknown[]) => void
}

export function createLogger(scope: string): Logger {
  const prefix = `[ilystream:${scope}]`
  return {
    info: (msg, ...rest) => console.log(prefix, msg, ...rest),
    warn: (msg, ...rest) => console.warn(prefix, msg, ...rest),
    error: (msg, ...rest) => console.error(prefix, msg, ...rest)
  }
}
