export const DATABASE_URL = Bun.env.DATABASE_URL || 'file:./data/baileys.db';
export const GEMINI_MODEL = Bun.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
export const GEMINI_HOST = Bun.env.GEMINI_HOST;
export const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY;

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

  if (!GEMINI_API_KEY) {
    missingFields.push('GEMINI_API_KEY');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
};

export const logRuntimeConfig = () => {
  console.info('[CONFIG] Using Gemini Model:', GEMINI_MODEL);
  console.info(
    `[CONFIG] ${GEMINI_HOST ? `Using Gemini Host: ${GEMINI_HOST}` : 'Using default Gemini Host'}`,
  );

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
