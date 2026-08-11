import React, { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  Rocket,
  KeyRound,
  Database,
  CloudUpload,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wifi,
  Copy,
  XCircle,
  Globe,
  Check,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  probeUrl,
  loadRemoteEndpoint,
  saveRemoteEndpoint,
  appendSystemPath,
} from "../../utils/backendProbe";
import type { ProbeResult } from "../../utils/backendProbe";

const CURRENT_BACKEND_URL = `${window.location.origin}/api/system/info`;

export const RemotePage: React.FC = () => {
  const [currentHealth, setCurrentHealth] = useState<ProbeResult | null>(null);
  const [checkingCurrent, setCheckingCurrent] = useState(true);
  const [remoteInput, setRemoteInput] = useState<string>(() => loadRemoteEndpoint());
  const [remoteHealth, setRemoteHealth] = useState<ProbeResult | null>(null);
  const [checkingRemote, setCheckingRemote] = useState(false);
  const [saved, setSaved] = useState(false);

  const runCurrentProbe = useCallback(async () => {
    setCheckingCurrent(true);
    const result = await probeUrl(CURRENT_BACKEND_URL);
    setCurrentHealth(result);
    setCheckingCurrent(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    probeUrl(CURRENT_BACKEND_URL).then((result) => {
      if (cancelled) return;
      setCurrentHealth(result);
      setCheckingCurrent(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const testRemote = useCallback(async () => {
    setCheckingRemote(true);
    const result = await probeUrl(appendSystemPath(remoteInput.trim()));
    setRemoteHealth(result);
    setCheckingRemote(false);
  }, [remoteInput]);

  const saveRemote = useCallback(() => {
    saveRemoteEndpoint(remoteInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [remoteInput]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#5b51d8]/10 text-[#5b51d8] rounded-xl">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Remote Cloud Deployment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect the platform to a hosted Flask + Groq Inference backend for institution-wide access
            </p>
          </div>
        </div>
        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-[#5b51d8]/10 text-[#5b51d8] border border-[#5b51d8]/20">
          <Wifi className="w-3 h-3" />
          <span>Cloud Hosted Mode</span>
        </span>
      </div>

      {/* Current backend status */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Backend Serving This Session</h3>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={runCurrentProbe} disabled={checkingCurrent}>
            {checkingCurrent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {checkingCurrent ? "Checking..." : "Re-check"}
          </Button>
        </div>

        <div className={`flex items-start space-x-3 p-4 rounded-xl border ${
          currentHealth?.ok === false ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30"
        }`}>
          {currentHealth?.ok === false ? (
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${currentHealth?.ok === false ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {checkingCurrent ? "Contacting backend..." : currentHealth?.ok === false ? "Unreachable" : "Healthy"}
              </span>
              {currentHealth?.latency !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground font-semibold">
                  {currentHealth.latency} ms
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{currentHealth?.url || CURRENT_BACKEND_URL}</p>
            {currentHealth?.error && <p className="text-xs text-red-500">{currentHealth.error}</p>}
            {currentHealth?.ok && currentHealth.info && (
              <>
                <p className="text-sm font-semibold text-foreground leading-snug">{currentHealth.info.platformName}</p>
                <p className="text-xs text-muted-foreground">
                  {currentHealth.info.version} • {currentHealth.info.institution}
                </p>
              </>
            )}
          </div>
        </div>

        {currentHealth?.ok && currentHealth.info?.techStack && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(currentHealth.info.techStack).map(([label, value]) => (
              <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-[10px] text-muted-foreground">
                <Check className="w-3 h-3 text-[#5b51d8]" />
                <span className="font-semibold text-foreground">{label}:</span>
                {value}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Remote endpoint configuration */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <Rocket className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Remote Endpoint Configuration</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Enter the base API URL of your hosted StudyLens backend (the deployed Flask + Groq server), then run a
          connection test. The verified endpoint is saved on this device for the deployment dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={remoteInput}
            onChange={(e) => setRemoteInput(e.target.value)}
            placeholder="https://api.studylens-institution.edu/api"
            className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" className="gap-1.5" onClick={testRemote} disabled={checkingRemote || !remoteInput.trim()}>
            {checkingRemote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {checkingRemote ? "Testing..." : "Test Connection"}
          </Button>
          <Button className="gap-1.5 bg-[#5b51d8] hover:bg-[#5b51d8]/90" onClick={saveRemote} disabled={!remoteInput.trim()}>
            {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            {saved ? "Saved" : "Save Endpoint"}
          </Button>
        </div>

        {remoteHealth && (
          <div className={`mt-4 flex items-start space-x-3 p-4 rounded-xl border ${
            remoteHealth.ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
          }`}>
            {remoteHealth.ok ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <span className={`text-xs font-bold ${remoteHealth.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {remoteHealth.ok ? `Remote backend reachable (${remoteHealth.latency} ms)` : `Connection failed — ${remoteHealth.error || "unknown error"}`}
              </span>
              <p className="text-xs text-muted-foreground truncate">{remoteHealth.url}</p>
              {remoteHealth.ok && remoteHealth.info?.version && (
                <p className="text-xs text-foreground font-semibold">{remoteHealth.info.version}</p>
              )}
              {!remoteHealth.ok && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Cross-origin checks may be blocked by CORS. Verify the backend is deployed, CORS is enabled on the
                  Flask server, and the exposed port matches this URL.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Cloud provisioning checklist */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <h3 className="text-sm font-bold text-foreground mb-4">Cloud Provisioning Checklist</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <ChecklistRow icon={<KeyRound className="w-4 h-4" />} title="Groq Inference API Key"
            detail="Get a free key at console.groq.com/keys and set GROQ_API_KEY in the deployed environment." />
          <ChecklistRow icon={<Database className="w-4 h-4" />} title="Managed MySQL Database"
            detail="Provision MySQL 8+ (or keep SQLite fallback) and set MYSQL_DATABASE_URL for the Flask backend." />
          <ChecklistRow icon={<CloudUpload className="w-4 h-4" />} title="Cloud Object Storage"
            detail="Configure Cloudinary URL or Firebase Storage bucket for uploaded PDFs, DOCX modules, and reviewer files." />
          <ChecklistRow icon={<Rocket className="w-4 h-4" />} title="Deploy Flask Backend"
            detail="Ship app.py and groq_service.py to a cloud host (Render, Railway, or a VM) and expose port 5000/HTTPS." />
          <ChecklistRow icon={<Cloud className="w-4 h-4" />} title="Build & Host Frontend"
            detail="Run the production build and serve it (the embedded Node companion server can host static assets)." />
          <ChecklistRow icon={<Globe className="w-4 h-4" />} title="Point Mobile at Remote API"
            detail="Update the mobile API_BASE_URL to the deployed endpoint so the React-Native app uses the same cloud backend." />
        </div>
      </section>
    </div>
  );
};

interface ChecklistRowProps {
  icon: React.ReactNode;
  title: string;
  detail: string;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ icon, title, detail }) => (
  <div className="flex items-start space-x-3 p-4 rounded-xl bg-background border border-border">
    <div className="p-2 bg-[#5b51d8]/10 text-[#5b51d8] rounded-lg shrink-0">{icon}</div>
    <div>
      <p className="text-xs font-bold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
    </div>
  </div>
);

export const CopyableCommand: React.FC<{ command: string }> = ({ command }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border">
      <code className="text-[11px] text-foreground whitespace-pre-wrap break-all">{command}</code>
      <button
        onClick={copy}
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
        title="Copy command"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

export default RemotePage;