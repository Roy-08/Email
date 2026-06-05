import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleSheetsClient,
  ensureSheetExists,
  SHEET_ID,
} from "@/app/lib/googleSheets";

// This route reads/writes spreadsheet data, so it must run on Node.js (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sheets?sheet=SheetName
 *
 * Returns all rows from the requested sheet/tab as a 2D array of strings.
 */
export async function GET(request: NextRequest) {
  try {
    const sheetName =
      request.nextUrl.searchParams.get("sheet") || "Sheet1";

    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: sheetName,
    });

    return NextResponse.json({
      sheet: sheetName,
      values: response.data.values ?? [],
    });
  } catch (error) {
    console.error("GET /api/sheets failed:", error);
    return NextResponse.json(
      { error: "Failed to read sheet data." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sheets
 *
 * Body: { sheet: string, headers?: string[], row: (string | number)[] }
 *
 * Ensures the target sheet exists (creating it with optional headers) and
 * appends a single row of values.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sheetName: string = body.sheet || "Sheet1";
    const headers: string[] = Array.isArray(body.headers) ? body.headers : [];
    const row: (string | number)[] = Array.isArray(body.row) ? body.row : [];

    if (row.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'row' array." },
        { status: 400 }
      );
    }

    if (headers.length > 0) {
      await ensureSheetExists(sheetName, headers);
    }

    const sheets = getGoogleSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: sheetName,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return NextResponse.json({ success: true, sheet: sheetName, row });
  } catch (error) {
    console.error("POST /api/sheets failed:", error);
    return NextResponse.json(
      { error: "Failed to append row to sheet." },
      { status: 500 }
    );
  }
}