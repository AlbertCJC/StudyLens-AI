import React from "react";
import { Plus, Megaphone } from "lucide-react";

interface AdminHeaderToolbarProps {
  currentUser: { name?: string | null } | null | undefined;
  hideTabs: boolean;
  activeTab: string;
  onAddUser: () => void;
  onBroadcast: () => void;
}

export const AdminHeaderToolbar: React.FC<AdminHeaderToolbarProps> = ({
  currentUser,
  hideTabs,
  activeTab,
  onAddUser,
  onBroadcast,
}) => {
  if (!hideTabs) {
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Welcome back, {currentUser?.name?.split(" ")[0] || "Admin"}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening across the platform today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onAddUser}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User Account</span>
          </button>
          <button
            onClick={onBroadcast}
            className="px-4 py-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Megaphone className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Broadcast Notice</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 flex-wrap">
      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        {activeTab === "users" && (
          <button
            onClick={onAddUser}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User Account</span>
          </button>
        )}
      </div>
    </div>
  );
};
