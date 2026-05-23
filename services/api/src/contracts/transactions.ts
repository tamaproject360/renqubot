export interface ITransactionRecord {
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
