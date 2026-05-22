"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getBotRuntimeStatus,
  getConfigStatus,
  getSpreadsheetSyncJobs,
  getWhatsappStatus,
  retrySpreadsheetSyncJobs,
  runDiagnostic,
  type IBotRuntimeStatus,
  type IConfigStatus,
  type IDiagnosticResult,
  type ISpreadsheetSyncJob,
  type IWhatsappStatus,
} from "@/lib/admin-api";

const toneFromStatus = (status?: string) => {
  if (status === "healthy" || status === "running" || status === "open") {
    return "success";
  }

  if (status === "unhealthy" || status === "stopped" || status === "close") {
    return "danger";
  }

  return "warning";
};

export function IntegrationsStatus() {
  const [results, setResults] = useState<Record<string, IDiagnosticResult>>({});
  const [config, setConfig] = useState<IConfigStatus | null>(null);
  const [bot, setBot] = useState<IBotRuntimeStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<IWhatsappStatus | null>(null);
  const [jobs, setJobs] = useState<ISpreadsheetSyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const [nextConfig, nextBot, nextWhatsapp, nextJobs] = await Promise.all([
      getConfigStatus(),
      getBotRuntimeStatus(),
      getWhatsappStatus(),
      getSpreadsheetSyncJobs(10),
    ]);

    setConfig(nextConfig);
    setBot(nextBot);
    setWhatsapp(nextWhatsapp);
    setJobs(nextJobs.items);
  };

  const handleRunDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ai, database, spreadsheet] = await Promise.allSettled([
        runDiagnostic("ai"),
        runDiagnostic("database"),
        runDiagnostic("spreadsheet"),
      ]);

      setResults({
        ...(ai.status === "fulfilled" ? { "AI Provider": ai.value } : {}),
        ...(database.status === "fulfilled"
          ? { Database: database.value }
          : {}),
        ...(spreadsheet.status === "fulfilled"
          ? { Spreadsheet: spreadsheet.value }
          : {}),
      });
      await loadStatus();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal menjalankan diagnostics.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async () => {
    try {
      setLoading(true);
      setError(null);
      await retrySpreadsheetSyncJobs();
      await loadStatus();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Gagal retry sync Spreadsheet.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunDiagnostics();
    const interval = window.setInterval(loadStatus, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const integrationCards = [
    {
      title: "AI Provider",
      description: `${config?.config.activeAiProvider ?? "-"} · ${config?.config.ai?.custom?.model || config?.config.ai?.gemini?.model || "model belum tersedia"}`,
      result: results["AI Provider"],
    },
    {
      title: "Database",
      description: config?.config.database?.url ?? "Database belum tersedia",
      result: results.Database,
    },
    {
      title: "Spreadsheet",
      description: config?.config.spreadsheet?.serviceAccountPath
        ? `${config.config.spreadsheet.sheetName} · credential tersimpan`
        : "Credential belum lengkap",
      result: results.Spreadsheet,
    },
  ];
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;

  return (
    <>
      <PageHeader
        description="Monitoring integrasi live: diagnostics backend, runtime bot, WhatsApp, dan antrean Spreadsheet."
        eyebrow="Integration Center"
        title="Status Integrasi"
        action={
          <button
            className="button button--primary"
            disabled={loading}
            onClick={handleRunDiagnostics}
          >
            {loading ? "Running..." : "Run Diagnostics"}
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <div className="grid grid--cards">
        {integrationCards.map((item) => (
          <SectionCard
            key={item.title}
            title={item.title}
            description={item.description}
          >
            <div className="grid">
              <StatusBadge tone={toneFromStatus(item.result?.status)}>
                {item.result?.status ?? "unknown"}
              </StatusBadge>
              <p className="card__meta">
                {item.result?.message ?? "Diagnostics belum tersedia."}
              </p>
            </div>
          </SectionCard>
        ))}

        <SectionCard
          title="WhatsApp"
          description={whatsapp?.lastError ?? "Runtime bridge WhatsApp"}
        >
          <div className="grid">
            <StatusBadge tone={toneFromStatus(whatsapp?.connection)}>
              {whatsapp?.connection ?? "unknown"}
            </StatusBadge>
            <p className="card__meta">
              QR: {whatsapp?.hasQr ? "tersedia" : "tidak aktif"}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Bot Runtime" description={bot?.message ?? "-"}>
          <div className="grid">
            <StatusBadge tone={toneFromStatus(bot?.state)}>
              {bot?.state ?? "unknown"}
            </StatusBadge>
            <p className="card__meta">PID: {bot?.pid ?? "-"}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Spreadsheet Queue"
          description={`${pendingJobs} pending dari ${jobs.length} job terakhir`}
        >
          <div className="grid">
            <StatusBadge tone={pendingJobs > 0 ? "warning" : "success"}>
              {pendingJobs > 0 ? "Needs Retry" : "Synced"}
            </StatusBadge>
            <button
              className="button button--secondary"
              disabled={loading || pendingJobs === 0}
              onClick={handleRetrySync}
              type="button"
            >
              Retry Pending Jobs
            </button>
            {jobs.slice(0, 3).map((job) => (
              <p className="card__meta" key={job.id}>
                #{job.id} {job.status} · attempts {job.attempts}
                {job.last_error ? ` · ${job.last_error}` : ""}
              </p>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
