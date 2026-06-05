import { NextResponse } from "next/server";
import { getGoogleSheetsClient, SHEET_ID, ensureSheetExists } from "@/app/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const { boqNumber, rows } = await request.json();

    if (!boqNumber || !rows || rows.length === 0) {
      return NextResponse.json({ success: false, message: "BOQ number and data are required" });
    }

    const sheets = getGoogleSheetsClient();
    await ensureSheetExists("BOQ_Store", ["BOQ_Number", "Sr_No", "Item_Description", "Unit", "Qty", "Item_Name"]);

    // Get existing data to remove old BOQ entries
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    const existingRows = existingResponse.data.values || [];
    const filteredRows = existingRows.filter(
      (row: any[]) => (row[0] || "").toString().trim() !== boqNumber
    );

    // Add new rows
    const newRows = rows.map((row: { srNo: string; description: string; unit: string; qty: string; itemName: string }) => [
      boqNumber,
      row.srNo || "",
      row.description || "",
      row.unit || "",
      row.qty || "",
      row.itemName || "",
    ]);

    const allRows = [...filteredRows, ...newRows];

    // Clear and rewrite
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: "BOQ_Store!A2:F",
    });

    if (allRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `BOQ_Store!A2:F${allRows.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: allRows },
      });
    }

    // Also add item names to Sheet2
    await ensureSheetExists("Sheet2", ["Item Name"]);
    const sheet2Response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet2!A2:A",
    });
    const existingItemNames = (sheet2Response.data.values || []).map((r: any[]) => (r[0] || "").toString().trim().toLowerCase());

    const newItemNames: string[][] = [];
    for (const row of rows) {
      const itemName = (row.itemName || "").trim();
      if (itemName && !existingItemNames.includes(itemName.toLowerCase())) {
        existingItemNames.push(itemName.toLowerCase());
        newItemNames.push([itemName]);
      }
    }

    if (newItemNames.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Sheet2!A:A",
        valueInputOption: "RAW",
        requestBody: { values: newItemNames },
      });
    }

    let message = `BOQ "${boqNumber}" uploaded with ${newRows.length} items.`;
    if (newItemNames.length > 0) {
      message += ` Added ${newItemNames.length} new item(s) to Item List.`;
    }

    return NextResponse.json({ success: true, message, count: newRows.length });
  } catch (error) {
    console.error("Error uploading BOQ:", error);
    return NextResponse.json({ success: false, message: "Failed to upload BOQ" });
  }
}