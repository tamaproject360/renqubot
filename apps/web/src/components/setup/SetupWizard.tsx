"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WizardStepper } from "@/components/ui/WizardStepper";
import {
  getConfigStatus,
  getWhatsappQr,
  getWhatsappStatus,
  retrySpreadsheetSyncJobs,
  saveConfigDraft,
  saveSecret,
  startBotRuntime,
  uploadGoogleServiceAccount,
  type IConfigPatch,
  type IConfigStatus,
  type IWhatsappQrResponse,
  type IWhatsappStatus,
} from "@/lib/admin-api";

const steps = [
  {
    title: "General Config",
    description: "Pilih provider AI, database, dan whitelist user.",
  },
  {
    title: "AI Provider",
    description: "Isi model, base URL opsional, dan API key provider.",
  },
  {
    title: "Google Sheets",
    description: "Isi target spreadsheet dan credential service account.",
  },
  {
    title: "WhatsApp",
    description: "Siapkan sesi WhatsApp sebelum bot dipakai.",
  },
  {
    title: "Review & Start",
    description: "Cek ringkasan lalu nyalakan bot runtime.",
  },
];

interface ISetupFormState {
  activeAiProvider: string;
  databaseUrl: string;
  allowedUserIds: string;
  geminiModel: string;
  geminiBaseUrl: string;
  openaiModel: string;
  openaiBaseUrl: string;
  anthropicModel: string;
  anthropicBaseUrl: string;
  customProviderName: string;
  customModel: string;
  customBaseUrl: string;
  providerApiKey: string;
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName: string;
  serviceAccountFileName: string;
  serviceAccountContent: string;
  serviceAccountPath: string;
}

const initialForm: ISetupFormState = {
  activeAiProvider: "gemini",
  databaseUrl: "sqlite://./data/baileys.db",
  allowedUserIds: "",
  geminiModel: "gemini-2.0-flash-lite",
  geminiBaseUrl: "",
  openaiModel: "gpt-4.1-mini",
  openaiBaseUrl: "",
  anthropicModel: "claude-3-5-haiku-latest",
  anthropicBaseUrl: "",
  customProviderName: "Custom OpenAI-compatible",
  customModel: "",
  customBaseUrl: "",
  providerApiKey: "",
  spreadsheetId: "",
  spreadsheetName: "infos",
  sheetName: "Logs",
  serviceAccountFileName: "google-service-account.json",
  serviceAccountContent: "",
  serviceAccountPath: "",
};

const providerLabels: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compatible": "OpenAI-compatible",
};

export function SetupWizard() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<ISetupFormState>(initialForm);
  const [saveState, setSaveState] = useState("Belum ada perubahan");
  const [stepError, setStepError] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<string | null>(null);
  const [savedSecretKeys, setSavedSecretKeys] = useState<string[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<IWhatsappStatus | null>(
    null,
  );
  const [whatsappQr, setWhatsappQr] = useState<IWhatsappQrResponse | null>(
    null,
  );
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [waitingForWhatsappOpen, setWaitingForWhatsappOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDraft = async () => {
      try {
        setSaveState("Memuat draft tersimpan...");
        const status = await getConfigStatus();

        if (!active) {
          return;
        }

        setForm(buildFormFromConfigStatus(status));
        setSavedSecretKeys(status.secrets.map((secret) => secret.key));
        setSaveState("Draft tersimpan dimuat.");
      } catch (error) {
        if (active) {
          setSaveState(
            error instanceof Error ? error.message : "Gagal memuat draft.",
          );
        }
      }
    };

    loadDraft();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const refreshWhatsapp = async () => {
      try {
        const [nextStatus, nextQr] = await Promise.all([
          getWhatsappStatus(),
          getWhatsappQr(),
        ]);

        if (active) {
          setWhatsappStatus(nextStatus);
          setWhatsappQr(nextQr);
        }
      } catch (error) {
        if (active) {
          setWhatsappStatus(null);
          setWhatsappQr(null);
        }
      }
    };

    refreshWhatsapp();
    const interval = window.setInterval(refreshWhatsapp, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (waitingForWhatsappOpen && whatsappStatus?.connection === "open") {
      setRuntimeState("Bot runtime dan WhatsApp sudah terhubung.");
      setSuccessModalOpen(true);
      setWaitingForWhatsappOpen(false);
    }
  }, [waitingForWhatsappOpen, whatsappStatus?.connection]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSaveState("Auto-save draft...");
        await saveConfigDraft(buildConfigPatch(form, activeStep));
        setSaveState(
          `Draft tersimpan ${new Date().toLocaleTimeString("id-ID")}`,
        );
        setDirty(false);
      } catch (error) {
        setSaveState(
          error instanceof Error ? error.message : "Auto-save draft gagal.",
        );
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [dirty, form]);

  const updateField = (field: keyof ISetupFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStepError(null);
    setDirty(true);
  };

  const uploadServiceAccountFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.name.endsWith(".json")) {
      setStepError(
        "Service account harus berupa file .json dari Google Cloud.",
      );
      return;
    }

    try {
      setSaveState("Mengupload service account...");
      const content = await file.text();
      JSON.parse(content);

      const nextForm = {
        ...form,
        serviceAccountFileName: file.name,
        serviceAccountContent: content,
      };

      await saveConfigDraft(buildConfigPatch(nextForm, 2));
      const status = await uploadGoogleServiceAccount({
        fileName: file.name,
        content,
      });
      await retrySpreadsheetSyncJobs();

      const savedCredentialPath =
        status.config.spreadsheet.serviceAccountPath ?? "";

      setForm({
        ...nextForm,
        providerApiKey: form.providerApiKey,
        serviceAccountContent: "",
        serviceAccountPath: savedCredentialPath,
      });
      setStepError(null);
      setDirty(false);
      setSaveState("Service account tersimpan dan sync Spreadsheet diretry.");
    } catch (error) {
      setStepError(
        error instanceof Error
          ? error.message
          : "File service account JSON tidak valid.",
      );
      setSaveState("Upload service account gagal.");
    }
  };

  const goNext = async () => {
    const error = validateStep(activeStep, form, savedSecretKeys);

    if (error) {
      setStepError(error);
      return;
    }

    try {
      setSaveState("Menyimpan step...");
      const nextSecretKeys = await persistCurrentStep(
        activeStep,
        form,
        savedSecretKeys,
      );
      setSavedSecretKeys(nextSecretKeys);
      setSaveState("Step tersimpan.");
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
      setStepError(null);
      setDirty(false);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "Gagal menyimpan step.",
      );
      setSaveState("Gagal menyimpan step.");
    }
  };

  const goBack = () => {
    setStepError(null);
    setActiveStep((current) => Math.max(current - 1, 0));
  };

  const handleStartBot = async () => {
    const error = validateAll(form, savedSecretKeys);

    if (error) {
      setStepError(error);
      return;
    }

    try {
      setRuntimeState("Menyalakan bot runtime...");
      setSuccessModalOpen(false);
      setWaitingForWhatsappOpen(false);
      const nextSecretKeys = await persistCurrentStep(
        activeStep,
        form,
        savedSecretKeys,
      );
      setSavedSecretKeys(nextSecretKeys);
      const status = await startBotRuntime();
      setRuntimeState(
        `${status.message}${status.pid ? ` PID ${status.pid}` : ""}`,
      );
      setWaitingForWhatsappOpen(true);

      const [nextStatus, nextQr] = await Promise.all([
        getWhatsappStatus(),
        getWhatsappQr(),
      ]);
      setWhatsappStatus(nextStatus);
      setWhatsappQr(nextQr);
    } catch (error) {
      setWaitingForWhatsappOpen(false);
      setRuntimeState(
        error instanceof Error
          ? error.message
          : "Gagal menyalakan bot runtime.",
      );
    }
  };

  const handleSaveSetup = async () => {
    const error = validateAll(form, savedSecretKeys);

    if (error) {
      setStepError(error);
      return;
    }

    try {
      setSaveState("Menyimpan setup...");
      await saveConfigDraft(buildConfigPatch(form, "all"));
      let nextSecretKeys = savedSecretKeys;

      if (form.providerApiKey.trim()) {
        const key = getActiveSecretKey(form.activeAiProvider);

        await saveSecret({
          key,
          value: form.providerApiKey.trim(),
        });
        nextSecretKeys = Array.from(new Set([...savedSecretKeys, key]));
      }

      setSavedSecretKeys(nextSecretKeys);
      setSaveState("Setup tersimpan.");
      setStepError(null);
      setDirty(false);
    } catch (error) {
      setStepError(
        error instanceof Error ? error.message : "Gagal menyimpan setup.",
      );
      setSaveState("Gagal menyimpan setup.");
    }
  };

  return (
    <>
      <PageHeader
        description="Ikuti wizard linear sampai review akhir. Draft konfigurasi disimpan otomatis saat Anda mengisi form."
        eyebrow="Setup Wizard"
        title="Konfigurasi Awal"
        action={<span className="badge badge--warning">{saveState}</span>}
      />

      <div className="wizard-shell">
        <SectionCard
          title="Progress Setup"
          description="Selesaikan step dari atas ke bawah agar onboarding tidak membingungkan."
        >
          <WizardStepper activeStep={activeStep} steps={steps} />
        </SectionCard>

        <SectionCard
          title={steps[activeStep]?.title ?? "Setup"}
          description={steps[activeStep]?.description}
        >
          <div className="wizard-progress" aria-label="Progress setup">
            <span
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {stepError ? <p className="form-error">{stepError}</p> : null}

          <div className="wizard-panel">
            {renderStep(activeStep, form, updateField, {
              onServiceAccountFile: uploadServiceAccountFile,
              onStartBot: handleStartBot,
              qr: whatsappQr,
              runtimeState,
              status: whatsappStatus,
              waitingForConnection: waitingForWhatsappOpen,
            })}
          </div>

          <div className="wizard-actions">
            <button
              className="button button--secondary"
              disabled={activeStep === 0}
              onClick={goBack}
              type="button"
            >
              Back
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                className="button button--primary"
                onClick={goNext}
                type="button"
              >
                Next
              </button>
            ) : (
              <button
                className="button button--primary"
                onClick={handleSaveSetup}
                type="button"
              >
                Simpan Setup
              </button>
            )}
          </div>

          {runtimeState ? <p className="card__meta">{runtimeState}</p> : null}
        </SectionCard>
      </div>

      {successModalOpen ? (
        <SuccessModal
          connection={whatsappStatus?.connection ?? "unknown"}
          onClose={() => setSuccessModalOpen(false)}
          runtimeState={runtimeState}
        />
      ) : null}
    </>
  );
}

function SuccessModal({
  connection,
  onClose,
  runtimeState,
}: {
  connection: string;
  onClose: () => void;
  runtimeState: string | null;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="bot-success-title"
        aria-modal="true"
        className="success-modal"
        role="dialog"
      >
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  "--delay": `${(index % 9) * 0.12}s`,
                  "--duration": `${1.4 + (index % 5) * 0.16}s`,
                  "--hue": `${index * 37}`,
                  "--x": `${(index * 37) % 100}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="success-modal__icon">✓</div>
        <h2 id="bot-success-title">Selamat, Bot Sudah Nyala</h2>
        <p>
          Runtime bot aktif dan siap menerima command WhatsApp dengan format
          <strong> /catat</strong>.
        </p>
        <div className="review-item">
          <span>Status runtime</span>
          <strong>{runtimeState ?? "Bot runtime berjalan."}</strong>
        </div>
        <div className="review-item">
          <span>Status WhatsApp</span>
          <strong>{connection}</strong>
        </div>
        <button
          className="button button--primary"
          onClick={onClose}
          type="button"
        >
          Lanjut Pakai Bot
        </button>
      </div>
    </div>
  );
}

interface IRenderStepContext {
  onServiceAccountFile: (file: File | null) => void;
  onStartBot: () => void;
  qr: IWhatsappQrResponse | null;
  runtimeState: string | null;
  status: IWhatsappStatus | null;
  waitingForConnection: boolean;
}

const renderStep = (
  step: number,
  form: ISetupFormState,
  updateField: (field: keyof ISetupFormState, value: string) => void,
  context: IRenderStepContext,
) => {
  if (step === 0) {
    return (
      <div className="form-grid">
        <FormField
          label="Provider AI Aktif"
          hint="Contoh: Gemini untuk setup awal karena runtime bot saat ini sudah stabil dengan Gemini."
        >
          <select
            className="select"
            value={form.activeAiProvider}
            onChange={(event) =>
              updateField("activeAiProvider", event.target.value)
            }
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
        </FormField>
        <FormField
          label="Database URL"
          hint="Contoh: sqlite://./data/baileys.db untuk SQLite lokal."
        >
          <input
            className="input"
            placeholder="sqlite://./data/baileys.db"
            value={form.databaseUrl}
            onChange={(event) => updateField("databaseUrl", event.target.value)}
          />
        </FormField>
        <FormField
          label="Allowed User IDs"
          hint="Contoh: 6281234567890,6289876543210. Kosongkan jika semua pengirim boleh memakai bot."
        >
          <input
            className="input"
            placeholder="6281234567890,6289876543210"
            value={form.allowedUserIds}
            onChange={(event) =>
              updateField("allowedUserIds", event.target.value)
            }
          />
        </FormField>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="form-grid">
        {renderProviderFields(form, updateField)}
        <FormField
          label={`${providerLabels[form.activeAiProvider]} API Key`}
          hint="Contoh Gemini: AIza... Jangan commit API key ke Git; secret akan disimpan lewat endpoint khusus."
        >
          <input
            className="input"
            placeholder="Masukkan API key provider aktif"
            type="password"
            value={form.providerApiKey}
            onChange={(event) =>
              updateField("providerApiKey", event.target.value)
            }
          />
        </FormField>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="form-grid">
        <FormField
          label="Spreadsheet ID"
          hint="Contoh: ambil dari URL Google Sheets, bagian setelah /d/ dan sebelum /edit."
        >
          <input
            className="input"
            placeholder="1AbCDefGhIjKlMnOpQrStUvWxYz1234567890"
            value={form.spreadsheetId}
            onChange={(event) =>
              updateField("spreadsheetId", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Spreadsheet Name"
          hint="Contoh: infos. Ini nama/konteks file spreadsheet untuk konfigurasi aplikasi."
        >
          <input
            className="input"
            placeholder="infos"
            value={form.spreadsheetName}
            onChange={(event) =>
              updateField("spreadsheetName", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Sheet Tab Name"
          hint="Contoh: Logs. Bot akan membuat header transaksi di tab ini."
        >
          <input
            className="input"
            placeholder="Logs"
            value={form.sheetName}
            onChange={(event) => updateField("sheetName", event.target.value)}
          />
        </FormField>
        <FormField
          label="Upload Service Account JSON"
          hint="Upload file .json yang diunduh dari Google Cloud Console. File akan disimpan di data/credentials."
        >
          <input
            accept="application/json,.json"
            className="input"
            type="file"
            onChange={(event) =>
              context.onServiceAccountFile(event.target.files?.[0] ?? null)
            }
          />
          <p className="card__meta">
            {form.serviceAccountContent
              ? `File siap diupload: ${form.serviceAccountFileName}`
              : form.serviceAccountPath
                ? `Credential tersimpan: ${form.serviceAccountPath}`
                : "Belum ada service account tersimpan."}
          </p>
        </FormField>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="wizard-whatsapp-grid">
        <div className="wizard-callout">
          <h3>Scan QR WhatsApp</h3>
          <p>
            Klik tombol di bawah untuk menyalakan runtime bot, lalu scan QR di
            panel sebelah tanpa pindah ke menu WhatsApp.
          </p>
          <p className="card__meta">
            Setelah tersambung, catat transaksi dengan format /catat beli makan
            25000. Menu WhatsApp tetap tersedia untuk reset session atau ganti
            device/nomor nanti.
          </p>
          <button
            className="button button--primary"
            onClick={context.onStartBot}
            type="button"
          >
            Nyalakan Bot & Tampilkan QR
          </button>
          {context.runtimeState ? (
            <p className="card__meta">{context.runtimeState}</p>
          ) : null}
          {context.waitingForConnection ? (
            <p className="card__meta">
              Menunggu WhatsApp connected. Confetti akan muncul setelah status
              berubah menjadi open.
            </p>
          ) : null}
          <StatusSummary status={context.status} />
        </div>

        <QrPreview qr={context.qr} />
      </div>
    );
  }

  return <ReviewStep form={form} />;
};

const renderProviderFields = (
  form: ISetupFormState,
  updateField: (field: keyof ISetupFormState, value: string) => void,
) => {
  if (form.activeAiProvider === "openai") {
    return (
      <>
        <FormField label="OpenAI Model" hint="Contoh: gpt-4.1-mini.">
          <input
            className="input"
            value={form.openaiModel}
            onChange={(event) => updateField("openaiModel", event.target.value)}
          />
        </FormField>
        <FormField
          label="OpenAI Base URL"
          hint="Opsional. Contoh custom gateway: https://api.openai.com/v1."
        >
          <input
            className="input"
            placeholder="https://api.openai.com/v1"
            value={form.openaiBaseUrl}
            onChange={(event) =>
              updateField("openaiBaseUrl", event.target.value)
            }
          />
        </FormField>
      </>
    );
  }

  if (form.activeAiProvider === "anthropic") {
    return (
      <>
        <FormField
          label="Anthropic Model"
          hint="Contoh: claude-3-5-haiku-latest."
        >
          <input
            className="input"
            value={form.anthropicModel}
            onChange={(event) =>
              updateField("anthropicModel", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Anthropic Base URL"
          hint="Opsional. Kosongkan untuk endpoint default."
        >
          <input
            className="input"
            placeholder="https://api.anthropic.com"
            value={form.anthropicBaseUrl}
            onChange={(event) =>
              updateField("anthropicBaseUrl", event.target.value)
            }
          />
        </FormField>
      </>
    );
  }

  if (form.activeAiProvider === "openai-compatible") {
    return (
      <>
        <FormField
          label="Custom Provider Name"
          hint="Contoh: OpenRouter, Groq, atau LiteLLM Gateway."
        >
          <input
            className="input"
            value={form.customProviderName}
            onChange={(event) =>
              updateField("customProviderName", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Custom Model"
          hint="Contoh: openai/gpt-4.1-mini atau llama-3.1-70b-versatile."
        >
          <input
            className="input"
            placeholder="openai/gpt-4.1-mini"
            value={form.customModel}
            onChange={(event) => updateField("customModel", event.target.value)}
          />
        </FormField>
        <FormField
          label="Custom Base URL"
          hint="Wajib untuk provider compatible. Contoh: https://openrouter.ai/api/v1."
        >
          <input
            className="input"
            placeholder="https://openrouter.ai/api/v1"
            value={form.customBaseUrl}
            onChange={(event) =>
              updateField("customBaseUrl", event.target.value)
            }
          />
        </FormField>
      </>
    );
  }

  return (
    <>
      <FormField
        label="Gemini Model"
        hint="Contoh: gemini-2.0-flash-lite untuk biaya ringan, atau gemini-2.5-flash untuk kualitas lebih tinggi."
      >
        <input
          className="input"
          value={form.geminiModel}
          onChange={(event) => updateField("geminiModel", event.target.value)}
        />
      </FormField>
      <FormField
        label="Gemini Base URL"
        hint="Opsional. Kosongkan untuk endpoint default Google Gemini, atau isi URL gateway internal."
      >
        <input
          className="input"
          placeholder="https://generativelanguage.googleapis.com"
          value={form.geminiBaseUrl}
          onChange={(event) => updateField("geminiBaseUrl", event.target.value)}
        />
      </FormField>
    </>
  );
};

function ReviewStep({ form }: { form: ISetupFormState }) {
  return (
    <div className="review-grid">
      <ReviewItem
        label="Provider AI"
        value={providerLabels[form.activeAiProvider]}
      />
      <ReviewItem label="Database URL" value={form.databaseUrl} />
      <ReviewItem
        label="Allowed Users"
        value={form.allowedUserIds || "Semua user diizinkan"}
      />
      <ReviewItem label="Model Aktif" value={getActiveModel(form)} />
      <ReviewItem
        label="Spreadsheet ID"
        value={form.spreadsheetId || "Belum diisi"}
      />
      <ReviewItem label="Sheet Tab" value={form.sheetName} />
      <ReviewItem
        label="Service Account"
        value={
          form.serviceAccountContent
            ? form.serviceAccountFileName
            : form.serviceAccountPath || "Belum diupload"
        }
      />
      <ReviewItem
        label="Bot Runtime"
        value="Runtime dinyalakan dan QR discan pada step WhatsApp. Review ini hanya menyimpan setup."
      />
      <p className="card__meta">
        Runtime dapat memakai Gemini, OpenAI, Anthropic, atau provider
        OpenAI-compatible seperti DeepSeek, Kimi, OpenRouter, dan PabrikToken
        selama model/base URL/API key valid.
      </p>
    </div>
  );
}

function StatusSummary({ status }: { status: IWhatsappStatus | null }) {
  return (
    <div className="review-item">
      <span>Status WhatsApp</span>
      <strong>{status?.connection ?? "unknown"}</strong>
    </div>
  );
}

function QrPreview({ qr }: { qr: IWhatsappQrResponse | null }) {
  return (
    <div className="qr-panel qr-panel--wizard">
      <div className="qr-panel__content">
        <strong>{qr?.qrSvg ? "QR aktif tersedia" : "QR belum tersedia"}</strong>
        <p className="card__meta">
          {qr?.expiresAt
            ? `QR berlaku sampai ${qr.expiresAt}`
            : "Klik tombol start lalu tunggu polling 5 detik."}
        </p>
        {qr?.qrSvg ? (
          <img
            alt="QR login WhatsApp"
            className="qr-panel__image"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.qrSvg)}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="review-item">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const persistCurrentStep = async (
  step: number,
  form: ISetupFormState,
  savedSecretKeys: string[],
) => {
  await saveConfigDraft(buildConfigPatch(form, step));
  let nextSecretKeys = savedSecretKeys;

  if (step === 1 && form.providerApiKey.trim()) {
    const key = getActiveSecretKey(form.activeAiProvider);

    await saveSecret({
      key,
      value: form.providerApiKey.trim(),
    });
    nextSecretKeys = Array.from(new Set([...savedSecretKeys, key]));
  }

  if (step === 2 && form.serviceAccountContent.trim()) {
    await uploadGoogleServiceAccount({
      fileName:
        form.serviceAccountFileName.trim() || "google-service-account.json",
      content: form.serviceAccountContent.trim(),
    });
    await retrySpreadsheetSyncJobs();
  }

  return nextSecretKeys;
};

const buildConfigPatch = (
  form: ISetupFormState,
  step: number | "all" = "all",
): IConfigPatch => {
  const patch: IConfigPatch = {};

  if (step === 0 || step === "all") {
    patch.activeAiProvider = form.activeAiProvider;
    patch.database = {
      url: form.databaseUrl,
    };
    patch.whatsapp = {
      allowedUserIds: splitAllowedUsers(form.allowedUserIds),
    };
  }

  if (step === 2 || step === "all") {
    patch.spreadsheet = {
      spreadsheetId: form.spreadsheetId,
      spreadsheetName: form.spreadsheetName,
      sheetName: form.sheetName,
    };
  }

  if (step !== 1 && step !== "all") {
    return patch;
  }

  patch.activeAiProvider = form.activeAiProvider;
  patch.ai = {};

  if (form.activeAiProvider === "openai") {
    patch.ai = {
      openai: {
        model: form.openaiModel,
        baseUrl: form.openaiBaseUrl,
      },
    };
    return patch;
  }

  if (form.activeAiProvider === "anthropic") {
    patch.ai = {
      anthropic: {
        model: form.anthropicModel,
        baseUrl: form.anthropicBaseUrl,
      },
    };
    return patch;
  }

  if (form.activeAiProvider === "openai-compatible") {
    patch.ai = {
      custom: {
        name: form.customProviderName,
        model: form.customModel,
        baseUrl: form.customBaseUrl,
      },
    };
    return patch;
  }

  patch.ai = {
    gemini: {
      model: form.geminiModel,
      baseUrl: form.geminiBaseUrl,
    },
  };
  return patch;
};

const validateStep = (
  step: number,
  form: ISetupFormState,
  savedSecretKeys: string[],
) => {
  if (step === 0) {
    if (!form.databaseUrl.trim()) {
      return "Database URL wajib diisi. Contoh: sqlite://./data/baileys.db";
    }

    if (
      !splitAllowedUsers(form.allowedUserIds).every((item) =>
        /^\d{8,15}$/.test(item),
      )
    ) {
      return "Allowed User IDs harus nomor WhatsApp tanpa +, tanpa @, dipisahkan koma. Contoh: 6281234567890";
    }
  }

  if (step === 1) {
    if (!getActiveModel(form)) {
      return "Model provider aktif wajib diisi.";
    }

    if (
      form.activeAiProvider === "openai-compatible" &&
      !form.customBaseUrl.trim()
    ) {
      return "Custom Base URL wajib diisi untuk OpenAI-compatible. Contoh: https://openrouter.ai/api/v1";
    }

    if (
      !form.providerApiKey.trim() &&
      !savedSecretKeys.includes(getActiveSecretKey(form.activeAiProvider))
    ) {
      return "API key provider aktif wajib diisi agar bot bisa memproses pesan.";
    }
  }

  if (step === 2) {
    if (!form.spreadsheetId.trim()) {
      return "Spreadsheet ID wajib diisi agar transaksi bisa masuk ke Google Sheets.";
    }

    if (!form.sheetName.trim()) {
      return "Sheet Tab Name wajib diisi. Contoh: Logs";
    }

    if (!form.serviceAccountPath && !form.serviceAccountContent.trim()) {
      return "Upload file service account JSON wajib dilakukan agar transaksi bisa masuk ke Google Sheets.";
    }

    if (form.serviceAccountContent.trim()) {
      try {
        JSON.parse(form.serviceAccountContent);
      } catch (error) {
        return "Service Account JSON belum valid. Paste isi file JSON dari Google Cloud.";
      }
    }
  }

  return null;
};

const validateAll = (form: ISetupFormState, savedSecretKeys: string[]) => {
  for (let index = 0; index < steps.length - 1; index += 1) {
    const error = validateStep(index, form, savedSecretKeys);

    if (error) {
      return error;
    }
  }

  return null;
};

const splitAllowedUsers = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getActiveSecretKey = (provider: string) =>
  provider === "openai-compatible" ? "custom.apiKey" : `${provider}.apiKey`;

const getActiveModel = (form: ISetupFormState) => {
  if (form.activeAiProvider === "openai") {
    return form.openaiModel.trim();
  }

  if (form.activeAiProvider === "anthropic") {
    return form.anthropicModel.trim();
  }

  if (form.activeAiProvider === "openai-compatible") {
    return form.customModel.trim();
  }

  return form.geminiModel.trim();
};

const buildFormFromConfigStatus = (status: IConfigStatus): ISetupFormState => {
  const config = status.config;

  return {
    ...initialForm,
    activeAiProvider: config.activeAiProvider ?? initialForm.activeAiProvider,
    databaseUrl: config.database?.url ?? initialForm.databaseUrl,
    allowedUserIds: config.whatsapp?.allowedUserIds?.join(",") ?? "",
    geminiModel: config.ai?.gemini?.model ?? initialForm.geminiModel,
    geminiBaseUrl: config.ai?.gemini?.baseUrl ?? "",
    openaiModel: config.ai?.openai?.model ?? initialForm.openaiModel,
    openaiBaseUrl: config.ai?.openai?.baseUrl ?? "",
    anthropicModel: config.ai?.anthropic?.model ?? initialForm.anthropicModel,
    anthropicBaseUrl: config.ai?.anthropic?.baseUrl ?? "",
    customProviderName:
      config.ai?.custom?.name ?? initialForm.customProviderName,
    customModel: config.ai?.custom?.model ?? "",
    customBaseUrl: config.ai?.custom?.baseUrl ?? "",
    providerApiKey: "",
    spreadsheetId:
      config.spreadsheet?.spreadsheetId ?? initialForm.spreadsheetId,
    spreadsheetName:
      config.spreadsheet?.spreadsheetName ?? initialForm.spreadsheetName,
    sheetName: config.spreadsheet?.sheetName ?? initialForm.sheetName,
    serviceAccountFileName:
      config.spreadsheet?.serviceAccountPath?.split(/[\\/]/).pop() ||
      initialForm.serviceAccountFileName,
    serviceAccountContent: "",
    serviceAccountPath: config.spreadsheet?.serviceAccountPath ?? "",
  };
};
