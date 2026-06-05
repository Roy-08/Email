"use client";

import { useState } from "react";

interface ArchiveRecord {
  date: string;
  subject: string;
  description: string;
  vendor: string;
  contact: string;
  email: string;
  mobile: string;
  status: string;
}

interface ArchiveProps {
  showLoading: (text: string) => void;
  hideLoading: () => void;
}

export default function Archive({ showLoading, hideLoading }: ArchiveProps) {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadArchive = async () => {
    showLoading("Loading archive...");
    try {
      const res = await fetch("/api/archive");
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
        setLoaded(true);
      }
    } catch { /* ignore */ }
    hideLoading();
  };

  return (
    <div className="bg-white rounded-lg p-6 mb-5 shadow-sm border border-[var(--border-light)]">
      <div className="text-[15px] font-bold text-[var(--text-primary)] mb-5 flex items-center gap-3 pb-3.5 border-b border-[var(--border-light)]">
        <span className="material-icons-outlined text-[20px] text-[var(--primary)]">inventory_2</span>
        Email Archive
      </div>
      <button onClick={loadArchive} className="mb-4 px-4 py-2 bg-[var(--primary)] text-white rounded-md text-[13px] font-semibold cursor-pointer hover:bg-[var(--primary-dark)] inline-flex items-center gap-1.5">
        <span className="material-icons-outlined text-[16px]">refresh</span> Refresh Archive
      </button>
      <div className="overflow-x-auto rounded-md border border-[var(--border)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Date</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Subject</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Vendor</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Contact</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Email</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Mobile</th>
              <th className="bg-[#f5f7fa] p-3 text-left font-semibold text-[12px] uppercase border-b border-[var(--border)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              <tr>
                <td colSpan={7} className="text-center text-[var(--text-muted)] p-6">Click &ldquo;Refresh Archive&rdquo; to load data</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-[var(--text-muted)] p-6">No records found</td>
              </tr>
            ) : (
              records.map((r, idx) => (
                <tr key={idx} className="hover:bg-[var(--primary-glow)]">
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.date}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.subject}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.vendor}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.contact}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.email}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)] text-[var(--text-secondary)]">{r.mobile}</td>
                  <td className="p-2.5 border-b border-[var(--border-light)]">
                    <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] font-semibold ${r.status.indexOf("Sent") !== -1 ? "bg-[#e8f5e9] text-[#1b5e20]" : "bg-[#ffebee] text-[#b71c1c]"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}