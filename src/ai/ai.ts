import { GoogleGenAI, type ContentListUnion } from '@google/genai';
import {
  SYSTEM_PROMPT,
  type IAIResponse,
  type ITransactionData,
} from './promt';
import { getDailySummary, getTotalBalance, getTransactions, sql } from '../db';
import { logger } from '../logger';
import { withRetry } from '../retry';
import { saveToSheetDirect } from '../spreadsheet';
import { GEMINI_API_KEY, GEMINI_HOST, GEMINI_MODEL } from '../config';
import {
  createInvalidAiFallback,
  normalizeTransactionDate,
  parseAiResponse,
} from './validation';

export interface IBotMessage {
  message?: string;
  image?: {
    data: string;
    mimeType: string;
  } | null;
}

export interface IGenerateResponseOptions {
  sourceMessageId?: string;
  sender?: string | null;
}

const systemInstructions = SYSTEM_PROMPT;

export const generateResponse = async (
  msg: IBotMessage | string,
  options: IGenerateResponseOptions = {},
) => {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      baseUrl: GEMINI_HOST,
    },
  });

  const contents: ContentListUnion = [];

  if (typeof msg === 'string') {
    contents.push({ text: msg });
  } else if (msg.image) {
    contents.push({
      inlineData: msg.image,
    });
    contents.push({
      text: msg.message ?? 'Analisis gambar ini',
    });
  } else if (msg.message) {
    contents.push({
      text: msg.message,
    });
  }

  if (contents.length === 0) {
    throw new Error('No valid content to generate response');
  }

  const dailySummary = await getDailySummary();
  const totalBalance = await getTotalBalance();
  const latestIncome = await getTransactions('PEMASUKAN', 10);
  const latestExpense = await getTransactions('PENGELUARAN', 10);

  const additionalContexts = `\n\nData Keuanganku saat ini:
- Total Saldo: Rp${totalBalance.toLocaleString('id-ID')}
- Ringkasan Harian:
${dailySummary
  .map(
    (item) =>
      `  - Tanggal: ${item.date}, Pemasukan: Rp${item.total_income.toLocaleString(
        'id-ID',
      )}, Pengeluaran: Rp${item.total_expense.toLocaleString('id-ID')}`,
  )
  .join('\n')}
- 10 Transaksi Pemasukan Terbaru:
${latestIncome
  .map(
    (item) =>
      `  - Rp${item.amount.toLocaleString(
        'id-ID',
      )} ${item.merchant_or_sender ? `dari ${item.merchant_or_sender}` : ''} pada ${item.date} (${item.description})`,
  )
  .join('\n')}
- 10 Transaksi Pengeluaran Terbaru:
${latestExpense
  .map(
    (item) =>
      `  - Rp${item.amount.toLocaleString(
        'id-ID',
      )} ${item.merchant_or_sender ? `ke ${item.merchant_or_sender}` : ''} pada ${item.date} (${item.description})`,
  )
  .join('\n')}`;

  const response = await withRetry(
    async () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents,
        config: {
          systemInstruction: systemInstructions + additionalContexts,
          responseMimeType: 'application/json',
        },
      }),
    {
      attempts: 3,
      baseDelayMs: 1_000,
      module: 'AI',
      operation: 'generateContent',
    },
  );

  const result = response.text;

  if (!result) {
    return null;
  }

  const validation = parseAiResponse(result);

  if (!validation.data) {
    logger.warn('AI response validation failed', {
      module: 'AI',
      error: validation.error,
      sourceMessageId: options.sourceMessageId,
    });

    return createInvalidAiFallback();
  }

  const data = validation.data;

  if (data.is_transaction) {
    const transaction: ITransactionData = {
      amount: data.transaction_data?.amount || 0,
      category: data.transaction_data?.category ?? null,
      date: normalizeTransactionDate(data.transaction_data?.date),
      description: data.transaction_data?.description ?? null,
      type: data.transaction_data?.type ?? null,
      merchant_or_sender: data.transaction_data?.merchant_or_sender ?? null,
    };

    const insertedTransactions = await sql<
      { id: number }[]
    >`INSERT INTO transactions ${sql({
      ...transaction,
      spreadsheet_sync_status: 'pending',
      source_message_id: options.sourceMessageId ?? null,
      sender: options.sender ?? null,
      raw_ai_result: result,
      confidence: data.confidence,
      processed_at: new Date().toISOString(),
    })} ON CONFLICT(source_message_id) DO NOTHING RETURNING id;`;

    if (insertedTransactions.length === 0) {
      logger.info('Duplicate transaction ignored', {
        module: 'AI',
        sourceMessageId: options.sourceMessageId,
      });

      return {
        ...data,
        reply_text: 'Transaksi dari pesan ini sudah pernah dicatat sebelumnya.',
      } satisfies IAIResponse;
    }

    const spreadsheetSynced = await saveToSheetDirect(data);
    const syncStatus = spreadsheetSynced ? 'synced' : 'pending';
    const transactionId = insertedTransactions[0]?.id;

    if (transactionId) {
      await sql`UPDATE transactions SET spreadsheet_sync_status = ${syncStatus}, updated_at = unixepoch() WHERE id = ${transactionId};`;
    }

    logger.info('Transaction persisted', {
      module: 'AI',
      transactionId,
      spreadsheetSyncStatus: syncStatus,
      confidence: data.confidence,
      sourceMessageId: options.sourceMessageId,
    });
  }

  return data;
};
