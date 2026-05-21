type LogLevel = 'info' | 'warn' | 'error';

interface ILogContext {
  module: string;
  correlationId?: string;
  [key: string]: unknown;
}

const sanitize = (context: ILogContext) => {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (/key|secret|token|password|credential/i.test(key)) {
        return [key, '[REDACTED]'];
      }

      return [key, value];
    }),
  );
};

const write = (level: LogLevel, message: string, context: ILogContext) => {
  const payload = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(context),
  });

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  console.info(payload);
};

export const logger = {
  info: (message: string, context: ILogContext) =>
    write('info', message, context),
  warn: (message: string, context: ILogContext) =>
    write('warn', message, context),
  error: (message: string, context: ILogContext) =>
    write('error', message, context),
};
