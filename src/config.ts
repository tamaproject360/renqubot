export const DATABASE_URL = Bun.env.DATABASE_URL || 'file:./data/baileys.db';
export const AI_PROVIDER = Bun.env.AI_PROVIDER || 'gemini';

export const GEMINI_MODEL = Bun.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
export const GEMINI_HOST = Bun.env.GEMINI_HOST;
export const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY;

export const OPENAI_MODEL = Bun.env.OPENAI_MODEL || 'gpt-4.1-mini';
export const OPENAI_BASE_URL =
  Bun.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
export const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY;

export const ANTHROPIC_MODEL =
  Bun.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
export const ANTHROPIC_BASE_URL =
  Bun.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
export const ANTHROPIC_API_KEY = Bun.env.ANTHROPIC_API_KEY;

export const CUSTOM_PROVIDER_NAME =
  Bun.env.CUSTOM_PROVIDER_NAME || 'Custom OpenAI-compatible';
export const CUSTOM_MODEL = Bun.env.CUSTOM_MODEL || '';
export const CUSTOM_BASE_URL = Bun.env.CUSTOM_BASE_URL || '';
export const CUSTOM_API_KEY = Bun.env.CUSTOM_API_KEY;

export const SPREADSHEET_ID = Bun.env.SPREADSHEET_ID;
export const SPREADSHEET_NAME = Bun.env.SPREADSHEET_NAME || 'infos';
export const GCLOUD_KEY_PATH = Bun.env.GCLOUD_KEY_PATH;

export const ALLOWED_USER_IDS = Bun.env.ALLOWED_USER_IDS
  ? Bun.env.ALLOWED_USER_IDS.split(',').map((id) => id.trim())
  : [];

export interface IRuntimeConfigValidationResult {
  valid: boolean;
  missingFields: string[];
}

export const validateRuntimeConfig = (): IRuntimeConfigValidationResult => {
  const missingFields: string[] = [];

  if (AI_PROVIDER === 'gemini' && !GEMINI_API_KEY) {
    missingFields.push('GEMINI_API_KEY');
  }

  if (AI_PROVIDER === 'openai' && !OPENAI_API_KEY) {
    missingFields.push('OPENAI_API_KEY');
  }

  if (AI_PROVIDER === 'anthropic' && !ANTHROPIC_API_KEY) {
    missingFields.push('ANTHROPIC_API_KEY');
  }

  if (AI_PROVIDER === 'openai-compatible') {
    if (!CUSTOM_API_KEY) {
      missingFields.push('CUSTOM_API_KEY');
    }

    if (!CUSTOM_BASE_URL) {
      missingFields.push('CUSTOM_BASE_URL');
    }

    if (!CUSTOM_MODEL) {
      missingFields.push('CUSTOM_MODEL');
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
};

export const logRuntimeConfig = () => {
  console.info('[CONFIG] Using AI Provider:', AI_PROVIDER);
  console.info('[CONFIG] Using AI Model:', getRuntimeModelName());

  console.info(
    '[CONFIG] Spreadsheet ID:',
    SPREADSHEET_ID ? SPREADSHEET_ID : 'Not set',
  );
  console.info('[CONFIG] Spreadsheet Name:', SPREADSHEET_NAME);

  if (ALLOWED_USER_IDS.length > 0) {
    console.info('[CONFIG] Allowed User IDs:', ALLOWED_USER_IDS.join(', '));
  } else {
    console.warn('[CONFIG] No restrictions on User IDs');
  }
};

const getRuntimeModelName = () => {
  if (AI_PROVIDER === 'openai') {
    return OPENAI_MODEL;
  }

  if (AI_PROVIDER === 'anthropic') {
    return ANTHROPIC_MODEL;
  }

  if (AI_PROVIDER === 'openai-compatible') {
    return `${CUSTOM_PROVIDER_NAME} / ${CUSTOM_MODEL}`;
  }

  return GEMINI_MODEL;
};
