import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import type { IAppConfig } from '../../contracts/config';
import type { IDiagnosticResult } from '../../contracts/diagnostics';
import { DatabaseService } from '../database/database-service';

interface ISpreadsheetSyncJobRow {
  id: number;
  payload: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export class SpreadsheetService {
  public constructor(private readonly databaseService?: DatabaseService) {}

  public async testConnection(config: IAppConfig): Promise<IDiagnosticResult> {
    const checkedAt = new Date().toISOString();

    if (!config.spreadsheet.spreadsheetId) {
      return {
        status: 'degraded',
        message: 'Spreadsheet ID belum dikonfigurasi.',
        details: {},
        checkedAt,
      };
    }

    if (!config.spreadsheet.serviceAccountPath) {
      return {
        status: 'degraded',
        message: 'Path service account Google belum dikonfigurasi.',
        details: {
          spreadsheetId: config.spreadsheet.spreadsheetId,
        },
        checkedAt,
      };
    }

    try {
      const content = await readFile(
        config.spreadsheet.serviceAccountPath,
        'utf8',
      );
      JSON.parse(content);

      return {
        status: 'healthy',
        message: 'Konfigurasi Spreadsheet dan service account dapat dibaca.',
        details: {
          spreadsheetId: config.spreadsheet.spreadsheetId,
          sheetName: config.spreadsheet.sheetName,
        },
        checkedAt,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message:
          'Service account Google tidak dapat dibaca atau bukan JSON valid.',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        checkedAt,
      };
    }
  }

  public async listSyncJobs(config: IAppConfig, limit = 25) {
    const sql = this.getSql(config);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    await sql.connect();
    await this.ensureSyncJobsTable(sql);
    const jobs = await sql<ISpreadsheetSyncJobRow[]>`
      SELECT * FROM spreadsheet_sync_jobs ORDER BY created_at DESC LIMIT ${safeLimit};
    `;
    await sql.close();

    return {
      items: jobs,
      limit: safeLimit,
    };
  }

  public async retryPendingSyncJobs(config: IAppConfig, limit = 10) {
    const sql = this.getSql(config);
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    await sql.connect();
    await this.ensureSyncJobsTable(sql);
    const jobs = await sql<ISpreadsheetSyncJobRow[]>`
      SELECT * FROM spreadsheet_sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ${safeLimit};
    `;

    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        await this.appendJobPayload(config, job.payload);
        await sql`UPDATE spreadsheet_sync_jobs SET status = 'synced', attempts = ${job.attempts + 1}, last_error = NULL, updated_at = unixepoch() WHERE id = ${job.id};`;
        succeeded += 1;
      } catch (error) {
        await sql`UPDATE spreadsheet_sync_jobs SET attempts = ${job.attempts + 1}, last_error = ${error instanceof Error ? error.message : String(error)}, updated_at = unixepoch() WHERE id = ${job.id};`;
        failed += 1;
      }
    }

    await sql.close();

    return {
      processed: jobs.length,
      succeeded,
      failed,
    };
  }

  private getSql(config: IAppConfig) {
    return (
      this.databaseService?.createSql(config.database.url) ??
      new Bun.SQL(config.database.url)
    );
  }

  private async ensureSyncJobsTable(sql: Bun.SQL) {
    await sql`CREATE TABLE IF NOT EXISTS "spreadsheet_sync_jobs" (
      "id" INTEGER PRIMARY KEY,
      "payload" TEXT NOT NULL,
      "status" TEXT DEFAULT 'pending' NOT NULL,
      "attempts" INTEGER DEFAULT 0 NOT NULL,
      "last_error" TEXT,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
    ) STRICT;`;
  }

  private async appendJobPayload(config: IAppConfig, payloadText: string) {
    if (
      !config.spreadsheet.spreadsheetId ||
      !config.spreadsheet.serviceAccountPath
    ) {
      throw new Error('Spreadsheet config is incomplete.');
    }

    const payload = JSON.parse(payloadText) as {
      date: string | null;
      type: string | null;
      category: string | null;
      amount: number | null;
      merchant_or_sender: string | null;
      description: string | null;
    };
    const auth = new google.auth.GoogleAuth({
      keyFile: config.spreadsheet.serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheet.spreadsheetId,
      range: `${config.spreadsheet.sheetName}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            payload.date,
            payload.type,
            payload.category,
            payload.amount,
            payload.merchant_or_sender,
            payload.description,
          ],
        ],
      },
    });
  }
}
