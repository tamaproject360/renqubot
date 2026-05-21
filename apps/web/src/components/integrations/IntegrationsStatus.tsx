"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { type IDiagnosticResult, runDiagnostic } from "@/lib/admin-api";

const integrations = [
  ["AI Provider", "Validasi provider aktif, model, dan API key.", "warning"],
  ["Database", "Cek koneksi SQLite dan writable directory.", "success"],
  ["Spreadsheet", "Validasi Spreadsheet ID dan service account.", "warning"],
  ["WhatsApp", "Pantau sesi, QR, dan reset session.", "warning"],
] as const;

export function IntegrationsStatus() {
  const [results, setResults] = useState<Record<string, IDiagnosticResult>>({});

  const handleRunDiagnostics = async () => {
    const [ai, database, spreadsheet] = await Promise.allSettled([
      runDiagnostic("ai"),
      runDiagnostic("database"),
      runDiagnostic("spreadsheet"),
    ]);

    setResults({
      ...(ai.status === "fulfilled" ? { "AI Provider": ai.value } : {}),
      ...(database.status === "fulfilled" ? { Database: database.value } : {}),
      ...(spreadsheet.status === "fulfilled"
        ? { Spreadsheet: spreadsheet.value }
        : {}),
    });
  };

  return (
    <>
      <PageHeader
        description="Halaman monitoring integrasi untuk menjalankan diagnostics backend dan membaca status komponen penting."
        eyebrow="Integration Center"
        title="Status Integrasi"
        action={
          <button
            className="button button--primary"
            onClick={handleRunDiagnostics}
          >
            Run Diagnostics
          </button>
        }
      />

      <div className="grid grid--cards">
        {integrations.map(([title, description, tone]) => (
          <SectionCard key={title} title={title} description={description}>
            <div className="grid">
              <StatusBadge
                tone={results[title]?.status === "healthy" ? "success" : tone}
              >
                {results[title]?.status ??
                  (tone === "success" ? "Ready" : "Needs Review")}
              </StatusBadge>
              {results[title]?.message ? (
                <p className="card__meta">{results[title].message}</p>
              ) : null}
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
