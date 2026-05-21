import { sql } from '../db';
import { logger } from '../logger';
import { appendTransactionRowToSheet } from './client';
import { GCLOUD_KEY_PATH, SPREADSHEET_ID } from './config';

export interface ISpreadsheetSyncJobPayload {
  date: string | null;
  type: string | null;
  category: string | null;
  amount: number | null;
  merchant_or_sender: string | null;
  description: string | null;
}

export const enqueueSpreadsheetSyncJob = async (
  payload: ISpreadsheetSyncJobPayload,
  reason: string,
) => {
  await sql`CREATE TABLE IF NOT EXISTS "spreadsheet_sync_jobs" (
    "id" INTEGER PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending' NOT NULL,
    "attempts" INTEGER DEFAULT 0 NOT NULL,
    "last_error" TEXT,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`INSERT INTO spreadsheet_sync_jobs ${sql({
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
    last_error: reason,
  })}`;
};

export const retryPendingSpreadsheetSyncJobs = async (limit = 10) => {
  if (!SPREADSHEET_ID || !GCLOUD_KEY_PATH) {
    logger.warn('Skip spreadsheet retry because config is incomplete', {
      module: 'SpreadsheetSyncQueue',
    });

    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const jobs = await sql<
    {
      id: number;
      payload: string;
      attempts: number;
    }[]
  >`SELECT id, payload, attempts FROM spreadsheet_sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ${limit};`;

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const payload = JSON.parse(job.payload) as ISpreadsheetSyncJobPayload;
      await appendTransactionRowToSheet([
        payload.date,
        payload.type,
        payload.category,
        payload.amount,
        payload.merchant_or_sender,
        payload.description,
      ]);
      await sql`UPDATE spreadsheet_sync_jobs SET status = 'synced', attempts = ${job.attempts + 1}, last_error = NULL, updated_at = unixepoch() WHERE id = ${job.id};`;
      succeeded += 1;
    } catch (error) {
      await sql`UPDATE spreadsheet_sync_jobs SET attempts = ${job.attempts + 1}, last_error = ${error instanceof Error ? error.message : String(error)}, updated_at = unixepoch() WHERE id = ${job.id};`;
      failed += 1;
    }
  }

  logger.info('Spreadsheet sync queue retry completed', {
    module: 'SpreadsheetSyncQueue',
    processed: jobs.length,
    succeeded,
    failed,
  });

  return { processed: jobs.length, succeeded, failed };
};
