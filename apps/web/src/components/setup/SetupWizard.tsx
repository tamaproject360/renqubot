"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WizardStepper } from "@/components/ui/WizardStepper";
import {
  saveConfigDraft,
  saveSecret,
  startBotRuntime,
  uploadGoogleServiceAccount,
  type IConfigPatch,
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
}

const initialForm: ISetupFormState = {
  activeAiProvider: "gemini",
  databaseUrl: "file:./data/baileys.db",
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
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSaveState("Auto-save draft...");
        await saveConfigDraft(buildConfigPatch(form));
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

  const goNext = async () => {
    const error = validateStep(activeStep, form);

    if (error) {
      setStepError(error);
      return;
    }

    try {
      setSaveState("Menyimpan step...");
      await persistCurrentStep(activeStep, form);
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
    const error = validateAll(form);

    if (error) {
      setStepError(error);
      return;
    }

    try {
      setRuntimeState("Menyalakan bot runtime...");
      await persistCurrentStep(activeStep, form);
      const status = await startBotRuntime();
      setRuntimeState(
        `${status.message}${status.pid ? ` PID ${status.pid}` : ""}`,
      );
    } catch (error) {
      setRuntimeState(
        error instanceof Error
          ? error.message
          : "Gagal menyalakan bot runtime.",
      );
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
            {renderStep(activeStep, form, updateField)}
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
                onClick={handleStartBot}
                type="button"
              >
                Simpan & Nyalakan Bot
              </button>
            )}
          </div>

          {runtimeState ? <p className="card__meta">{runtimeState}</p> : null}
        </SectionCard>
      </div>
    </>
  );
}

const renderStep = (
  step: number,
  form: ISetupFormState,
  updateField: (field: keyof ISetupFormState, value: string) => void,
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
          hint="Contoh: file:./data/baileys.db untuk SQLite lokal."
        >
          <input
            className="input"
            placeholder="file:./data/baileys.db"
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
          label="Service Account File Name"
          hint="Contoh: google-service-account.json. File akan disimpan di data/credentials."
        >
          <input
            className="input"
            placeholder="google-service-account.json"
            value={form.serviceAccountFileName}
            onChange={(event) =>
              updateField("serviceAccountFileName", event.target.value)
            }
          />
        </FormField>
        <FormField
          label="Service Account JSON"
          hint='Contoh: { "type": "service_account", "project_id": "renqu-bot" }. Paste isi JSON credential dari Google Cloud.'
        >
          <textarea
            className="textarea"
            placeholder='{ "type": "service_account", "project_id": "renqu-bot", "private_key": "..." }'
            value={form.serviceAccountContent}
            onChange={(event) =>
              updateField("serviceAccountContent", event.target.value)
            }
          />
        </FormField>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="wizard-callout">
        <h3>WhatsApp Session</h3>
        <p>
          Setelah bot runtime dinyalakan di step Review, buka halaman WhatsApp
          untuk melihat QR dan scan dengan akun WhatsApp yang akan dipakai bot.
        </p>
        <p className="card__meta">
          Contoh alur: klik Simpan & Nyalakan Bot, buka menu WhatsApp, scan QR,
          lalu kirim pesan seperti "Beli gorengan 10000" dari nomor yang
          diizinkan.
        </p>
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
            : "Belum diupload"
        }
      />
      <ReviewItem
        label="Bot Runtime"
        value="Klik tombol Simpan & Nyalakan Bot untuk menjalankan runtime."
      />
      <p className="card__meta">
        Runtime dapat memakai Gemini, OpenAI, Anthropic, atau provider
        OpenAI-compatible seperti DeepSeek, Kimi, OpenRouter, dan PabrikToken
        selama model/base URL/API key valid.
      </p>
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

const persistCurrentStep = async (step: number, form: ISetupFormState) => {
  await saveConfigDraft(buildConfigPatch(form));

  if (step === 1 && form.providerApiKey.trim()) {
    await saveSecret({
      key: getActiveSecretKey(form.activeAiProvider),
      value: form.providerApiKey.trim(),
    });
  }

  if (step === 2 && form.serviceAccountContent.trim()) {
    await uploadGoogleServiceAccount({
      fileName:
        form.serviceAccountFileName.trim() || "google-service-account.json",
      content: form.serviceAccountContent.trim(),
    });
  }
};

const buildConfigPatch = (form: ISetupFormState): IConfigPatch => {
  const patch: IConfigPatch = {
    activeAiProvider: form.activeAiProvider,
    ai: {},
    database: {
      url: form.databaseUrl,
    },
    spreadsheet: {
      spreadsheetId: form.spreadsheetId,
      spreadsheetName: form.spreadsheetName,
      sheetName: form.sheetName,
    },
    whatsapp: {
      allowedUserIds: splitAllowedUsers(form.allowedUserIds),
    },
  };

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

const validateStep = (step: number, form: ISetupFormState) => {
  if (step === 0) {
    if (!form.databaseUrl.trim()) {
      return "Database URL wajib diisi. Contoh: file:./data/baileys.db";
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

    if (!form.providerApiKey.trim()) {
      return "API key provider aktif wajib diisi agar bot bisa memproses pesan.";
    }
  }

  if (step === 2) {
    if (!form.sheetName.trim()) {
      return "Sheet Tab Name wajib diisi. Contoh: Logs";
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

const validateAll = (form: ISetupFormState) => {
  for (let index = 0; index < steps.length - 1; index += 1) {
    const error = validateStep(index, form);

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
