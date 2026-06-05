interface NavTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const tabs = [
  { id: "compose", icon: "send", label: "Compose Email" },
  { id: "boq", icon: "description", label: "BOQ Management" },
  { id: "archive", icon: "inventory_2", label: "Archive" },
];

export default function NavTabs({ activeTab, setActiveTab }: NavTabsProps) {
  return (
    <div className="flex bg-white px-6 gap-0 border-b border-[var(--border)] shadow-sm sticky top-0 z-[100] overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-6 py-3.5 font-medium text-sm border-b-[3px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === tab.id
              ? "text-[var(--primary)] font-semibold border-[var(--primary)]"
              : "text-[var(--text-secondary)] border-transparent hover:text-[var(--primary)] hover:bg-[var(--primary-glow)]"
          }`}
        >
          <span className="material-icons-outlined text-[20px]">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}