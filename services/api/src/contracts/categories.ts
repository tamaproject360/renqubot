import { z } from 'zod';

export const categoryTypeSchema = z.enum(['PENGELUARAN', 'PEMASUKAN']);

export const categoryCreateSchema = z.object({
  type: categoryTypeSchema,
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(16).default('🏷️'),
  description: z.string().trim().max(500).default(''),
  isActive: z.boolean().default(true),
  budgetEnabled: z.boolean().default(false),
  budgetAmount: z.number().min(0).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export interface ITransactionCategory {
  id: number;
  type: 'PENGELUARAN' | 'PEMASUKAN';
  name: string;
  icon: string;
  description: string | null;
  is_active: number;
  budget_enabled: number;
  budget_amount: number;
  usage_this_month: number;
  transaction_count_this_month: number;
  created_at: number;
  updated_at: number;
}

export interface ICategoryListResponse {
  items: ITransactionCategory[];
}

export type ICategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type ICategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
