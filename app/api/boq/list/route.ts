import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID, ensureSheetExists } from "@/app/lib/googleSheets";

export async function GET() {
  try {
    const sheets = getGoogleSheetsClient();
    await ensureSheetExists("BOQ_Store", ["BOQ_Number", "Sr_No", "Item_Description", "Unit", "Qty", "Item_Name"]);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:A",
    });

    const rows = response.data.values || [];
    const boqNumbers: string[] = [];

    for (const row of rows) {
      const val = (row[0] || "").toString().trim();
      if (val && !boqNumbers.includes(val)) {
        boqNumbers.push(val);
      }
    }

    return NextResponse.json({ success: true, boqNumbers });
  } catch (error) {
    console.error("Error getting BOQ list:", error);
    return NextResponse.json({ success: false, message: "Failed to get BOQ list", boqNumbers: [] });
  }
}