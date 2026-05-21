interface IRetryOptions {
  attempts: number;
  baseDelayMs: number;
  module: string;
  operation: string;
}

export const withRetry = async <T>(
  task: () => Promise<T>,
  options: IRetryOptions,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === options.attempts) {
        break;
      }

      await Bun.sleep(options.baseDelayMs * attempt);
    }
  }

  throw lastError;
};
