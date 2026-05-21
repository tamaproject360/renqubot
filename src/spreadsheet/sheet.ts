import type { IAIResponse } from '../ai';
import { logger } from '../logger';
import { appendTransactionRowToSheet } from './client';
import { GCLOUD_KEY_PATH, SPREADSHEET_ID } from './config';
import { enqueueSpreadsheetSyncJob } from './sync-queue';

export const saveToSheetDirect = async (data: IAIResponse) => {
  if (!data.is_transaction || !data.transaction_data) return;

  const t = data.transaction_data;

  const rowData = [
    t.date || new Date().toISOString().split('T')[0] || null,
    t.type,
    t.category,
    t.amount,
    t.merchant_or_sender,
    t.description,
  ];

  if (!SPREADSHEET_ID || !GCLOUD_KEY_PATH) {
    await enqueueSpreadsheetSyncJob(
      {
        date: t.date ?? null,
        type: t.type ?? null,
        category: t.category ?? null,
        amount: t.amount ?? null,
        merchant_or_sender: t.merchant_or_sender ?? null,
        description: t.description ?? null,
      },
      'Spreadsheet config is incomplete',
    );

    logger.warn('Spreadsheet config incomplete, queued sync job', {
      module: 'Spreadsheet',
    });

    return false;
  }

  try {
    await appendTransactionRowToSheet(rowData);

    logger.info('Transaction appended to spreadsheet', {
      module: 'Spreadsheet',
    });

    return true;
  } catch (error) {
    await enqueueSpreadsheetSyncJob(
      {
        date: t.date ?? null,
        type: t.type ?? null,
        category: t.category ?? null,
        amount: t.amount ?? null,
        merchant_or_sender: t.merchant_or_sender ?? null,
        description: t.description ?? null,
      },
      error instanceof Error ? error.message : 'Unknown spreadsheet error',
    );

    logger.error('Spreadsheet append failed, queued sync job', {
      module: 'Spreadsheet',
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
};
