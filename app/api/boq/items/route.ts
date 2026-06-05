import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID } from "@/app/lib/googleSheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boqNumber = searchParams.get("boqNumber");
  const itemName = searchParams.get("itemName");

  if (!boqNumber) {
    return NextResponse.json({ success: false, items: [] });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    const rows = response.data.values || [];
    const items = [];

    for (const row of rows) {
      const rowBoq = (row[0] || "").toString().trim();
      const rowItemName = (row[5] || "").toString().trim();

      if (rowBoq === boqNumber) {
        if (!itemName || rowItemName === itemName) {
          items.push({
            srNo: (row[1] || "").toString().trim(),
            description: (row[2] || "").toString().trim(),
            unit: (row[3] || "").toString().trim(),
            qty: (row[4] || "").toString().trim(),
            itemName: rowItemName,
          });
        }
      }
    }

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Error getting items:", error);
    return NextResponse.json({ success: false, items: [] });
  }
}