"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SummaryStatCard } from "@/components/ui/SummaryStatCard";
import {
  getSpreadsheetSyncJobs,
  getSummary,
  getTransactions,
  retrySpreadsheetSyncJobs,
  type IFinanceSummary,
  type ISpreadsheetSyncJob,
  type ITransactionRecord,
} from "@/lib/admin-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);

const syncTone = (status?: string) => {
  if (status === "synced") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  return "warning";
};

export function TransactionsTable() {
  const [summary, setSummary] = useState<IFinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<ITransactionRecord[]>([]);
  const [jobs, setJobs] = useState<ISpreadsheetSyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [nextSummary, nextTransactions, nextJobs] = await Promise.all([
        getSummary(),
        getTransactions(50),
        getSpreadsheetSyncJobs(20),
      ]);

      setSummary(nextSummary);
      setTransactions(nextTransactions.items);
      setJobs(nextJobs.items);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal memuat transaksi.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      setLoading(true);
      await retrySpreadsheetSyncJobs();
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal retry sinkronisasi Spreadsheet.",
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const stats = [
    {
      label: "Saldo",
      value: summary ? formatCurrency(summary.totalBalance) : "-",
      description: `${summary?.transactionCount ?? 0} transaksi lokal`,
    },
    {
      label: "Pemasukan",
      value: summary ? formatCurrency(summary.totalIncome) : "-",
      description: "Total pemasukan tercatat",
    },
    {
      label: "Pengeluaran",
      value: summary ? formatCurrency(summary.totalExpense) : "-",
      description: "Total pengeluaran tercatat",
    },
    {
      label: "Pending Sync",
      value: String(pendingJobs),
      description: "Antrean Spreadsheet belum sinkron",
    },
  ];

  return (
    <>
      <PageHeader
        description="Listing transaksi live dari SQLite beserta status sinkronisasi Google Spreadsheet. Data refresh otomatis setiap 10 detik."
        eyebrow="Finance Ledger"
        title="Transactions"
        action={
          <button
            className="button button--primary"
            disabled={loading}
            onClick={load}
          >
            {loading ? "Memuat..." : "Refresh"}
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <div className="grid grid--cards">
        {stats.map((stat) => (
          <SummaryStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid--two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Transaksi Terbaru"
          description="Data real dari endpoint /api/transactions."
        >
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi</th>
                <th>Tipe</th>
                <th>Kategori</th>
                <th>Nominal</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length ? (
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.date}</td>
                    <td>{transaction.description ?? "-"}</td>
                    <td>{transaction.type}</td>
                    <td>{transaction.category ?? "-"}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                    <td>
                      <StatusBadge
                        tone={syncTone(
                          transaction.spreadsheet_sync_status ?? undefined,
                        )}
                      >
                        {transaction.spreadsheet_sync_status ?? "unknown"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Belum ada transaksi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="Spreadsheet Sync"
          description="Pantau antrean sinkronisasi dan retry jika ada pending job."
        >
          <div className="grid">
            <StatusBadge tone={pendingJobs > 0 ? "warning" : "success"}>
              {pendingJobs > 0 ? `${pendingJobs} pending` : "All clear"}
            </StatusBadge>
            <button
              className="button button--secondary"
              disabled={loading || pendingJobs === 0}
              onClick={handleRetry}
              type="button"
            >
              Retry Pending Sync
            </button>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length ? (
                  jobs.slice(0, 8).map((job) => (
                    <tr key={job.id}>
                      <td>#{job.id}</td>
                      <td>
                        <StatusBadge tone={syncTone(job.status)}>
                          {job.status}
                        </StatusBadge>
                      </td>
                      <td>{job.attempts}</td>
                      <td>{job.last_error ?? "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Belum ada sync job.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
