import { motion } from "motion/react";
import type { TabKey } from "./subjectDetailUtils";

interface SubjectTabsProps {
  tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function SubjectTabs({ tabs, activeTab, setActiveTab }: SubjectTabsProps) {
  return (
    <div role="tablist" className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
              isActive ? "text-structure-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="subject-tab-pill"
                className="absolute inset-0 rounded-lg bg-structure-strong"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              >
                <span className="absolute left-3 right-3 bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />
              </motion.span>
            )}
            <Icon className="relative w-3.5 h-3.5" />
            <span className="relative">{tab.label}</span>
            {(tab.count ?? 0) > 0 && (
              <span
                className={`relative px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  isActive ? "bg-card text-structure-foreground" : "bg-muted text-muted-foreground"
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
