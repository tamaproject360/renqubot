"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SummaryStatCard } from "@/components/ui/SummaryStatCard";
import {
  getBotRuntimeStatus,
  getHealth,
  getSpreadsheetSyncJobs,
  getSummary,
  getWhatsappStatus,
  type IBotRuntimeStatus,
  type IFinanceSummary,
  type IHealthSummary,
  type ISpreadsheetSyncJob,
  type IWhatsappStatus,
} from "@/lib/admin-api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);

const toneFromStatus = (status?: string) => {
  if (status === "healthy" || status === "running" || status === "open") {
    return "success";
  }

  if (status === "unhealthy" || status === "stopped" || status === "close") {
    return "danger";
  }

  return "warning";
};

export function DashboardOverview() {
  const [summary, setSummary] = useState<IFinanceSummary | null>(null);
  const [health, setHealth] = useState<IHealthSummary | null>(null);
  const [bot, setBot] = useState<IBotRuntimeStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<IWhatsappStatus | null>(null);
  const [syncJobs, setSyncJobs] = useState<ISpreadsheetSyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [nextSummary, nextHealth, nextBot, nextWhatsapp, nextJobs] =
          await Promise.all([
            getSummary(),
            getHealth(),
            getBotRuntimeStatus(),
            getWhatsappStatus(),
            getSpreadsheetSyncJobs(5),
          ]);

        if (!active) {
          return;
        }

        setSummary(nextSummary);
        setHealth(nextHealth);
        setBot(nextBot);
        setWhatsapp(nextWhatsapp);
        setSyncJobs(nextJobs.items);
        setError(null);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Gagal memuat dashboard.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    const interval = window.setInterval(load, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const pendingJobs = syncJobs.filter((job) => job.status === "pending").length;
  const stats = [
    {
      label: "Saldo",
      value: summary ? formatCurrency(summary.totalBalance) : "-",
      description: `${summary?.transactionCount ?? 0} transaksi tercatat`,
    },
    {
      label: "Pemasukan",
      value: summary ? formatCurrency(summary.totalIncome) : "-",
      description: "Total pemasukan lokal SQLite",
    },
    {
      label: "Pengeluaran",
      value: summary ? formatCurrency(summary.totalExpense) : "-",
      description: "Total pengeluaran lokal SQLite",
    },
    {
      label: "Sync Jobs",
      value: String(pendingJobs),
      description: "Job Spreadsheet berstatus pending",
    },
  ];

  return (
    <>
      <PageHeader
        description="Pantau readiness sistem, koneksi integrasi, dan status operasional bot dari satu console. Data diperbarui otomatis setiap 10 detik."
        eyebrow="Executive Overview"
        title="Dashboard Operasional"
        action={
          <span className="badge badge--warning">
            {loading ? "Memuat..." : "Live"}
          </span>
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
          title="Readiness Checklist"
          description="Status live komponen utama backend dan runtime."
        >
          <div className="grid">
            <div>
              <StatusBadge tone={toneFromStatus(health?.status)}>
                Health: {health?.status ?? "unknown"}
              </StatusBadge>
            </div>
            <div>
              <StatusBadge tone={toneFromStatus(bot?.state)}>
                Bot: {bot?.state ?? "unknown"}
              </StatusBadge>
            </div>
            <div>
              <StatusBadge tone={toneFromStatus(whatsapp?.connection)}>
                WhatsApp: {whatsapp?.connection ?? "unknown"}
              </StatusBadge>
            </div>
            {health?.components.map((component) => (
              <p className="card__meta" key={component.name}>
                {component.name}: {component.message}
              </p>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Transaksi Terbaru"
          description="Data live dari SQLite lokal."
        >
          <div className="grid">
            {summary?.latestTransactions.length ? (
              summary.latestTransactions.slice(0, 5).map((transaction) => (
                <div className="review-item" key={transaction.id}>
                  <span>
                    {transaction.date} · {transaction.category ?? "-"}
                  </span>
                  <strong>{formatCurrency(transaction.amount)}</strong>
                </div>
              ))
            ) : (
              <p className="card__meta">Belum ada transaksi.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
