type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  module: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

function formatLog(entry: LogEntry): string {
  const base = `[${entry.module}] ${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;
  return entry.data ? `${base} ${JSON.stringify(entry.data)}` : base;
}

export function createLogger(module: string) {
  const log = (level: LogLevel, message: string, data?: any) => {
    const entry: LogEntry = {
      module,
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    const formatted = formatLog(entry);
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  };
  return {
    debug: (msg: string, data?: any) => log('debug', msg, data),
    info: (msg: string, data?: any) => log('info', msg, data),
    warn: (msg: string, data?: any) => log('warn', msg, data),
    error: (msg: string, data?: any) => log('error', msg, data),
  };
}
