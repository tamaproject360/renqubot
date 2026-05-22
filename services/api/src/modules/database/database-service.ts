import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { IAppConfig } from '../../contracts/config';
import type { IDiagnosticResult } from '../../contracts/diagnostics';

export class DatabaseService {
  public async runDiagnostics(config: IAppConfig): Promise<IDiagnosticResult> {
    const checkedAt = new Date().toISOString();

    try {
      await this.ensureSqliteDirectory(config.database.url);
      const sql = new Bun.SQL(config.database.url);
      await sql.connect();
      await sql`SELECT 1 as ok;`;
      await sql.close();

      return {
        status: 'healthy',
        message: 'Database SQLite dapat diakses.',
        details: {
          url: config.database.url,
        },
        checkedAt,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database SQLite tidak dapat diakses.',
        details: {
          url: config.database.url,
          error: error instanceof Error ? error.message : String(error),
        },
        checkedAt,
      };
    }
  }

  public createSql(url: string) {
    return new Bun.SQL(url);
  }

  private async ensureSqliteDirectory(databaseUrl: string) {
    if (databaseUrl === ':memory:') {
      return;
    }

    const filePath = this.getSqliteFilePath(databaseUrl);

    if (!filePath) {
      return;
    }

    await mkdir(dirname(filePath), { recursive: true });
  }

  private getSqliteFilePath(databaseUrl: string) {
    if (databaseUrl.startsWith('sqlite://')) {
      return databaseUrl.replace(/^sqlite:\/\//, '').split('?')[0] ?? '';
    }

    if (databaseUrl.startsWith('file:')) {
      return databaseUrl.replace(/^file:/, '').split('?')[0] ?? '';
    }

    return '';
  }
}
