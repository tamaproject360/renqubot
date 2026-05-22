import type { IAIResponse, ITransactionData } from './promt';

export interface IAIValidationResult {
  data: IAIResponse | null;
  error: string | null;
}

const FALLBACK_REPLY =
  'Maaf, hasil analisis saya belum valid untuk dicatat. Tolong kirim ulang dengan nominal, tanggal bila ada, dan keterangan transaksi yang lebih jelas.';

const transactionTypes = new Set(['PENGELUARAN', 'PEMASUKAN']);

/**
 * Parse dan validasi response JSON model agar data tidak langsung masuk DB tanpa schema guard.
 */
export const parseAiResponse = (raw: string): IAIValidationResult => {
  const jsonText = extractJsonPayload(raw);

  try {
    return validateAiResponse(JSON.parse(jsonText));
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Invalid JSON response',
    };
  }
};

const extractJsonPayload = (raw: string) => {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

/**
 * Membuat fallback aman saat model mengembalikan JSON invalid atau field wajib hilang.
 */
export const createInvalidAiFallback = (): IAIResponse => ({
  is_transaction: false,
  reply_text: FALLBACK_REPLY,
  transaction_data: null,
  confidence: 0,
});

/**
 * Normalisasi tanggal transaksi ke YYYY-MM-DD untuk query harian dan Google Sheet.
 */
export const normalizeTransactionDate = (
  date: string | null | undefined,
  fallbackDate = new Date(),
) => {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const parsedDate = date ? new Date(date) : fallbackDate;
  const safeDate = Number.isNaN(parsedDate.getTime())
    ? fallbackDate
    : parsedDate;

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(safeDate);
};

const validateAiResponse = (value: unknown): IAIValidationResult => {
  if (!isRecord(value)) {
    return { data: null, error: 'AI response must be an object' };
  }

  if (typeof value.is_transaction !== 'boolean') {
    return { data: null, error: 'is_transaction must be boolean' };
  }

  if (typeof value.reply_text !== 'string' || !value.reply_text.trim()) {
    return { data: null, error: 'reply_text must be a non-empty string' };
  }

  const confidence = normalizeConfidence(
    value.confidence,
    value.is_transaction,
  );

  if (!value.is_transaction) {
    return {
      data: {
        is_transaction: false,
        reply_text: value.reply_text,
        transaction_data: null,
        confidence,
      },
      error: null,
    };
  }

  const transactionData = validateTransactionData(value.transaction_data);

  if (!transactionData) {
    return { data: null, error: 'transaction_data is incomplete or invalid' };
  }

  return {
    data: {
      is_transaction: true,
      reply_text: value.reply_text,
      transaction_data: transactionData,
      confidence,
    },
    error: null,
  };
};

const validateTransactionData = (value: unknown): ITransactionData | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.type !== 'string' ||
    !transactionTypes.has(value.type) ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0
  ) {
    return null;
  }

  return {
    type: value.type as ITransactionData['type'],
    amount: value.amount,
    category: optionalString(value.category),
    date: optionalString(value.date),
    description: optionalString(value.description),
    merchant_or_sender: optionalString(value.merchant_or_sender),
  };
};

const normalizeConfidence = (value: unknown, isTransaction: boolean) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 1);
  }

  return isTransaction ? 0.75 : 0.8;
};

const optionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
