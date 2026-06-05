import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID } from "@/app/lib/googleSheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedItem = searchParams.get("item");

  if (!selectedItem) {
    return NextResponse.json({ success: false, message: "Item is required", vendors: [] });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A2:E",
    });

    const rows = response.data.values || [];
    const vendors = [];

    for (const row of rows) {
      const itemName = (row[0] || "").toString().trim().toLowerCase();
      if (itemName === selectedItem.trim().toLowerCase()) {
        vendors.push({
          manufacturer: (row[1] || "").toString(),
          contact: (row[2] || "").toString(),
          mobile: (row[3] || "").toString(),
          email: (row[4] || "").toString(),
        });
      }
    }

    return NextResponse.json({ success: true, vendors, count: vendors.length });
  } catch (error) {
    console.error("Error getting vendors:", error);
    return NextResponse.json({ success: false, message: "Failed to get vendors", vendors: [] });
  }
}