"use client";

import { useState, useEffect, useCallback } from "react";
import Notification from "./Notification";
import * as XLSX from "xlsx";

interface UploadedRow {
  srNo: string;
  description: string;
  unit: string;
  qty: string;
  itemName: string;
}

interface BOQManagementProps {
  showLoading: (text: string) => void;
  hideLoading: () => void;
}

export default function BOQManagement({ showLoading, hideLoading }: BOQManagementProps) {
  const [boqList, setBoqList] = useState<string[]>([]);
  const [boqNumber, setBoqNumber] = useState("");
  const [uploadedData, setUploadedData] = useState<UploadedRow[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const [deleteNotification, setDeleteNotification] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadStoredBOQs = useCallback(async () => {
    try {
      const res = await fetch("/api/boq/list");
      const data = await res.json();
      if (data.success) setBoqList(data.boqNumbers);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStoredBOQs(); }, [loadStoredBOQs]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleFile = (file: File) => {
    if (!boqNumber.trim()) {
      setNotification({ message: "Please enter a BOQ Number/Name first.", type: "warning" });
      return;
    }
    showLoading("Parsing Excel file...");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: false });
        // Prefer "Sheet1" tab if it exists, otherwise fall back to the first sheet
        const sheetName = workbook.SheetNames.find(
          (name) => name.toLowerCase() === "sheet1" || name.toLowerCase() === "sheet 1"
        ) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Use raw:true to get actual cell values without formatting issues
        // Use defval:"" to ensure empty cells are represented as empty strings
        const jsonData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true });

        if (jsonData.length < 2) {
          hideLoading();
          setNotification({ message: "File has too few rows.", type: "error" });
          return;
        }

        // Search for header row across a wider range (rows 0-20) to handle various Excel formats
        let headerRow: string[] | null = null;
        let headerIndex = -1;

        for (let h = 0; h < Math.min(jsonData.length, 20); h++) {
          const row = jsonData[h];
          if (!row || row.length === 0) continue;
          const rowStr = row.map(cell => String(cell || "")).join(" ").toLowerCase();
          // Look for a row that contains both "item description" (or "description") AND "unit" AND "qty"
          const hasDescription = rowStr.indexOf("item description") !== -1 || rowStr.indexOf("description") !== -1;
          const hasUnit = rowStr.indexOf("unit") !== -1;
          const hasQty = rowStr.indexOf("qty") !== -1 || rowStr.indexOf("quantity") !== -1;
          if (hasDescription && hasUnit && hasQty) {
            headerRow = row.map(cell => String(cell || ""));
            headerIndex = h;
            break;
          }
        }

        // Fallback: search for just "item description" or "description"
        if (!headerRow) {
          for (let h = 0; h < Math.min(jsonData.length, 20); h++) {
            const row = jsonData[h];
            if (!row || row.length === 0) continue;
            const rowStr = row.map(cell => String(cell || "")).join(" ").toLowerCase();
            if (rowStr.indexOf("item description") !== -1 || rowStr.indexOf("description") !== -1) {
              headerRow = row.map(cell => String(cell || ""));
              headerIndex = h;
              break;
            }
          }
        }

        if (!headerRow) {
          const fallbackRow = jsonData[4] || jsonData[0];
          headerRow = fallbackRow ? fallbackRow.map(cell => String(cell || "")) : [];
          headerIndex = jsonData[4] ? 4 : 0;
        }

        const colMap = { srNo: -1, description: -1, unit: -1, qty: -1, itemName: -1 };

        for (let c = 0; c < headerRow.length; c++) {
          const colName = (headerRow[c] || "").toString().toLowerCase().trim()
            .replace(/\r?\n/g, " ")  // Handle line breaks within cells
            .replace(/\s+/g, " ");   // Normalize whitespace
          if (!colName) continue;
          
          // Sr. No. detection - various formats
          if (colMap.srNo === -1) {
            if ((colName.indexOf("sr") !== -1 && colName.indexOf("no") !== -1) || 
                colName === "s.no" || colName === "s.no." || colName === "sno" ||
                colName === "sl no" || colName === "sl.no" || colName === "sl. no." ||
                colName === "#" || colName === "no." || colName === "no") {
              colMap.srNo = c;
              continue;
            }
          }
          
          // Item Name detection (check before description to avoid conflicts)
          if (colMap.itemName === -1) {
            if (colName === "item name" || colName === "itemname" || 
                colName === "item_name" || colName === "material name" ||
                (colName.indexOf("item") !== -1 && colName.indexOf("name") !== -1 && colName.indexOf("description") === -1)) {
              colMap.itemName = c;
              continue;
            }
          }
          
          // Description detection
          if (colMap.description === -1) {
            if (colName.indexOf("item description") !== -1 || 
                colName.indexOf("description") !== -1 ||
                colName === "particulars" ||
                colName.indexOf("work description") !== -1 ||
                colName.indexOf("scope of work") !== -1) {
              colMap.description = c;
              continue;
            }
          }
          
          // Unit detection
          if (colMap.unit === -1) {
            if (colName === "unit" || colName === "uom" || colName === "units") {
              colMap.unit = c;
              continue;
            }
          }
          
          // Qty detection
          if (colMap.qty === -1) {
            if (colName === "qty" || colName === "quantity" || colName === "qty." ||
                colName === "total qty" || colName === "total quantity" ||
                (colName.indexOf("qty") !== -1) || (colName.indexOf("quantity") !== -1)) {
              colMap.qty = c;
              continue;
            }
          }
        }

        // Debug: log column mapping to console for troubleshooting
        console.log("Header found at row index:", headerIndex, "Header row:", headerRow);
        console.log("Column mapping:", colMap);

        const parsed: UploadedRow[] = [];
        for (let r = headerIndex + 1; r < jsonData.length; r++) {
          const dataRow = jsonData[r];
          if (!dataRow || dataRow.length === 0) continue;
          
          // Skip completely empty rows (all cells empty)
          const hasAnyContent = dataRow.some((cell) => String(cell ?? "").trim() !== "");
          if (!hasAnyContent) continue;

          const desc = colMap.description >= 0 ? String(dataRow[colMap.description] ?? "").trim() : "";
          const unit = colMap.unit >= 0 ? String(dataRow[colMap.unit] ?? "").trim() : "";
          const qty = colMap.qty >= 0 ? String(dataRow[colMap.qty] ?? "").trim() : "";
          const itemName = colMap.itemName >= 0 ? String(dataRow[colMap.itemName] ?? "").trim() : "";

          // A row is valid if it has at least Item Description AND Qty filled
          // Unit can sometimes be empty for certain items, so we only require desc + qty
          if (!desc || !qty) continue;

          // Extract numeric value from qty - handle formats like "4", "4.0", "4,000", "4 nos", "4.00 sqm" etc.
          const qtyClean = qty.replace(/,/g, "").replace(/[^0-9.\-]/g, " ").trim().split(/\s+/)[0];
          const qtyNum = parseFloat(qtyClean);
          
          // Only skip if qty is truly not a number at all (like "-" or pure text)
          // Allow qty = 0 if explicitly stated, but skip NaN
          if (isNaN(qtyNum)) continue;

          // Skip sub-total or summary rows - use stricter matching to avoid false positives
          const descLower = desc.toLowerCase().trim();
          // Only skip if the description IS a total/subtotal line (starts with or is primarily about totals)
          const isTotalRow = /^(sub\s*-?\s*total|subtotal|grand\s*total|total)\b/i.test(descLower) ||
            /\b(sub\s*-?\s*total|subtotal|grand\s*total)\s*[:=]?\s*$/i.test(descLower);
          if (isTotalRow) continue;

          // Skip section header rows only if they EXACTLY match known headers (not as substrings)
          const isSectionHeader = /^(schedule of quantities|general notes)\s*$/i.test(descLower);
          if (isSectionHeader) continue;

          parsed.push({
            srNo: colMap.srNo >= 0 ? String(dataRow[colMap.srNo] ?? "") : (parsed.length + 1).toString(),
            description: desc,
            unit: unit,
            qty: qty,
            itemName: itemName,
          });
        }

        hideLoading();
        if (parsed.length === 0) {
          setNotification({ message: "No valid data found in the file.", type: "error" });
          return;
        }
        setUploadedData(parsed);
        setNotification({ message: `Parsed ${parsed.length} items from file. Review below and click "Confirm & Save".`, type: "success" });
      } catch (err: unknown) {
        hideLoading();
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setNotification({ message: "Error parsing file: " + errorMessage, type: "error" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = async () => {
    if (!boqNumber.trim()) {
      setNotification({ message: "Enter BOQ Number first.", type: "warning" });
      return;
    }
    if (uploadedData.length === 0) {
      setNotification({ message: "No data to upload.", type: "warning" });
      return;
    }
    showLoading("Saving BOQ to Google Sheets...");
    try {
      const res = await fetch("/api/boq/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boqNumber: boqNumber.trim(), rows: uploadedData }),
      });
      const result = await res.json();
      hideLoading();
      if (result.success) {
        setNotification({ message: result.message, type: "success" });
        setUploadedData([]);
        setBoqNumber("");
        loadStoredBOQs();
      } else {
        setNotification({ message: result.message, type: "error" });
      }
    } catch (err: unknown) {
      hideLoading();
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setNotification({ message: "Error: " + errorMessage, type: "error" });
    }
  };

  const executeDelete = async () => {
    if (!pendingDelete) return;
    showLoading("Deleting BOQ...");
    try {
      const res = await fetch("/api/boq/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boqNumber: pendingDelete }),
      });
      const result = await res.json();
      hideLoading();
      setDeleteNotification({ message: result.message, type: result.success ? "success" : "error" });
      loadStoredBOQs();
    } catch (err: unknown) {
      hideLoading();
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setDeleteNotification({ message: "Error: " + errorMessage, type: "error" });
    }
    setPendingDelete(null);
  };

  return (
    <div>
      {/* Upload BOQ */}
      <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
        <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
          <span className="material-icons-outlined text-[20px] text-[var(--primary)]">cloud_upload</span>
          Upload New BOQ
        </div>

        {notification && (
          <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
        )}

        <div className="mb-4">
          <label className="block font-semibold mb-1.5 text-[var(--text-primary)] text-[13px]">
            BOQ Number/Name <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            type="text"
            value={boqNumber}
            onChange={(e) => setBoqNumber(e.target.value)}
            placeholder="Enter BOQ number or name (e.g., BOQ-001, Electrical-2025)"
            className="w-full p-2.5 px-3.5 border border-[var(--border)] rounded-md text-sm bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-glow)]"
          />
        </div>

        <label className="block border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center cursor-pointer bg-[#fafbfc] hover:border-[var(--primary)] hover:bg-[var(--primary-glow)] transition-all">
          <span className="material-icons-outlined text-[40px] text-[var(--text-muted)]">upload_file</span>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-2">Click to upload or drag & drop Excel file here</p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">Supports .xlsx, .xls files • Headers auto-detected: Sr. No., Item Description, Unit, Qty, Item Name</p>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        </label>

        {/* Preview */}
        {uploadedData.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-[13px] m-0 font-semibold">Preview ({uploadedData.length} items total):</label>
              <button onClick={confirmUpload} className="px-4 py-2 bg-[var(--success)] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#1b5e20] inline-flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">check_circle</span> Confirm & Save BOQ
              </button>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--border)] max-h-[500px] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0">
                  <tr>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Sr No.</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Item Description</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Unit</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Qty</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Item Name</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--primary-glow)]">
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{row.srNo}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{row.description.substring(0, 150)}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{row.unit}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{row.qty}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{row.itemName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">Total: {uploadedData.length} items will be uploaded</p>
          </div>
        )}
      </div>

      {/* Stored BOQs */}
      <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
        <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
          <span className="material-icons-outlined text-[20px] text-[var(--primary)]">folder_open</span>
          Stored BOQs
        </div>

        {deleteNotification && (
          <Notification message={deleteNotification.message} type={deleteNotification.type} onClose={() => setDeleteNotification(null)} />
        )}

        {boqList.length === 0 ? (
          <p className="text-[var(--text-muted)] italic">No BOQs stored yet. Upload one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">BOQ Number</th>
                  <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)] w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boqList.map((boq) => (
                  <tr key={boq} className="hover:bg-[var(--primary-glow)]">
                    <td className="p-2.5 border-b border-[var(--border-light)] font-semibold">{boq}</td>
                    <td className="p-2.5 border-b border-[var(--border-light)]">
                      <button onClick={() => setPendingDelete(boq)} className="px-3 py-1.5 bg-[var(--danger)] text-white rounded-md text-[12px] font-semibold cursor-pointer hover:bg-[#b71c1c] inline-flex items-center gap-1">
                        <span className="material-icons-outlined text-[14px]">delete</span> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation */}
        {pendingDelete && (
          <div className="mt-4 p-6 bg-[#fff8e1] border border-[#ffe082] rounded-lg">
            <h3 className="text-[#e65100] mb-3.5 text-[15px] flex items-center gap-2 font-bold">
              <span className="material-icons-outlined text-[20px]">warning_amber</span>
              Confirm Delete
            </h3>
            <div className="bg-white rounded-md p-4 mb-4 text-[13px] border border-[#ffe082]">
              Are you sure you want to delete BOQ <strong>&ldquo;{pendingDelete}&rdquo;</strong>? This action cannot be undone.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setPendingDelete(null)} className="px-4 py-2 bg-[#607d8b] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#455a64] inline-flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">close</span> Cancel
              </button>
              <button onClick={executeDelete} className="px-4 py-2 bg-[var(--danger)] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#b71c1c] inline-flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">delete</span> Yes, Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
