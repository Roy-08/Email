"use client";

import { useState } from "react";
import Header from "./components/Header";
import NavTabs from "./components/NavTabs";
import ComposeEmail from "./components/ComposeEmail";
import BOQManagement from "./components/BOQManagement";
import Archive from "./components/Archive";
import LoadingOverlay from "./components/LoadingOverlay";

export default function Home() {
  const [activeTab, setActiveTab] = useState("compose");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Processing...");

  const showLoading = (text: string) => {
    setLoadingText(text);
    setLoading(true);
  };
  const hideLoading = () => setLoading(false);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <LoadingOverlay visible={loading} text={loadingText} />
      <main className="flex-1 p-6 max-w-[1200px] mx-auto w-full">
        {activeTab === "compose" && (
          <ComposeEmail showLoading={showLoading} hideLoading={hideLoading} />
        )}
        {activeTab === "boq" && (
          <BOQManagement showLoading={showLoading} hideLoading={hideLoading} />
        )}
        {activeTab === "archive" && (
          <Archive showLoading={showLoading} hideLoading={hideLoading} />
        )}
      </main>
    </div>
  );
}