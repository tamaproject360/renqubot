import { google } from 'googleapis';
import { withRetry } from '../retry';
import { GCLOUD_KEY_PATH, SHEET_NAME, SPREADSHEET_ID } from './config';

const transactionHeaders = [
  'Timestamp',
  'Jenis',
  'Kategori',
  'Jumlah',
  'Merchant/Sumber',
  'Keterangan',
];

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
      await ensureTransactionSheetHeader(googleSheets);
      await googleSheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
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

const ensureTransactionSheetHeader = async (
  googleSheets: ReturnType<typeof google.sheets>,
) => {
  const headerRange = `${SHEET_NAME}!A1:F1`;
  const response = await googleSheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: headerRange,
  });
  const currentHeaders = response.data.values?.[0] ?? [];
  const headerMatches = transactionHeaders.every(
    (header, index) => currentHeaders[index] === header,
  );

  if (headerMatches) {
    return;
  }

  const sheetId = await getSheetId(googleSheets);
  const hasExistingFirstRow = currentHeaders.some((value) => Boolean(value));

  if (hasExistingFirstRow && sheetId !== null) {
    await googleSheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 1,
              },
              inheritFromBefore: false,
            },
          },
        ],
      },
    });
  }

  await googleSheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: headerRange,
    valueInputOption: 'RAW',
    requestBody: {
      values: [transactionHeaders],
    },
  });

  await formatHeaderRow(googleSheets);
};

const formatHeaderRow = async (
  googleSheets: ReturnType<typeof google.sheets>,
) => {
  const sheetId = await getSheetId(googleSheets);

  if (sheetId === null) {
    return;
  }

  await googleSheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: transactionHeaders.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.81,
                  green: 0.89,
                  blue: 0.95,
                },
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    },
  });
};

const getSheetId = async (googleSheets: ReturnType<typeof google.sheets>) => {
  const spreadsheet = await googleSheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheetId = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties?.title === SHEET_NAME,
  )?.properties?.sheetId;

  return sheetId ?? null;
};
