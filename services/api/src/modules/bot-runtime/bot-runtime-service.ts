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

    if (config.activeAiProvider !== 'gemini') {
      throw new Error('Bot runtime saat ini baru mendukung provider aktif Gemini.');
    }

    const geminiApiKey = secrets['gemini.apiKey'];

    if (!geminiApiKey) {
      throw new Error('Gemini API Key wajib diisi sebelum menyalakan bot.');
    }

    this.startedAt = new Date().toISOString();
    this.process = Bun.spawn(['bun', 'run', 'src/index.ts'], {
      cwd: rootDir,
      env: {
        ...Bun.env,
        DATABASE_URL: config.database.url,
        GEMINI_API_KEY: geminiApiKey,
        GEMINI_MODEL: config.ai.gemini.model,
        GEMINI_HOST: config.ai.gemini.baseUrl ?? '',
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
