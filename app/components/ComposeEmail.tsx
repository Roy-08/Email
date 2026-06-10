"use client";

import { useState, useEffect, useCallback } from "react";
import Notification from "./Notification";

interface BOQItem {
  srNo: string;
  description: string;
  unit: string;
  qty: string;
  itemName: string;
}

interface Vendor {
  manufacturer: string;
  contact: string;
  mobile: string;
  email: string;
}

interface ComposeEmailProps {
  showLoading: (text: string) => void;
  hideLoading: () => void;
}

const SENDER_OPTIONS = [
  "inquiry@saraswateng.com",
  "sasinair@saraswateng.com",
] as const;

export default function ComposeEmail({ showLoading, hideLoading }: ComposeEmailProps) {
  const [boqList, setBoqList] = useState<string[]>([]);
  const [selectedBOQ, setSelectedBOQ] = useState("");
  const [itemNames, setItemNames] = useState<string[]>([]);
  const [selectedItemName, setSelectedItemName] = useState("");
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<BOQItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorIndices, setSelectedVendorIndices] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const [sending, setSending] = useState(false);
  const [popup, setPopup] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [senderEmail, setSenderEmail] = useState<string>(SENDER_OPTIONS[0]);

  const autoSubject = selectedBOQ && selectedItemName ? `Q- ${selectedBOQ} Inquiry For ${selectedItemName}` : "";

  const loadBOQList = useCallback(async () => {
    try {
      const res = await fetch("/api/boq/list");
      const data = await res.json();
      if (data.success) setBoqList(data.boqNumbers);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadBOQList(); }, [loadBOQList]);

  const onBOQSelected = async (boqNumber: string) => {
    setSelectedBOQ(boqNumber);
    setSelectedItemName("");
    setVendors([]);
    setSelectedVendorIndices([]);
    if (!boqNumber) {
      setItemNames([]);
      setBoqItems([]);
      return;
    }
    showLoading("Loading BOQ items...");
    try {
      const [namesRes, itemsRes] = await Promise.all([
        fetch(`/api/boq/item-names?boqNumber=${encodeURIComponent(boqNumber)}`),
        fetch(`/api/boq/items?boqNumber=${encodeURIComponent(boqNumber)}`),
      ]);
      const namesData = await namesRes.json();
      const itemsData = await itemsRes.json();
      if (namesData.success) setItemNames(namesData.itemNames);
      if (itemsData.success) setBoqItems(itemsData.items);
    } catch { /* ignore */ }
    hideLoading();
  };

  const onItemNameFiltered = async (itemName: string) => {
    setSelectedItemName(itemName);
    setSelectedVendorIndices([]);
    if (!selectedBOQ) return;
    showLoading("Filtering items...");
    try {
      if (itemName) {
        const res = await fetch(`/api/boq/items?boqNumber=${encodeURIComponent(selectedBOQ)}&itemName=${encodeURIComponent(itemName)}`);
        const data = await res.json();
        if (data.success) setBoqItems(data.items);
        // Load vendors
        const vRes = await fetch(`/api/vendors?item=${encodeURIComponent(itemName)}`);
        const vData = await vRes.json();
        if (vData.success) setVendors(vData.vendors);
        else setVendors([]);
      } else {
        const res = await fetch(`/api/boq/items?boqNumber=${encodeURIComponent(selectedBOQ)}`);
        const data = await res.json();
        if (data.success) setBoqItems(data.items);
        setVendors([]);
      }
    } catch { /* ignore */ }
    hideLoading();
  };

  const isItemSelected = (item: BOQItem) =>
    selectedItems.some((si) => si.description === item.description && si.srNo === item.srNo);

  const toggleItem = (item: BOQItem, checked: boolean) => {
    if (checked) {
      if (!isItemSelected(item)) setSelectedItems((prev) => [...prev, item]);
    } else {
      setSelectedItems((prev) => prev.filter((si) => !(si.description === item.description && si.srNo === item.srNo)));
    }
  };

  const selectAllItems = () => {
    const newItems = [...selectedItems];
    boqItems.forEach((item) => {
      if (!newItems.some((si) => si.description === item.description && si.srNo === item.srNo)) {
        newItems.push(item);
      }
    });
    setSelectedItems(newItems);
  };

  const deselectAllItems = () => {
    setSelectedItems((prev) =>
      prev.filter((si) => !boqItems.some((item) => item.description === si.description && item.srNo === si.srNo))
    );
  };

  const toggleVendor = (index: number, checked: boolean) => {
    if (checked) setSelectedVendorIndices((prev) => [...prev, index]);
    else setSelectedVendorIndices((prev) => prev.filter((i) => i !== index));
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      const rejectedFiles: string[] = [];

      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
          rejectedFiles.push(`${file.name} (${formatFileSize(file.size)})`);
        } else {
          validFiles.push(file);
        }
      }

      if (rejectedFiles.length > 0) {
        setNotification({
          message: `The following file(s) exceed 20MB and were not added: ${rejectedFiles.join(", ")}`,
          type: "warning",
        });
      }

      if (validFiles.length > 0) {
        setAttachments((prev) => [...prev, ...validFiles]);
      }
    }
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "?";
    return ext.length > 4 ? ext.substring(0, 4) : ext;
  };

  const getFileColorClass = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return "bg-red-500";
    if (["doc", "docx"].includes(ext)) return "bg-blue-600";
    if (["xls", "xlsx", "csv"].includes(ext)) return "bg-green-600";
    if (["ppt", "pptx"].includes(ext)) return "bg-orange-500";
    if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) return "bg-purple-500";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "bg-yellow-600";
    if (["dwg", "dxf"].includes(ext)) return "bg-teal-600";
    if (["mp4", "avi", "mov"].includes(ext)) return "bg-pink-500";
    return "bg-gray-500";
  };

  const fileToBase64 = (file: File): Promise<{ name: string; mimeType: string; base64: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ name: file.name, mimeType: file.type, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sendEmails = async () => {
    setNotification(null);
    if (!autoSubject) {
      setNotification({ message: "Please select both a BOQ and an Item Name to auto-generate the email subject.", type: "warning" });
      return;
    }
    if (selectedItems.length === 0) {
      setNotification({ message: "Please select at least one item from BOQ.", type: "warning" });
      return;
    }
    const chosenVendors = selectedVendorIndices.map((i) => vendors[i]).filter(Boolean);
    if (chosenVendors.length === 0) {
      setNotification({ message: "Please select at least one vendor to send email.", type: "warning" });
      return;
    }

    setSending(true);
    showLoading("Preparing attachments & sending emails...");

    try {
      const attachmentData = await Promise.all(attachments.map(fileToBase64));
      const emailItems = selectedItems.map((item, idx) => ({
        srNo: (idx + 1).toString(),
        description: item.description,
        unit: item.unit,
        qty: item.qty,
      }));

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: autoSubject,
          items: emailItems,
          vendors: chosenVendors,
          attachments: attachmentData,
          senderEmail,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setPopup({ sent: result.sent, failed: result.failed, errors: result.errors || [] });
        // Reset
        setSelectedItems([]);
        setSelectedVendorIndices([]);
        setAttachments([]);
      } else {
        setNotification({ message: result.message || "Failed to send emails.", type: "error" });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setNotification({ message: "Error: " + errorMessage, type: "error" });
    }
    hideLoading();
    setSending(false);
  };

  return (
    <div>
      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      {/* Success Popup */}
      {popup && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-[3px] flex items-center justify-center z-[10000] animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-2xl p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] max-w-[420px] w-[90%]">
            <div className="w-[72px] h-[72px] rounded-full bg-[#e8f5e9] flex items-center justify-center mx-auto mb-5">
              <span className="material-icons-outlined text-[40px] text-[var(--success)]">check_circle</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2.5">Emails Sent Successfully!</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-2">{popup.sent} email(s) sent successfully!{popup.failed > 0 && ` ${popup.failed} failed.`}</p>
            <div className="flex justify-center gap-6 my-5 p-4 bg-[#f5f7fa] rounded-md">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--primary)]">{popup.sent}</div>
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-[var(--primary)]">{popup.failed}</div>
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Failed</div>
              </div>
            </div>
            {popup.failed > 0 && popup.errors.length > 0 && (
              <p className="text-[12px] text-[var(--danger)]">Errors: {popup.errors.join("; ")}</p>
            )}
            <button onClick={() => setPopup(null)} className="mt-5 px-8 py-3 bg-[var(--primary)] text-white rounded-md text-sm font-semibold cursor-pointer hover:bg-[var(--primary-dark)] transition-all">
              OK, Got it
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Select BOQ, Items & Vendors */}
      <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
        <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--primary)] text-white text-[13px] font-bold">1</span>
          <span className="material-icons-outlined text-[20px] text-[var(--primary)]">list_alt</span>
          Select BOQ, Items & Vendors
        </div>

        {/* Auto Subject */}
        {autoSubject && (
          <div className="mb-4 p-3 px-4 bg-[#e3f2fd] border border-[var(--primary-light)] rounded-md text-[13px] text-[var(--primary-dark)] font-medium flex items-center gap-2">
            <span className="material-icons-outlined text-[18px]">auto_fix_high</span>
            <span>Subject: <strong>{autoSubject}</strong></span>
          </div>
        )}

        {/* Send Email By */}
        <div className="mb-4">
          <label className="block font-semibold mb-1.5 text-[var(--text-primary)] text-[13px]">
            Send Email By <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="w-full p-2.5 px-3.5 border border-[var(--border)] rounded-md text-sm bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-glow)]"
          >
            {SENDER_OPTIONS.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Emails will be sent from the selected sender address.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-semibold mb-1.5 text-[var(--text-primary)] text-[13px]">
              Select BOQ <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              value={selectedBOQ}
              onChange={(e) => onBOQSelected(e.target.value)}
              className="w-full p-2.5 px-3.5 border border-[var(--border)] rounded-md text-sm bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-glow)]"
            >
              <option value="">-- Select BOQ --</option>
              {boqList.map((boq) => (
                <option key={boq} value={boq}>{boq}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1.5 text-[var(--text-primary)] text-[13px]">
              Filter by Item Name <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              value={selectedItemName}
              onChange={(e) => onItemNameFiltered(e.target.value)}
              className="w-full p-2.5 px-3.5 border border-[var(--border)] rounded-md text-sm bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_var(--primary-glow)]"
            >
              <option value="">-- All Items --</option>
              {itemNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* BOQ Items Table */}
        {boqItems.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-[13px] font-semibold m-0">Select items to include in email:</label>
              <div className="flex gap-2">
                <button onClick={selectAllItems} className="px-3 py-1.5 text-[12px] border border-[var(--primary)] text-[var(--primary)] rounded-md bg-transparent hover:bg-[var(--primary-glow)] cursor-pointer font-semibold">
                  Select All
                </button>
                <button onClick={deselectAllItems} className="px-3 py-1.5 text-[12px] border border-[var(--primary)] text-[var(--primary)] rounded-md bg-transparent hover:bg-[var(--primary-glow)] cursor-pointer font-semibold">
                  Deselect All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)] w-[40px]"></th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)] w-[60px]">Sr No.</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)]">Item Description</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)] w-[80px]">Unit</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)] w-[80px]">Qty</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase tracking-wider border-b border-[var(--border)] w-[120px]">Item Name</th>
                  </tr>
                </thead>
                <tbody>
                  {boqItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[var(--primary-glow)]">
                      <td className="p-2.5 border-b border-[var(--border-light)]">
                        <input
                          type="checkbox"
                          checked={isItemSelected(item)}
                          onChange={(e) => toggleItem(item, e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-[var(--primary)]"
                        />
                      </td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{item.srNo}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{item.description}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{item.unit}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{item.qty}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{item.itemName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vendor Panel */}
        {vendors.length > 0 && (
          <div className="mt-4 p-4 bg-[#f5f7fa] rounded-md border border-[var(--border)]">
            <h4 className="text-[13px] font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <span className="material-icons-outlined text-[18px]">business</span>
              Vendors for: {selectedItemName}
            </h4>
            <div className="flex justify-between items-center mb-2.5">
              <label className="text-[13px] m-0">Select vendors to send email:</label>
              <div className="flex gap-2">
                <button onClick={() => setSelectedVendorIndices(vendors.map((_, i) => i))} className="px-3 py-1.5 text-[12px] border border-[var(--primary)] text-[var(--primary)] rounded-md bg-transparent hover:bg-[var(--primary-glow)] cursor-pointer font-semibold">
                  Select All
                </button>
                <button onClick={() => setSelectedVendorIndices([])} className="px-3 py-1.5 text-[12px] border border-[var(--primary)] text-[var(--primary)] rounded-md bg-transparent hover:bg-[var(--primary-glow)] cursor-pointer font-semibold">
                  Deselect All
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)] w-[40px]"></th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Manufacturer / Dealer</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Contact Person</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Mobile</th>
                    <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, idx) => (
                    <tr key={idx} className="hover:bg-[var(--primary-glow)]">
                      <td className="p-2.5 border-b border-[var(--border-light)]">
                        <input
                          type="checkbox"
                          checked={selectedVendorIndices.includes(idx)}
                          onChange={(e) => toggleVendor(idx, e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-[var(--primary)]"
                        />
                      </td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{v.manufacturer}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{v.contact}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{v.mobile}</td>
                      <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{v.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-[var(--text-muted)] font-medium">{vendors.length} vendor(s) available</p>
          </div>
        )}

        {/* Selected Items Summary */}
        {selectedItems.length > 0 && (
          <div className="mt-4">
            <label className="text-[13px] font-semibold flex items-center gap-1.5 mb-2">
              <span className="material-icons-outlined text-[16px]">checklist</span>
              Selected Items for Email:
            </label>
            <div className="border border-[var(--border)] rounded-md p-3.5 bg-[#fafbfc]">
              <div className="overflow-x-auto rounded-md border border-[var(--border)]">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="bg-[var(--primary)] text-white p-2.5 text-left font-semibold">Sr No.</th>
                      <th className="bg-[var(--primary)] text-white p-2.5 text-left font-semibold">Description</th>
                      <th className="bg-[var(--primary)] text-white p-2.5 text-center font-semibold">Unit</th>
                      <th className="bg-[var(--primary)] text-white p-2.5 text-center font-semibold">Qty</th>
                      <th className="bg-[var(--primary)] text-white p-2.5 text-center font-semibold w-[50px]">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-b border-[var(--border-light)]">{idx + 1}</td>
                        <td className="p-2 border-b border-[var(--border-light)]">{item.description.substring(0, 100)}{item.description.length > 100 ? "..." : ""}</td>
                        <td className="p-2 border-b border-[var(--border-light)] text-center">{item.unit}</td>
                        <td className="p-2 border-b border-[var(--border-light)] text-center">{item.qty}</td>
                        <td className="p-2 border-b border-[var(--border-light)] text-center">
                          <span className="cursor-pointer text-[var(--danger)] font-bold text-[16px]" onClick={() => setSelectedItems((prev) => prev.filter((_, i) => i !== idx))}>✕</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-[var(--primary)] font-semibold">{selectedItems.length} item(s) selected</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Attachments */}
      <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
        <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--primary)] text-white text-[13px] font-bold">2</span>
          <span className="material-icons-outlined text-[20px] text-[var(--primary)]">attach_file</span>
          Attachments (Optional)
          {attachments.length > 0 && (
            <span className="ml-auto text-[12px] font-semibold text-[var(--primary)] bg-[#e3f2fd] px-2.5 py-1 rounded-full">
              {attachments.length} file{attachments.length > 1 ? "s" : ""} • {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))}
            </span>
          )}
        </div>

        <label className="block border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer bg-[#fafbfc] hover:border-[var(--primary)] hover:bg-[var(--primary-glow)] transition-all">
          <span className="material-icons-outlined text-[36px] text-[var(--text-muted)]">cloud_upload</span>
          <p className="text-[14px] font-semibold text-[var(--text-primary)] mt-2">Click to upload attachments</p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">PDF, Images, Excel, Word, ZIP — Max 20MB per file</p>
          <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
        </label>

        {/* Total size warning */}
        {attachments.length > 0 && attachments.reduce((sum, f) => sum + f.size, 0) > 20 * 1024 * 1024 && (
          <div className="mt-3 p-3 bg-[#fff3e0] border border-[#ffcc80] rounded-md flex items-center gap-2 text-[12px] text-[#e65100]">
            <span className="material-icons-outlined text-[18px]">warning</span>
            <span><strong>Warning:</strong> Total attachment size exceeds 20MB. Some email providers may reject large emails. Consider reducing file sizes.</span>
          </div>
        )}

        {/* Attachment list */}
        {attachments.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">folder_open</span>
                Files to be sent with email:
              </label>
              {attachments.length > 1 && (
                <button
                  onClick={() => setAttachments([])}
                  className="px-3 py-1 text-[11px] border border-[var(--danger)] text-[var(--danger)] rounded-md bg-transparent hover:bg-red-50 cursor-pointer font-semibold transition-all"
                >
                  Remove All
                </button>
              )}
            </div>
            <div className="border border-[var(--border)] rounded-md overflow-hidden">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-4 py-3 ${idx !== attachments.length - 1 ? "border-b border-[var(--border-light)]" : ""} hover:bg-[#f5f7fa] transition-colors`}
                >
                  {/* File type icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold uppercase shrink-0 ${getFileColorClass(file.name)}`}>
                    {getFileExtension(file.name)}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{file.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {formatFileSize(file.size)} • {file.type || "Unknown type"}
                    </p>
                  </div>

                  {/* Size indicator bar */}
                  <div className="hidden sm:block w-[60px]">
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${file.size > 10 * 1024 * 1024 ? "bg-[var(--danger)]" : file.size > 5 * 1024 * 1024 ? "bg-[#ff9800]" : "bg-[var(--success)]"}`}
                        style={{ width: `${Math.min((file.size / (20 * 1024 * 1024)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-all shrink-0"
                    title="Remove attachment"
                  >
                    <span className="material-icons-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="mt-2.5 flex items-center justify-between text-[12px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined text-[14px]">info</span>
                {attachments.length} attachment{attachments.length > 1 ? "s" : ""} will be sent to each selected vendor
              </span>
              <span className="font-semibold text-[var(--text-secondary)]">
                Total: {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Send */}
      <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
        <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--primary)] text-white text-[13px] font-bold">3</span>
          <span className="material-icons-outlined text-[20px] text-[var(--primary)]">send</span>
          Send Email
        </div>
        <div className="text-center py-3">
          <button
            onClick={sendEmails}
            disabled={sending}
            className="px-10 py-3.5 bg-[var(--primary)] text-white text-[15px] font-semibold rounded-lg cursor-pointer hover:bg-[var(--primary-dark)] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <span className="material-icons-outlined text-[20px]">send</span>
            SEND EMAIL
          </button>
          <p className="mt-2.5 text-[var(--text-muted)] text-[13px]">Selected items & attachments will be sent to all checked vendors</p>
        </div>
      </div>
    </div>
  );
}
