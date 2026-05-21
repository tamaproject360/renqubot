import { fileURLToPath } from 'node:url';
import type { IAppConfig } from '../../contracts/config';
import type { ISecretValues } from '../config/config-service';

export interface IBotRuntimeStatus {
  state: 'stopped' | 'running';
  pid: number | null;
  startedAt: string | null;
  message: string;
}

const rootDir = fileURLToPath(new URL('../../../../../', import.meta.url));

const secretKeyByProvider: Record<IAppConfig['activeAiProvider'], string> = {
  gemini: 'gemini.apiKey',
  openai: 'openai.apiKey',
  anthropic: 'anthropic.apiKey',
  'openai-compatible': 'custom.apiKey',
};

const getRuntimeSecret = (config: IAppConfig, secrets: ISecretValues) => {
  return secrets[secretKeyByProvider[config.activeAiProvider]];
};

export class BotRuntimeService {
  private process: Bun.Subprocess | null = null;
  private startedAt: string | null = null;

  public getStatus(): IBotRuntimeStatus {
    if (!this.process) {
      return {
        state: 'stopped',
        pid: null,
        startedAt: null,
        message: 'Bot runtime belum berjalan.',
      };
    }

    return {
      state: 'running',
      pid: this.process.pid,
      startedAt: this.startedAt,
      message: 'Bot runtime berjalan dan siap memproses pesan WhatsApp.',
    };
  }

  public start(config: IAppConfig, secrets: ISecretValues): IBotRuntimeStatus {
    if (this.process) {
      return this.getStatus();
    }

    const apiKey = getRuntimeSecret(config, secrets);

    if (!apiKey) {
      throw new Error(
        'API key provider aktif wajib diisi sebelum menyalakan bot.',
      );
    }

    this.startedAt = new Date().toISOString();
    this.process = Bun.spawn(['bun', 'run', 'src/index.ts'], {
      cwd: rootDir,
      env: {
        ...Bun.env,
        AI_PROVIDER: config.activeAiProvider,
        DATABASE_URL: config.database.url,
        GEMINI_API_KEY: secrets['gemini.apiKey'] ?? '',
        GEMINI_MODEL: config.ai.gemini.model,
        GEMINI_HOST: config.ai.gemini.baseUrl ?? '',
        OPENAI_API_KEY: secrets['openai.apiKey'] ?? '',
        OPENAI_MODEL: config.ai.openai.model,
        OPENAI_BASE_URL:
          config.ai.openai.baseUrl ?? 'https://api.openai.com/v1',
        ANTHROPIC_API_KEY: secrets['anthropic.apiKey'] ?? '',
        ANTHROPIC_MODEL: config.ai.anthropic.model,
        ANTHROPIC_BASE_URL:
          config.ai.anthropic.baseUrl ?? 'https://api.anthropic.com',
        CUSTOM_API_KEY: secrets['custom.apiKey'] ?? '',
        CUSTOM_PROVIDER_NAME: config.ai.custom.name,
        CUSTOM_MODEL: config.ai.custom.model,
        CUSTOM_BASE_URL: config.ai.custom.baseUrl ?? '',
        SPREADSHEET_ID: config.spreadsheet.spreadsheetId,
        SPREADSHEET_NAME: config.spreadsheet.spreadsheetName,
        SHEET_NAME: config.spreadsheet.sheetName,
        GCLOUD_KEY_PATH: config.spreadsheet.serviceAccountPath,
        ALLOWED_USER_IDS: config.whatsapp.allowedUserIds.join(','),
        WHATSAPP_RUNTIME_STATE_PATH:
          Bun.env.WHATSAPP_RUNTIME_STATE_PATH ??
          './data/runtime/whatsapp-status.json',
      },
      stderr: 'inherit',
      stdout: 'inherit',
    });

    this.process.exited.finally(() => {
      this.process = null;
      this.startedAt = null;
    });

    return this.getStatus();
  }
}
