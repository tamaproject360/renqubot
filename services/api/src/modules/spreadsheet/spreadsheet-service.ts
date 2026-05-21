import { readFile } from 'node:fs/promises';
import type { IAppConfig } from '../../contracts/config';
import type { IDiagnosticResult } from '../../contracts/diagnostics';

export class SpreadsheetService {
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
}
