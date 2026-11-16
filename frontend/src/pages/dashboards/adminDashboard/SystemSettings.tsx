import React from "react";
import { Download, Lock, Wrench, Check, CheckCircle2, Settings as SettingsIcon } from "lucide-react";

interface SystemSettingsProps {
  systemSettings: {
    require2FA: boolean;
    maintenanceMode: boolean;
    sessionTimeoutMins: number;
    autoAuditArchiving: boolean;
  };
  setSystemSettings: (next: {
    require2FA: boolean;
    maintenanceMode: boolean;
    sessionTimeoutMins: number;
    autoAuditArchiving: boolean;
  }) => void;
  settingsSavedMessage: string | null;
  settingsSavedAt: string | null;
  savingSettings: boolean;
  backupLoading: boolean;
  handleSaveSettings: (e: React.FormEvent) => void;
  handleResetSettings: () => void;
  handleExportSystemBackup: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  systemSettings,
  setSystemSettings,
  settingsSavedMessage,
  settingsSavedAt,
  savingSettings,
  backupLoading,
  handleSaveSettings,
  handleResetSettings,
  handleExportSystemBackup,
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
    <div className="flex items-center justify-between border-b border-border pb-3">
      <div>
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-rose-600" /> System Settings & Governance
        </h3>
      </div>

      <button
        onClick={handleExportSystemBackup}
        disabled={backupLoading}
        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{backupLoading ? "Creating Backup..." : "Download System Backup"}</span>
      </button>
    </div>

    {settingsSavedMessage && (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 font-bold flex items-center space-x-2 animate-in fade-in">
        <CheckCircle2 className="w-4 h-4" />
        <span>{settingsSavedMessage}{settingsSavedAt ? ` (saved ${settingsSavedAt})` : ""}</span>
      </div>
    )}

    <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        These settings are stored in the database and take effect immediately for the whole platform.
      </p>

      <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
        <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
          <Lock className="w-4 h-4 text-rose-600" />
          <span>Security & Authentication</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
            <div>
              <p className="font-bold text-foreground">Require Multi-Factor Authentication (2FA)</p>
              <p className="text-[11px] text-muted-foreground">Require a one-time 6-digit code after password login for faculty and administrative roles</p>
            </div>
            <input
              type="checkbox"
              checked={systemSettings.require2FA}
              onChange={(e) => setSystemSettings({ ...systemSettings, require2FA: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer"
            />
          </div>

          <div className="p-3 bg-card border border-border rounded-xl">
            <label className="block font-bold mb-1">Session Lifetime (Minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={systemSettings.sessionTimeoutMins}
              onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeoutMins: Number(e.target.value) })}
              className="w-full p-2.5 bg-card border border-border rounded-xl font-mono text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-1">JWT sessions expire after this many minutes from login (5–1440 minutes).</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
        <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
          <Wrench className="w-4 h-4 text-rose-600" />
          <span>Maintenance & Data Retention</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
            <div>
              <p className="font-bold text-foreground">System Maintenance Mode</p>
              <p className="text-[11px] text-muted-foreground">Restrict all non-admin access while the platform is being updated</p>
            </div>
            <input
              type="checkbox"
              checked={systemSettings.maintenanceMode}
              onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
            <div>
              <p className="font-bold text-foreground">Auto Audit Log Archiving</p>
              <p className="text-[11px] text-muted-foreground">Automatically archive activity logs after 90 days</p>
            </div>
            <input
              type="checkbox"
              checked={systemSettings.autoAuditArchiving}
              onChange={(e) => setSystemSettings({ ...systemSettings, autoAuditArchiving: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-3">
        <button
          type="button"
          onClick={handleResetSettings}
          className="px-4 py-2.5 border border-border text-foreground text-xs font-bold rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          type="submit"
          disabled={savingSettings}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{savingSettings ? "Saving..." : "Save Settings"}</span>
        </button>
      </div>
    </form>
  </div>
);
