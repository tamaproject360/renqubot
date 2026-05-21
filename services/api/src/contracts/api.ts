export interface IApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface IApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: IApiError | null;
}

export const successEnvelope = <T>(data: T): IApiEnvelope<T> => {
  return {
    success: true,
    data,
    error: null,
  };
};

export const errorEnvelope = (
  code: string,
  message: string,
  details?: unknown,
): IApiEnvelope<null> => {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  };
};
