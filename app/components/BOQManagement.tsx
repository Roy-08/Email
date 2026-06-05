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
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (jsonData.length < 6) {
          hideLoading();
          setNotification({ message: "File has too few rows. Expected headers at row 5 and data from row 6.", type: "error" });
          return;
        }

        let headerRow: string[] | null = null;
        let headerIndex = -1;

        for (let h = 3; h <= 6; h++) {
          if (h < jsonData.length) {
            const rowStr = jsonData[h].join(" ").toLowerCase();
            if (rowStr.indexOf("item description") !== -1 || rowStr.indexOf("description") !== -1) {
              headerRow = jsonData[h];
              headerIndex = h;
              break;
            }
          }
        }

        if (!headerRow) {
          headerRow = jsonData[4];
          headerIndex = 4;
        }

        const colMap = { srNo: -1, description: -1, unit: -1, qty: -1, itemName: -1 };

        for (let c = 0; c < headerRow.length; c++) {
          const colName = headerRow[c].toString().toLowerCase().trim();
          if (colName.indexOf("sr") !== -1 && colName.indexOf("no") !== -1) colMap.srNo = c;
          else if (colName.indexOf("item description") !== -1 || (colName.indexOf("description") !== -1 && colMap.description === -1)) colMap.description = c;
          else if (colName === "unit") colMap.unit = c;
          else if (colName === "qty" || colName === "quantity") colMap.qty = c;
          else if (colName.indexOf("item name") !== -1) colMap.itemName = c;
        }

        const parsed: UploadedRow[] = [];
        for (let r = headerIndex + 1; r < jsonData.length; r++) {
          const dataRow = jsonData[r];
          const desc = colMap.description >= 0 ? dataRow[colMap.description] : "";
          if (!desc || desc.toString().trim() === "") continue;

          parsed.push({
            srNo: colMap.srNo >= 0 ? dataRow[colMap.srNo].toString() : (parsed.length + 1).toString(),
            description: desc.toString().trim(),
            unit: colMap.unit >= 0 ? dataRow[colMap.unit].toString().trim() : "",
            qty: colMap.qty >= 0 ? dataRow[colMap.qty].toString().trim() : "",
            itemName: colMap.itemName >= 0 ? dataRow[colMap.itemName].toString().trim() : "",
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
          <p className="text-[12px] text-[var(--text-muted)] mt-1">Supports .xlsx, .xls files • Row 5 should have headers: Sr. No., Item Description, Unit, Qty, Item Name</p>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        </label>

        {/* Preview */}
        {uploadedData.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-[13px] m-0 font-semibold">Preview (first 20 rows):</label>
              <button onClick={confirmUpload} className="px-4 py-2 bg-[var(--success)] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[#1b5e20] inline-flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">check_circle</span> Confirm & Save BOQ
              </button>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Sr No.</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Item Description</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Unit</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Qty</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Item Name</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedData.slice(0, 20).map((row, idx) => (
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
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">Showing {Math.min(uploadedData.length, 20)} of {uploadedData.length} items</p>
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