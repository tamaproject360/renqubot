import type { IAIResponse } from '../ai';
import { sql, type ITransaction } from '../db';
import { logger } from '../logger';
import {
  appendTransactionRowToSheet,
  clearTransactionSheet,
  resetTransactionSheet,
} from './client';
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

export const resetSheetFromTransactions = async () => {
  if (!SPREADSHEET_ID || !GCLOUD_KEY_PATH) {
    throw new Error('Spreadsheet config is incomplete.');
  }

  const transactions = await sql<ITransaction[]>`
    SELECT * FROM transactions ORDER BY date ASC, id ASC;
  `;
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type,
    transaction.category,
    transaction.amount,
    transaction.merchant_or_sender,
    transaction.description,
  ]);

  await resetTransactionSheet(rows);
  await sql`UPDATE transactions SET spreadsheet_sync_status = 'synced', updated_at = unixepoch();`;

  logger.info('Spreadsheet reset from local transactions', {
    module: 'Spreadsheet',
    totalTransactions: transactions.length,
  });

  return transactions.length;
};

export const clearSheetForFreshStart = async () => {
  if (!SPREADSHEET_ID || !GCLOUD_KEY_PATH) {
    throw new Error('Spreadsheet config is incomplete.');
  }

  await clearTransactionSheet();

  logger.info('Spreadsheet cleared for fresh start', {
    module: 'Spreadsheet',
  });
};
