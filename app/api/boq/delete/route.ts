import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID } from "@/app/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const { boqNumber } = await request.json();

    if (!boqNumber) {
      return NextResponse.json({ success: false, message: "BOQ number is required" });
    }

    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    const existingRows = response.data.values || [];
    const filteredRows = existingRows.filter(
      (row: any[]) => (row[0] || "").toString().trim() !== boqNumber
    );

    const deletedCount = existingRows.length - filteredRows.length;

    // Clear and rewrite
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    if (filteredRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `BOQ_Store!A2:F${filteredRows.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: filteredRows },
      });
    }

    return NextResponse.json({
      success: true,
      message: `BOQ "${boqNumber}" deleted. (${deletedCount} rows removed)`,
    });
  } catch (error) {
    console.error("Error deleting BOQ:", error);
    return NextResponse.json({ success: false, message: "Failed to delete BOQ" });
  }
}