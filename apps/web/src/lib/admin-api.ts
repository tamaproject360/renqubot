const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface IApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: null | {
    code: string;
    message: string;
    details?: unknown;
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
  qrSvg: string | null;
  expiresAt: string | null;
}

export interface ISecretMeta {
  key: string;
  provider: string;
  maskedValue: string;
  updatedAt: string;
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

export interface IConfigStatus {
  config: Required<IConfigPatch>;
  valid: boolean;
  missingFields: string[];
  fieldIssues: Array<{
    field: string;
    message: string;
  }>;
  secrets: ISecretMeta[];
}

export interface IBotRuntimeStatus {
  state: 'stopped' | 'running';
  pid: number | null;
  startedAt: string | null;
  message: string;
}

export interface ITransactionRecord {
  id: number;
  type: 'PENGELUARAN' | 'PEMASUKAN';
  category: string | null;
  amount: number;
  date: string;
  description: string | null;
  merchant_or_sender: string | null;
  spreadsheet_sync_status?: string | null;
}

export interface IFinanceSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  latestTransactions: ITransactionRecord[];
}

export interface IHealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Array<{
    name: 'database' | 'ai' | 'spreadsheet' | 'whatsapp';
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    message: string;
    checkedAt: string;
  }>;
}

export interface ISpreadsheetSyncJob {
  id: number;
  payload: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
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
    const details = envelope.error?.details
      ? ` Detail: ${JSON.stringify(envelope.error.details)}`
      : '';

    throw new Error(`${envelope.error?.message ?? 'Request gagal.'}${details}`);
  }

  return envelope.data;
};

export const saveConfigDraft = (payload: IConfigPatch) => {
  return fetchApi('/api/config', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const getConfigStatus = () => {
  return fetchApi<IConfigStatus>('/api/config');
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
  return fetchApi<IConfigStatus>('/api/config/google-service-account', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const retrySpreadsheetSyncJobs = () => {
  return fetchApi('/api/spreadsheet-sync/retry', {
    method: 'POST',
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

export const getHealth = () => {
  return fetchApi<IHealthSummary>('/health');
};

export const getSummary = () => {
  return fetchApi<IFinanceSummary>('/api/summary');
};

export const getTransactions = (limit = 10) => {
  return fetchApi<{ items: ITransactionRecord[]; limit: number }>(
    `/api/transactions?limit=${limit}`,
  );
};

export const getSpreadsheetSyncJobs = (limit = 10) => {
  return fetchApi<{ items: ISpreadsheetSyncJob[]; limit: number }>(
    `/api/spreadsheet-sync/jobs?limit=${limit}`,
  );
};
