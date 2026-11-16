import React from "react";
import { Activity, RefreshCw, Download, Trash2 } from "lucide-react";

interface AdminLogsToolbarProps {
  loadingLogs: boolean;
  exportingLogs: boolean;
  lastRefreshed: string;
  onRefresh: () => void;
  onExport: () => void;
  onClear: () => void;
}

export const AdminLogsToolbar: React.FC<AdminLogsToolbarProps> = ({
  loadingLogs,
  exportingLogs,
  lastRefreshed,
  onRefresh,
  onExport,
  onClear,
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border">
      <div>
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-600" /> Activity Logs
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last update: {lastRefreshed}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={loadingLogs}
          className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin text-rose-600" : ""}`} />
          <span>Refresh</span>
        </button>

        <button
          onClick={onExport}
          disabled={exportingLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5 text-slate-300" />
          <span>{exportingLogs ? "Exporting..." : "Export CSV"}</span>
        </button>

        <button
          onClick={onClear}
          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
          title="Archive and clear the audit trail"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Logs</span>
        </button>
      </div>
    </div>
  </div>
);
