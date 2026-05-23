import { DATABASE_URL } from './config';

const path = DATABASE_URL;
export const sql = new Bun.SQL(path);

if (sql.options.adapter !== 'sqlite') {
  throw new Error('Database adapter harus SQLite.');
}

const defaultTransactionCategories = [
  {
    type: 'PENGELUARAN',
    name: 'Bahan Makanan',
    icon: '🥦',
    description: 'Belanja bahan makanan harian atau bulanan.',
  },
  {
    type: 'PENGELUARAN',
    name: 'Tagihan Rumah',
    icon: '💡',
    description: 'Listrik, air, internet, dan tagihan rumah lain.',
  },
  {
    type: 'PENGELUARAN',
    name: 'Kebutuhan Rumah Tangga',
    icon: '🧹',
    description: 'Perlengkapan rumah dan kebutuhan operasional rumah.',
  },
  {
    type: 'PENGELUARAN',
    name: 'Makan di Luar & Delivery',
    icon: '🍔',
    description: 'Makan di luar, delivery, dan jajan.',
  },
  {
    type: 'PENGELUARAN',
    name: 'Hobby & Hiburan',
    icon: '🎮',
    description: 'Hiburan, rekreasi, dan kebutuhan hobi.',
  },
  {
    type: 'PENGELUARAN',
    name: 'Lainnya',
    icon: '✍️',
    description: 'Pengeluaran lain yang belum punya kategori khusus.',
  },
  {
    type: 'PEMASUKAN',
    name: 'Gaji',
    icon: '💼',
    description: 'Pendapatan utama dari pekerjaan.',
  },
  {
    type: 'PEMASUKAN',
    name: 'Bonus',
    icon: '🎁',
    description: 'Bonus, insentif, dan pendapatan tambahan.',
  },
  {
    type: 'PEMASUKAN',
    name: 'Donasi',
    icon: '🙏',
    description: 'Pemasukan berupa donasi atau pemberian.',
  },
] as const;

export const startMigration = async () => {
  await sql`PRAGMA journal_mode = WAL;`;
  await sql`PRAGMA foreign_keys = OFF;`;
  await sql`PRAGMA synchronous = NORMAL;`;
  await sql`PRAGMA temp_store = MEMORY;`;
  await sql.unsafe(`PRAGMA mmap_size = ${1024 * 1024 * 1024 * 2};`); // 2 GB
  await sql.unsafe(`PRAGMA cache_size = ${1024 * 1024 * 20 * -1};`); // 20 MB

  await sql`CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT PRIMARY KEY,
    "data" TEXT NOT NULL,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "groups" (
    "id" TEXT PRIMARY KEY,
    "data" TEXT NOT NULL,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT PRIMARY KEY,
    "data" TEXT NOT NULL,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

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
  await backfillTransactionCodes();

  await sql`CREATE TABLE IF NOT EXISTS "schema_migrations" (
    "version" TEXT PRIMARY KEY,
    "applied_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "app_config" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "source" TEXT DEFAULT 'db' NOT NULL,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "app_secrets_meta" (
    "key" TEXT PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "masked_value" TEXT NOT NULL,
    "stored_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "app_audit_logs" (
    "id" INTEGER PRIMARY KEY,
    "actor" TEXT DEFAULT 'system' NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await sql`CREATE TABLE IF NOT EXISTS "spreadsheet_sync_jobs" (
    "id" INTEGER PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending' NOT NULL,
    "attempts" INTEGER DEFAULT 0 NOT NULL,
    "last_error" TEXT,
    "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
    "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
  ) STRICT;`;

  await ensureTransactionCategoriesTable();
  await seedDefaultTransactionCategories();
};

export interface ITransaction {
  id: number;
  transaction_code?: string | null;
  type: 'PENGELUARAN' | 'PEMASUKAN';
  category: string | null;
  amount: number;
  date: string;
  description: string | null;
  merchant_or_sender: string | null;
  spreadsheet_sync_status?: string | null;
  source_message_id?: string | null;
  sender?: string | null;
  raw_ai_result?: string | null;
  confidence?: number | null;
  processed_at?: string | null;
  created_at: number;
  updated_at: number;
}

export interface ICurrentCycleCategorySummary {
  type: 'PENGELUARAN' | 'PEMASUKAN';
  category: string;
  total: number;
  transaction_count: number;
}

export interface ICurrentCycleSummary {
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  transactionCount: number;
  firstDate: string | null;
  lastDate: string | null;
  categories: ICurrentCycleCategorySummary[];
  latestTransactions: ITransaction[];
  pendingSyncJobs: number;
}

export interface IActiveTransactionCategory {
  type: 'PENGELUARAN' | 'PEMASUKAN';
  name: string;
  description: string | null;
}

export const ensureTransactionCategoriesTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS "transaction_categories" (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('PENGELUARAN', 'PEMASUKAN')),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🏷️' NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    budget_enabled INTEGER DEFAULT 0 NOT NULL,
    budget_amount REAL DEFAULT 0 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    UNIQUE(type, name)
  ) STRICT;`;
};

export const seedDefaultTransactionCategories = async () => {
  await ensureTransactionCategoriesTable();
  const rows = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM transaction_categories;
  `;

  if ((rows[0]?.total ?? 0) > 0) {
    return;
  }

  for (const category of defaultTransactionCategories) {
    await sql`
      INSERT INTO transaction_categories ${sql({
        ...category,
        is_active: 1,
        budget_enabled: 0,
        budget_amount: 0,
      })}
      ON CONFLICT(type, name) DO NOTHING;
    `;
  }
};

export const getActiveTransactionCategories = async () => {
  await seedDefaultTransactionCategories();
  return await sql<IActiveTransactionCategory[]>`
    SELECT type, name, description
    FROM transaction_categories
    WHERE is_active = 1
    ORDER BY type DESC, name ASC;
  `;
};

export const generateTransactionCode = async (
  date: string,
  type: 'PENGELUARAN' | 'PEMASUKAN',
) => {
  const [year, month, day] = date.split('-');
  const prefix = `${day}${month}${year}${type === 'PEMASUKAN' ? 'pm' : 'pe'}`;
  const rows = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total
    FROM transactions
    WHERE date = ${date}
      AND type = ${type};
  `;

  return `${prefix}${(rows[0]?.total ?? 0) + 1}`;
};

const buildTransactionCode = (
  date: string,
  type: 'PENGELUARAN' | 'PEMASUKAN',
  sequence: number,
) => {
  const [year, month, day] = date.split('-');

  return `${day}${month}${year}${type === 'PEMASUKAN' ? 'pm' : 'pe'}${sequence}`;
};

const backfillTransactionCodes = async () => {
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
      SET transaction_code = ${buildTransactionCode(
        row.date,
        row.type,
        nextSequence,
      )}
      WHERE id = ${row.id};
    `;
  }
};

export const hasTransactionBySourceMessageId = async (
  sourceMessageId: string,
) => {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM transactions WHERE source_message_id = ${sourceMessageId} LIMIT 1;
  `;

  return rows.length > 0;
};

export const resetDatabaseForFreshStart = async () => {
  const transactionCount = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM transactions;
  `;
  const messageCount = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM messages;
  `;
  const syncJobCount = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM spreadsheet_sync_jobs;
  `;

  await sql`DELETE FROM spreadsheet_sync_jobs;`;
  await sql`DELETE FROM transactions;`;
  await sql`DELETE FROM messages;`;
  await sql`DELETE FROM groups;`;

  const sequenceTable = await sql<{ name: string }[]>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence';
  `;

  if (sequenceTable.length > 0) {
    await sql`DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'spreadsheet_sync_jobs');`;
  }

  await sql`VACUUM;`;

  return {
    deletedMessages: messageCount[0]?.total ?? 0,
    deletedSyncJobs: syncJobCount[0]?.total ?? 0,
    deletedTransactions: transactionCount[0]?.total ?? 0,
  };
};

export const getTotalBalance = async () => {
  const incomeResult =
    await sql`SELECT SUM(amount) as total_income FROM transactions WHERE type = 'PEMASUKAN';`;
  const expenseResult =
    await sql`SELECT SUM(amount) as total_expense FROM transactions WHERE type = 'PENGELUARAN';`;

  const totalIncome = incomeResult[0].total_income || 0;
  const totalExpense = expenseResult[0].total_expense || 0;

  return totalIncome - totalExpense;
};

export const getCurrentCycleSummary =
  async (): Promise<ICurrentCycleSummary> => {
    const totals = await sql<
      {
        total_income: number | null;
        total_expense: number | null;
        transaction_count: number;
        first_date: string | null;
        last_date: string | null;
      }[]
    >`
    SELECT
      SUM(CASE WHEN type = 'PEMASUKAN' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'PENGELUARAN' THEN amount ELSE 0 END) as total_expense,
      COUNT(*) as transaction_count,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM transactions;
  `;
    const categories = await sql<ICurrentCycleCategorySummary[]>`
    SELECT
      type,
      COALESCE(NULLIF(category, ''), 'Tanpa kategori') as category,
      SUM(amount) as total,
      COUNT(*) as transaction_count
    FROM transactions
    GROUP BY type, COALESCE(NULLIF(category, ''), 'Tanpa kategori')
    ORDER BY total DESC
    LIMIT 8;
  `;
    const latestTransactions = await sql<ITransaction[]>`
    SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT 5;
  `;
    const pendingSyncJobs = await sql<{ total: number }[]>`
    SELECT COUNT(*) as total FROM spreadsheet_sync_jobs WHERE status = 'pending';
  `;

    const totalIncome = totals[0]?.total_income ?? 0;
    const totalExpense = totals[0]?.total_expense ?? 0;

    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      transactionCount: totals[0]?.transaction_count ?? 0,
      firstDate: totals[0]?.first_date ?? null,
      lastDate: totals[0]?.last_date ?? null,
      categories,
      latestTransactions,
      pendingSyncJobs: pendingSyncJobs[0]?.total ?? 0,
    };
  };

export const getDailySummary = async () => {
  const result = await sql<
    {
      date: string;
      total_income: number;
      total_expense: number;
      net_total: number;
    }[]
  >`WITH RECURSIVE last_days(day_date) AS (
        SELECT date('now', 'localtime', '-45 days')
        UNION ALL
        SELECT date(day_date, '+1 day')
        FROM last_days
        WHERE day_date < date('now', 'localtime')
    )
    SELECT
        d.day_date AS date,
        COALESCE(SUM(CASE WHEN t.type = 'PEMASUKAN' THEN t.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN t.type = 'PENGELUARAN' THEN t.amount ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN t.type = 'PEMASUKAN' THEN t.amount ELSE -t.amount END), 0) AS net_total
    FROM last_days d
    LEFT JOIN transactions t
        ON t.date = d.day_date
    GROUP BY d.day_date
    ORDER BY d.day_date DESC;`;

  return result;
};

export const getTransactions = async (type: string, limit: number) => {
  const transactions = await sql<
    ITransaction[]
  >`SELECT * FROM transactions WHERE type = ${type} ORDER BY date DESC LIMIT ${limit};`;
  return transactions;
};
