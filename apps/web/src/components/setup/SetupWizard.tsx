"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SecretInput } from "@/components/ui/SecretInput";
import { SectionCard } from "@/components/ui/SectionCard";
import { WizardStepper } from "@/components/ui/WizardStepper";
import { saveConfigDraft } from "@/lib/admin-api";

const steps = [
  {
    title: "General Config",
    description: "Pilih provider AI aktif, database path, dan whitelist user.",
  },
  {
    title: "AI Provider",
    description: "Isi model, base URL opsional, dan secret provider.",
  },
  {
    title: "Google Sheets",
    description:
      "Isi Spreadsheet ID, sheet name, dan credential service account.",
  },
  {
    title: "WhatsApp",
    description: "Lanjutkan ke halaman WhatsApp untuk scan QR dan cek sesi.",
  },
  {
    title: "Review",
    description: "Validasi readiness sebelum menjalankan bot operasional.",
  },
];

export function SetupWizard() {
  const [saveState, setSaveState] = useState("Belum disimpan");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState("Menyimpan draft...");

    const formData = new FormData(event.currentTarget);
    const allowedUserIds = String(formData.get("allowedUserIds") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      await saveConfigDraft({
        activeAiProvider: String(formData.get("activeAiProvider") ?? "gemini"),
        database: {
          url: String(formData.get("databaseUrl") ?? "file:./data/baileys.db"),
        },
        whatsapp: {
          allowedUserIds,
        },
      });
      setSaveState("Draft konfigurasi tersimpan.");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Gagal menyimpan draft.",
      );
    }
  };

  return (
    <>
      <PageHeader
        description="Wizard awal untuk menyimpan konfigurasi parsial secara bertahap melalui Config Platform backend."
        eyebrow="Setup Wizard"
        title="Konfigurasi Awal"
        action={<span className="badge badge--warning">{saveState}</span>}
      />

      <div className="grid grid--two">
        <SectionCard
          title="Langkah Setup"
          description="Ikuti urutan agar readiness lebih mudah divalidasi."
        >
          <WizardStepper steps={steps} />
        </SectionCard>

        <SectionCard
          title="General Config"
          description="Form MVP untuk konfigurasi non-secret utama."
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <FormField label="Provider AI Aktif">
              <select
                className="select"
                defaultValue="gemini"
                name="activeAiProvider"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai-compatible">OpenAI-compatible</option>
              </select>
            </FormField>
            <FormField label="Database URL">
              <input
                className="input"
                defaultValue="file:./data/baileys.db"
                name="databaseUrl"
              />
            </FormField>
            <FormField
              label="Allowed User IDs"
              hint="Pisahkan setiap user ID dengan koma."
            >
              <input
                className="input"
                name="allowedUserIds"
                placeholder="62812xxxx@s.whatsapp.net"
              />
            </FormField>
            <SecretInput
              label="Gemini API Key"
              placeholder="Masukkan API key"
            />
            <button className="button button--primary" type="submit">
              Simpan Draft
            </button>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
