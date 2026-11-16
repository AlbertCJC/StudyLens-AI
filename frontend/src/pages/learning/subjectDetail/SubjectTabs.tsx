import type { TabKey } from "./subjectDetailUtils";

interface SubjectTabsProps {
  tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function SubjectTabs({ tabs, activeTab, setActiveTab }: SubjectTabsProps) {
  return (
    <div className="flex items-center space-x-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {(tab.count ?? 0) > 0 && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
