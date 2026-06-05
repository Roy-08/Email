import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID } from "@/app/lib/googleSheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boqNumber = searchParams.get("boqNumber");

  if (!boqNumber) {
    return NextResponse.json({ success: false, itemNames: [] });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    const rows = response.data.values || [];
    const itemNames: string[] = [];

    for (const row of rows) {
      if ((row[0] || "").toString().trim() === boqNumber) {
        const itemName = (row[5] || "").toString().trim();
        if (itemName && !itemNames.includes(itemName)) {
          itemNames.push(itemName);
        }
      }
    }

    return NextResponse.json({ success: true, itemNames });
  } catch (error) {
    console.error("Error getting item names:", error);
    return NextResponse.json({ success: false, itemNames: [] });
  }
}