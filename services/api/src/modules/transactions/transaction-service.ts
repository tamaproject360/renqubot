import type { IAppConfig } from '../../contracts/config';
import type {
  IFinanceSummary,
  ITransactionListResponse,
  ITransactionRecord,
} from '../../contracts/transactions';
import { DatabaseService } from '../database/database-service';

export class TransactionService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async listTransactions(
    config: IAppConfig,
    limit: number,
  ): Promise<ITransactionListResponse> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureTransactionsTable(sql);
    const items = await sql<ITransactionRecord[]>`
      SELECT * FROM transactions ORDER BY created_at DESC LIMIT ${safeLimit};
    `;
    await sql.close();

    return {
      items,
      limit: safeLimit,
    };
  }

  public async getSummary(config: IAppConfig): Promise<IFinanceSummary> {
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureTransactionsTable(sql);
    const incomeResult = await sql<{ total_income: number | null }[]>`
      SELECT SUM(amount) as total_income FROM transactions WHERE type = 'PEMASUKAN';
    `;
    const expenseResult = await sql<{ total_expense: number | null }[]>`
      SELECT SUM(amount) as total_expense FROM transactions WHERE type = 'PENGELUARAN';
    `;
    const countResult = await sql<{ transaction_count: number }[]>`
      SELECT COUNT(*) as transaction_count FROM transactions;
    `;
    const latestTransactions = await sql<ITransactionRecord[]>`
      SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;
    `;
    await sql.close();

    const totalIncome = incomeResult[0]?.total_income ?? 0;
    const totalExpense = expenseResult[0]?.total_expense ?? 0;

    return {
      totalBalance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      transactionCount: countResult[0]?.transaction_count ?? 0,
      latestTransactions,
    };
  }

  private async ensureTransactionsTable(sql: Bun.SQL) {
    await sql`CREATE TABLE IF NOT EXISTS "transactions" (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      merchant_or_sender TEXT,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
    ) STRICT;`;

    const transactionColumns = await sql<{ name: string }[]>`
      PRAGMA table_info('transactions');
    `;

    if (
      !transactionColumns.some(
        (column) => column.name === 'spreadsheet_sync_status',
      )
    ) {
      await sql`ALTER TABLE transactions ADD COLUMN spreadsheet_sync_status TEXT DEFAULT 'pending';`;
    }

    if (
      !transactionColumns.some((column) => column.name === 'source_message_id')
    ) {
      await sql`ALTER TABLE transactions ADD COLUMN source_message_id TEXT;`;
    }

    if (!transactionColumns.some((column) => column.name === 'sender')) {
      await sql`ALTER TABLE transactions ADD COLUMN sender TEXT;`;
    }

    if (!transactionColumns.some((column) => column.name === 'raw_ai_result')) {
      await sql`ALTER TABLE transactions ADD COLUMN raw_ai_result TEXT;`;
    }

    if (!transactionColumns.some((column) => column.name === 'confidence')) {
      await sql`ALTER TABLE transactions ADD COLUMN confidence REAL DEFAULT 0;`;
    }

    if (!transactionColumns.some((column) => column.name === 'processed_at')) {
      await sql`ALTER TABLE transactions ADD COLUMN processed_at TEXT;`;
    }

    if (
      !transactionColumns.some((column) => column.name === 'transaction_code')
    ) {
      await sql`ALTER TABLE transactions ADD COLUMN transaction_code TEXT;`;
    }

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_source_message_id ON transactions(source_message_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_transaction_code ON transactions(transaction_code);`;
    await this.backfillTransactionCodes(sql);
  }

  private async backfillTransactionCodes(sql: Bun.SQL) {
    const rows = await sql<
      { id: number; date: string; type: 'PENGELUARAN' | 'PEMASUKAN' }[]
    >`
      SELECT id, date, type
      FROM transactions
      WHERE transaction_code IS NULL OR transaction_code = ''
      ORDER BY date ASC, type ASC, id ASC;
    `;
    const counters = new Map<string, number>();

    for (const row of rows) {
      const key = `${row.date}-${row.type}`;
      const nextSequence = (counters.get(key) ?? 0) + 1;
      counters.set(key, nextSequence);

      await sql`
        UPDATE transactions
        SET transaction_code = ${this.buildTransactionCode(
          row.date,
          row.type,
          nextSequence,
        )}
        WHERE id = ${row.id};
      `;
    }
  }

  private buildTransactionCode(
    date: string,
    type: 'PENGELUARAN' | 'PEMASUKAN',
    sequence: number,
  ) {
    const [year, month, day] = date.split('-');

    return `${day}${month}${year}${type === 'PEMASUKAN' ? 'pm' : 'pe'}${sequence}`;
  }
}
