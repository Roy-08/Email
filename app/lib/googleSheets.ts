import { google } from "googleapis";

/**
 * Creates and returns an authenticated Google Sheets API client.
 *
 * Reads service-account credentials from environment variables. The private
 * key is normalized so escaped "\n" sequences become real newlines.
 */
export function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

/** The target spreadsheet ID, sourced from the environment. */
export const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

/**
 * Ensures a sheet/tab exists within the spreadsheet. If it does not exist,
 * the sheet is created and seeded with the provided header row.
 *
 * @param sheetName - The tab title to look for or create.
 * @param headers - Column header values written to row 1 on creation.
 */
export async function ensureSheetExists(sheetName: string, headers: string[]) {
  const sheets = getGoogleSheetsClient();
  try {
    // Check if sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    const sheetExists = spreadsheet.data.sheets?.some(
      (s) => s.properties?.title === sheetName
    );

    if (!sheetExists) {
      // Create the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  } catch (error) {
    console.error(`Error ensuring sheet ${sheetName}:`, error);
  }
}