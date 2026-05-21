export interface ITransactionRecord {
  id: number;
  type: 'PENGELUARAN' | 'PEMASUKAN';
  category: string | null;
  amount: number;
  date: string;
  description: string | null;
  merchant_or_sender: string | null;
  created_at: number;
  updated_at: number;
}

export interface ITransactionListResponse {
  items: ITransactionRecord[];
  limit: number;
}

export interface IFinanceSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  latestTransactions: ITransactionRecord[];
}
