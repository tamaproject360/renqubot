import { google } from 'googleapis';
import { withRetry } from '../retry';
import { GCLOUD_KEY_PATH, SHEET_NAME, SPREADSHEET_ID } from './config';

const auth = new google.auth.GoogleAuth({
  keyFile: GCLOUD_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const appendTransactionRowToSheet = async (
  rowData: (string | number | null)[],
) => {
  const googleSheets = google.sheets({ version: 'v4', auth: auth });

  await withRetry(
    async () => {
      await googleSheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    },
    {
      attempts: 3,
      baseDelayMs: 750,
      module: 'Spreadsheet',
      operation: 'appendTransactionRowToSheet',
    },
  );
};
