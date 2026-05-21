type LogLevel = 'info' | 'warn' | 'error';

interface ILogContext {
  module: string;
  correlationId?: string;
  [key: string]: unknown;
}

const sanitize = (value: ILogContext): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/key|secret|token|password|credential/i.test(key)) {
        return [key, '[REDACTED]'];
      }

      return [key, item];
    }),
  );
};

const log = (level: LogLevel, message: string, context: ILogContext) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(context),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
};

export const logger = {
  info: (message: string, context: ILogContext) =>
    log('info', message, context),
  warn: (message: string, context: ILogContext) =>
    log('warn', message, context),
  error: (message: string, context: ILogContext) =>
    log('error', message, context),
};
