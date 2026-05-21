import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { WAConnectionState } from 'baileys';

const WHATSAPP_RUNTIME_STATE_PATH =
  Bun.env.WHATSAPP_RUNTIME_STATE_PATH || './data/runtime/whatsapp-status.json';

export interface IWhatsappRuntimeState {
  connection: WAConnectionState | 'unknown';
  lastQr: string | null;
  qrUpdatedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

const defaultState: IWhatsappRuntimeState = {
  connection: 'unknown',
  lastQr: null,
  qrUpdatedAt: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
};

export const readWhatsappRuntimeState = async () => {
  try {
    const content = await readFile(WHATSAPP_RUNTIME_STATE_PATH, 'utf8');
    return JSON.parse(content) as IWhatsappRuntimeState;
  } catch (error) {
    return defaultState;
  }
};

export const writeWhatsappRuntimeState = async (
  patch: Partial<IWhatsappRuntimeState>,
) => {
  const current = await readWhatsappRuntimeState();
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
};
