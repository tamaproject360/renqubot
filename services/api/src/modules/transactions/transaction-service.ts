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
  }
}
