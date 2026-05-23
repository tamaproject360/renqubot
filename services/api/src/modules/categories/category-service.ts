import type { IAppConfig } from '../../contracts/config';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type ICategoryCreateInput,
  type ICategoryListResponse,
  type ICategoryUpdateInput,
  type ITransactionCategory,
} from '../../contracts/categories';
import { DatabaseService } from '../database/database-service';

const defaultCategories: ICategoryCreateInput[] = [
  {
    type: 'PENGELUARAN',
    name: 'Bahan Makanan',
    icon: '🥦',
    description: 'Belanja bahan makanan harian atau bulanan.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PENGELUARAN',
    name: 'Tagihan Rumah',
    icon: '💡',
    description: 'Listrik, air, internet, dan tagihan rumah lain.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PENGELUARAN',
    name: 'Kebutuhan Rumah Tangga',
    icon: '🧹',
    description: 'Perlengkapan rumah dan kebutuhan operasional rumah.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PENGELUARAN',
    name: 'Makan di Luar & Delivery',
    icon: '🍔',
    description: 'Makan di luar, delivery, dan jajan.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PENGELUARAN',
    name: 'Hobby & Hiburan',
    icon: '🎮',
    description: 'Hiburan, rekreasi, dan kebutuhan hobi.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PENGELUARAN',
    name: 'Lainnya',
    icon: '✍️',
    description: 'Pengeluaran lain yang belum punya kategori khusus.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PEMASUKAN',
    name: 'Gaji',
    icon: '💼',
    description: 'Pendapatan utama dari pekerjaan.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PEMASUKAN',
    name: 'Bonus',
    icon: '🎁',
    description: 'Bonus, insentif, dan pendapatan tambahan.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
  {
    type: 'PEMASUKAN',
    name: 'Donasi',
    icon: '🙏',
    description: 'Pemasukan berupa donasi atau pemberian.',
    isActive: true,
    budgetEnabled: false,
    budgetAmount: 0,
  },
];

export class CategoryService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async listCategories(
    config: IAppConfig,
  ): Promise<ICategoryListResponse> {
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureCategoriesTable(sql);
    await this.ensureTransactionsTable(sql);
    await this.seedDefaults(sql);

    const items = await sql<ITransactionCategory[]>`
      SELECT
        c.*,
        COALESCE(SUM(CASE
          WHEN t.date >= date('now', 'localtime', 'start of month')
           AND t.date < date('now', 'localtime', 'start of month', '+1 month')
          THEN t.amount
          ELSE 0
        END), 0) as usage_this_month,
        COALESCE(SUM(CASE
          WHEN t.date >= date('now', 'localtime', 'start of month')
           AND t.date < date('now', 'localtime', 'start of month', '+1 month')
          THEN 1
          ELSE 0
        END), 0) as transaction_count_this_month
      FROM transaction_categories c
      LEFT JOIN transactions t
        ON t.category = c.name
       AND t.type = c.type
      GROUP BY c.id
      ORDER BY c.type DESC, c.name ASC;
    `;
    await sql.close();

    return { items };
  }

  public async createCategory(config: IAppConfig, payload: unknown) {
    const input = categoryCreateSchema.parse(payload);
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureCategoriesTable(sql);
    await this.ensureTransactionsTable(sql);
    const rows = await sql<ITransactionCategory[]>`
      INSERT INTO transaction_categories ${sql(this.toRow(input))}
      RETURNING *;
    `;
    await sql.close();

    return rows[0];
  }

  public async updateCategory(
    config: IAppConfig,
    id: number,
    payload: unknown,
  ) {
    const input = categoryUpdateSchema.parse(payload);
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureCategoriesTable(sql);
    await this.ensureTransactionsTable(sql);
    const existing = await sql<ITransactionCategory[]>`
      SELECT * FROM transaction_categories WHERE id = ${id} LIMIT 1;
    `;

    if (!existing[0]) {
      await sql.close();
      return null;
    }

    const next = {
      type: input.type ?? existing[0].type,
      name: input.name ?? existing[0].name,
      icon: input.icon ?? existing[0].icon,
      description: input.description ?? existing[0].description ?? '',
      isActive: input.isActive ?? Boolean(existing[0].is_active),
      budgetEnabled: input.budgetEnabled ?? Boolean(existing[0].budget_enabled),
      budgetAmount: input.budgetAmount ?? existing[0].budget_amount,
    };

    const rows = await sql<ITransactionCategory[]>`
      UPDATE transaction_categories
      SET
        type = ${next.type},
        name = ${next.name},
        icon = ${next.icon},
        description = ${next.description},
        is_active = ${next.isActive ? 1 : 0},
        budget_enabled = ${next.budgetEnabled ? 1 : 0},
        budget_amount = ${next.budgetAmount},
        updated_at = unixepoch()
      WHERE id = ${id}
      RETURNING *;
    `;

    if (existing[0].name !== next.name || existing[0].type !== next.type) {
      await sql`
        UPDATE transactions
        SET
          category = ${next.name},
          type = ${next.type},
          updated_at = unixepoch()
        WHERE category = ${existing[0].name}
          AND type = ${existing[0].type};
      `;
    }

    await sql.close();

    return rows[0];
  }

  public async deleteCategory(config: IAppConfig, id: number) {
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await this.ensureCategoriesTable(sql);
    await this.ensureTransactionsTable(sql);
    const rows = await sql<{ id: number }[]>`
      DELETE FROM transaction_categories WHERE id = ${id} RETURNING id;
    `;
    await sql.close();

    return rows[0] ?? null;
  }

  private async ensureCategoriesTable(sql: Bun.SQL) {
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

  private async seedDefaults(sql: Bun.SQL) {
    const rows = await sql<{ total: number }[]>`
      SELECT COUNT(*) as total FROM transaction_categories;
    `;

    if ((rows[0]?.total ?? 0) > 0) {
      return;
    }

    for (const category of defaultCategories) {
      await sql`
        INSERT INTO transaction_categories ${sql(this.toRow(category))}
        ON CONFLICT(type, name) DO NOTHING;
      `;
    }
  }

  private toRow(input: ICategoryCreateInput) {
    return {
      type: input.type,
      name: input.name,
      icon: input.icon,
      description: input.description,
      is_active: input.isActive ? 1 : 0,
      budget_enabled: input.budgetEnabled ? 1 : 0,
      budget_amount: input.budgetAmount,
    };
  }
}
