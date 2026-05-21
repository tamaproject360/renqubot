import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  IWhatsappQrResponse,
  IWhatsappStatus,
} from '../../contracts/whatsapp';
import type { IAppConfig } from '../../contracts/config';
import { DatabaseService } from '../database/database-service';

interface IWhatsappRuntimeState {
  connection: IWhatsappStatus['connection'];
  lastQr: string | null;
  qrUpdatedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

const WHATSAPP_RUNTIME_STATE_PATH =
  Bun.env.WHATSAPP_RUNTIME_STATE_PATH || './data/runtime/whatsapp-status.json';
const QR_TTL_MS = 60_000;

const defaultState: IWhatsappRuntimeState = {
  connection: 'unknown',
  lastQr: null,
  qrUpdatedAt: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
};

export class WhatsappService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public async getStatus(): Promise<IWhatsappStatus> {
    const state = await this.readState();

    return {
      connection: state.connection,
      lastError: state.lastError,
      hasQr: Boolean(state.lastQr),
      qrUpdatedAt: state.qrUpdatedAt,
      updatedAt: state.updatedAt,
    };
  }

  public async getQr(): Promise<IWhatsappQrResponse> {
    const state = await this.readState();

    if (!state.lastQr || !state.qrUpdatedAt) {
      return {
        qr: null,
        expiresAt: null,
      };
    }

    const expiresAt = new Date(
      new Date(state.qrUpdatedAt).getTime() + QR_TTL_MS,
    );

    if (Date.now() > expiresAt.getTime()) {
      return {
        qr: null,
        expiresAt: expiresAt.toISOString(),
      };
    }

    return {
      qr: state.lastQr,
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async resetSession(config: IAppConfig) {
    const sql = this.databaseService.createSql(config.database.url);

    await sql.connect();
    await sql`CREATE TABLE IF NOT EXISTS "sessions" (
      "id" TEXT PRIMARY KEY,
      "data" TEXT NOT NULL,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
    ) STRICT;`;
    await sql`DELETE FROM sessions;`;
    await sql.close();

    await this.writeState({
      connection: 'unknown',
      lastQr: null,
      qrUpdatedAt: null,
      lastError: null,
    });

    return {
      reset: true,
      message: 'Session WhatsApp dihapus dari database.',
    };
  }

  private async readState(): Promise<IWhatsappRuntimeState> {
    try {
      const content = await readFile(WHATSAPP_RUNTIME_STATE_PATH, 'utf8');
      return JSON.parse(content) as IWhatsappRuntimeState;
    } catch (error) {
      return defaultState;
    }
  }

  private async writeState(patch: Partial<IWhatsappRuntimeState>) {
    const current = await this.readState();
    const nextState: IWhatsappRuntimeState = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    await mkdir(dirname(WHATSAPP_RUNTIME_STATE_PATH), { recursive: true });
    await writeFile(
      WHATSAPP_RUNTIME_STATE_PATH,
      `${JSON.stringify(nextState, null, 2)}\n`,
      'utf8',
    );
  }
}
