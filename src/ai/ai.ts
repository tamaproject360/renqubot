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
import {
  AI_PROVIDER,
  ANTHROPIC_API_KEY,
  ANTHROPIC_BASE_URL,
  ANTHROPIC_MODEL,
  CUSTOM_API_KEY,
  CUSTOM_BASE_URL,
  CUSTOM_MODEL,
  GEMINI_API_KEY,
  GEMINI_HOST,
  GEMINI_MODEL,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_MODEL,
} from '../config';
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

interface IOpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface IAnthropicMessageResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

const systemInstructions = SYSTEM_PROMPT;

const getTextContent = (msg: IBotMessage | string) => {
  if (typeof msg === 'string') {
    return msg;
  }

  return msg.message ?? 'Analisis gambar ini';
};

const joinUrl = (baseUrl: string, path: string) => {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
};

const readJsonResponse = async <T>(response: Response) => {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `Provider returned non-JSON response (${response.status}): ${text.slice(0, 240)}`,
    );
  }
};

const buildContextualSystemInstruction = async () => {
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

  return systemInstructions + additionalContexts;
};

const generateGeminiContent = async (
  msg: IBotMessage | string,
  systemInstruction: string,
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

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  return response.text ?? null;
};

const generateOpenAICompatibleContent = async (
  msg: IBotMessage | string,
  systemInstruction: string,
  options: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    providerName: string;
  },
) => {
  if (!options.apiKey) {
    throw new Error(`${options.providerName} API key is not set`);
  }

  if (!options.baseUrl) {
    throw new Error(`${options.providerName} base URL is not set`);
  }

  if (!options.model) {
    throw new Error(`${options.providerName} model is not set`);
  }

  const content =
    typeof msg !== 'string' && msg.image
      ? [
          { type: 'text', text: getTextContent(msg) },
          {
            type: 'image_url',
            image_url: {
              url: `data:${msg.image.mimeType};base64,${msg.image.data}`,
            },
          },
        ]
      : getTextContent(msg);
  const body = {
    model: options.model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content },
    ],
  };
  const sendRequest = async (forceJson: boolean) => {
    return fetch(joinUrl(options.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        ...(forceJson ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  };

  let response = await sendRequest(true);
  let data = await readJsonResponse<IOpenAIChatResponse>(response);

  if (!response.ok && data.error?.message?.includes('response_format')) {
    response = await sendRequest(false);
    data = await readJsonResponse<IOpenAIChatResponse>(response);
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ?? `${options.providerName} request failed`,
    );
  }

  return data.choices?.[0]?.message?.content ?? null;
};

const generateAnthropicContent = async (
  msg: IBotMessage | string,
  systemInstruction: string,
) => {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }

  const content =
    typeof msg !== 'string' && msg.image
      ? [
          { type: 'text', text: getTextContent(msg) },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: msg.image.mimeType,
              data: msg.image.data,
            },
          },
        ]
      : [{ type: 'text', text: getTextContent(msg) }];
  const response = await fetch(joinUrl(ANTHROPIC_BASE_URL, '/v1/messages'), {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: `${systemInstruction}\n\nBalas hanya JSON valid tanpa markdown fence.`,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }),
  });
  const data = (await response.json()) as IAnthropicMessageResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Anthropic request failed');
  }

  return (
    data.content
      ?.filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n') ?? null
  );
};

const generateModelContent = async (
  msg: IBotMessage | string,
  systemInstruction: string,
) => {
  if (AI_PROVIDER === 'openai') {
    return generateOpenAICompatibleContent(msg, systemInstruction, {
      apiKey: OPENAI_API_KEY,
      baseUrl: OPENAI_BASE_URL,
      model: OPENAI_MODEL,
      providerName: 'OpenAI',
    });
  }

  if (AI_PROVIDER === 'anthropic') {
    return generateAnthropicContent(msg, systemInstruction);
  }

  if (AI_PROVIDER === 'openai-compatible') {
    return generateOpenAICompatibleContent(msg, systemInstruction, {
      apiKey: CUSTOM_API_KEY,
      baseUrl: CUSTOM_BASE_URL,
      model: CUSTOM_MODEL,
      providerName: 'OpenAI-compatible provider',
    });
  }

  return generateGeminiContent(msg, systemInstruction);
};

export const generateResponse = async (
  msg: IBotMessage | string,
  options: IGenerateResponseOptions = {},
) => {
  const systemInstruction = await buildContextualSystemInstruction();

  const result = await withRetry(
    async () => generateModelContent(msg, systemInstruction),
    {
      attempts: 3,
      baseDelayMs: 1_000,
      module: 'AI',
      operation: `${AI_PROVIDER}.generateContent`,
    },
  );

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
