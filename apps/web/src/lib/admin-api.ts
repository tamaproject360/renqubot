const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface IApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: null | {
    code: string;
    message: string;
  };
}

export interface IDiagnosticResult {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface IWhatsappStatus {
  connection: 'close' | 'connecting' | 'open' | 'unknown';
  lastError: string | null;
  hasQr: boolean;
  qrUpdatedAt: string | null;
  updatedAt: string | null;
}

export interface IWhatsappQrResponse {
  qr: string | null;
  expiresAt: string | null;
}

export interface IConfigPatch {
  activeAiProvider?: string;
  ai?: {
    gemini?: {
      model?: string;
      baseUrl?: string;
    };
    openai?: {
      model?: string;
      baseUrl?: string;
    };
    anthropic?: {
      model?: string;
      baseUrl?: string;
    };
    custom?: {
      name?: string;
      model?: string;
      baseUrl?: string;
    };
  };
  database?: {
    url?: string;
  };
  spreadsheet?: {
    spreadsheetId?: string;
    spreadsheetName?: string;
    sheetName?: string;
    serviceAccountPath?: string;
  };
  whatsapp?: {
    allowedUserIds?: string[];
  };
}

export interface IBotRuntimeStatus {
  state: 'stopped' | 'running';
  pid: number | null;
  startedAt: string | null;
  message: string;
}

export const fetchApi = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as IApiEnvelope<T>;

  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.error?.message ?? 'Request gagal.');
  }

  return envelope.data;
};

export const saveConfigDraft = (payload: IConfigPatch) => {
  return fetchApi('/api/config', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const saveSecret = (payload: { key: string; value: string }) => {
  return fetchApi('/api/config/secrets', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const uploadGoogleServiceAccount = (payload: {
  fileName: string;
  content: string;
}) => {
  return fetchApi('/api/config/google-service-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getBotRuntimeStatus = () => {
  return fetchApi<IBotRuntimeStatus>('/api/bot-runtime/status');
};

export const startBotRuntime = () => {
  return fetchApi<IBotRuntimeStatus>('/api/bot-runtime/start', {
    method: 'POST',
  });
};

export const runDiagnostic = (target: 'ai' | 'database' | 'spreadsheet') => {
  return fetchApi<IDiagnosticResult>(`/api/diagnostics/${target}`);
};

export const getWhatsappStatus = () => {
  return fetchApi<IWhatsappStatus>('/api/whatsapp/status');
};

export const getWhatsappQr = () => {
  return fetchApi<IWhatsappQrResponse>('/api/whatsapp/qr');
};
