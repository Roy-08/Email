import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID, ensureSheetExists } from "@/app/lib/googleSheets";

export async function GET() {
  try {
    const sheets = getGoogleSheetsClient();
    await ensureSheetExists("Archive", ["Date", "Subject", "Description", "Vendor", "Contact", "Email", "Mobile", "Status"]);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Archive!A2:H",
    });

    const rows = response.data.values || [];
    const records = [];

    // Reverse for newest first
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      let dateStr = "";
      if (row[0]) {
        try {
          const d = new Date(row[0]);
          dateStr = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          dateStr = row[0].toString();
        }
      }

      records.push({
        date: dateStr,
        subject: (row[1] || "").toString(),
        description: (row[2] || "").toString(),
        vendor: (row[3] || "").toString(),
        contact: (row[4] || "").toString(),
        email: (row[5] || "").toString(),
        mobile: (row[6] || "").toString(),
        status: (row[7] || "").toString(),
      });
    }

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error("Error getting archive:", error);
    return NextResponse.json({ success: false, records: [] });
  }
}