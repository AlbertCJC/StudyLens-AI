import React, { useCallback, useEffect, useState } from "react";
import {
  Server,
  Database,
  TerminalSquare,
  XCircle,
  Loader2,
  RefreshCw,
  Cpu,
  PlugZap,
  ShieldCheck,
  Wifi,
  Globe,
  KeyRound,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { probeUrl } from "../../utils/backendProbe";
import type { ProbeResult } from "../../utils/backendProbe";
import { CopyableCommand } from "./RemotePage";

interface ProbeTarget {
  id: string;
  label: string;
  description: string;
  url: string;
  note?: string;
}

const TARGETS: ProbeTarget[] = [
  {
    id: "web",
    label: "Web / API Backend (This Origin)",
    description: "The FastAPI endpoint the web dashboard is wired to via same-origin /api.",
    url: `${window.location.origin}/api/system/info`,
  },
  {
    id: "flask",
    label: "Flask + Groq Backend",
    description: "Python backend serving AI generation, auth, subjects, and announcements on port 5000.",
    url: "http://127.0.0.1:5000/api/system/info",
  },
  {
    id: "node",
    label: "Node Companion Server",
    description: "Express server used for local/mobile demos and static hosting of the production build.",
    url: "http://127.0.0.1:3000/api/system/settings",
    note: "May be blocked by CORS in the browser; the mobile app reaches it without CORS restrictions.",
  },
];

export const SelfHostedPage: React.FC = () => {
  const [results, setResults] = useState<Record<string, ProbeResult | undefined>>({});
  const [checking, setChecking] = useState(true);

  const doProbe = useCallback(async (): Promise<Record<string, ProbeResult | undefined>> => {
    const entries = await Promise.all(
      TARGETS.map(async (t) => [t.id, await probeUrl(t.url)] as const)
    );
    return Object.fromEntries(entries);
  }, []);

  const runProbes = useCallback(() => {
    setChecking(true);
    doProbe().then((next) => {
      setResults(next);
      setChecking(false);
    });
  }, [doProbe]);

  useEffect(() => {
    let cancelled = false;
    doProbe().then((next) => {
      if (cancelled) return;
      setResults(next);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [doProbe]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#5b51d8]/10 text-[#5b51d8] rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Self-Hosted Deployment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Run the full platform locally with Python + Node — ideal for development, demos, and on-premise setups
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Cpu className="w-3 h-3" />
            <span>Local Hosted Mode</span>
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={runProbes} disabled={checking}>
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {checking ? "Scanning..." : "Re-scan Services"}
          </Button>
        </div>
      </div>

      {/* Local services health */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <h3 className="text-sm font-bold text-foreground mb-1">Local Service Health</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Live probes against the services that make up a self-hosted StudyLens stack.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {TARGETS.map((t) => {
            const r = results[t.id];
            const ok = r?.ok === true;
            const pending = !r && checking;
            return (
              <div key={t.id} className="p-4 rounded-xl bg-background border border-border flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t.label}</span>
                  {pending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : ok ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Wifi className="w-2.5 h-2.5" /> Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      <XCircle className="w-2.5 h-2.5" /> Offline
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t.description}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t.url}</p>
                {r && (
                  <p className={`text-[11px] font-semibold ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {ok ? `Responding in ${r.latency} ms` : `${r.error || "Unreachable"}${r.latency !== undefined ? ` (${r.latency} ms)` : ""}`}
                  </p>
                )}
                {t.note && <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{t.note}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Prerequisites */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <PlugZap className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Prerequisites</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StepCard icon={<TerminalSquare className="w-4 h-4" />} title="Python 3.10+" detail="Required to run the Flask + Groq backend." />
          <StepCard icon={<Cpu className="w-4 h-4" />} title="Node.js 18+" detail="Runs Vite, the companion Express server, and the mobile tooling." />
          <StepCard icon={<Database className="w-4 h-4" />} title="MySQL 8+ (Optional)" detail="SQLite fallback is enabled out of the box for quick starts." />
          <StepCard icon={<KeyRound className="w-4 h-4" />} title="Groq API Key" detail="Free key from console.groq.com/keys for AI generation features." />
        </div>
      </section>

      {/* Quick start */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Quick Start</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Copy the commands in order to get the full stack running locally.
        </p>
        <div className="space-y-3">
          <CommandStep index={1} title="Install Python + Node dependencies" command="pip install -r requirements.txt && npm install" />
          <CommandStep index={2} title="Configure your environment" command="cp .env.example .env" />
          <CommandStep index={3} title="Start the Flask backend (port 5000)" command="python app.py" />
          <CommandStep index={4} title="Start the web frontend (port 3000)" command="npm run dev" />
          <CommandStep index={5} title="Launch the React-Native mobile app" command="cd mobile && npm start" />
        </div>
      </section>

      {/* Environment notes */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Environment Variables</h3>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            The backend boots with safe defaults and falls back to SQLite when MySQL is unreachable, so a single
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">.env</code>
            file with just a Groq key is enough to run the whole demo locally.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <EnvRow name="GROQ_API_KEY" detail="AI generation engine key" />
            <EnvRow name="JWT_SECRET" detail="Authentication secret" />
            <EnvRow name="MYSQL_DATABASE_URL" detail="Optional MySQL connection string" />
            <EnvRow name="FLASK_PORT" detail="Backend port (default 5000)" />
            <EnvRow name="CLOUDINARY_URL" detail="Optional cloud storage URL" />
            <EnvRow name="FIREBASE_CREDENTIALS" detail="Optional Firebase service account" />
          </div>
        </div>
      </section>
    </div>
  );
};

interface StepCardProps {
  icon: React.ReactNode;
  title: string;
  detail: string;
}

const StepCard: React.FC<StepCardProps> = ({ icon, title, detail }) => (
  <div className="p-4 rounded-xl bg-background border border-border">
    <div className="p-2 bg-[#5b51d8]/10 text-[#5b51d8] rounded-lg w-fit mb-2">{icon}</div>
    <p className="text-xs font-bold text-foreground">{title}</p>
    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
  </div>
);

interface CommandStepProps {
  index: number;
  title: string;
  command: string;
}

const CommandStep: React.FC<CommandStepProps> = ({ index, title, command }) => (
  <div className="flex items-start gap-3">
    <span className="w-6 h-6 shrink-0 rounded-full bg-[#5b51d8] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
      {index}
    </span>
    <div className="flex-1 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <CopyableCommand command={command} />
    </div>
  </div>
);

interface EnvRowProps {
  name: string;
  detail: string;
}

const EnvRow: React.FC<EnvRowProps> = ({ name, detail }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background border border-border">
    <code className="text-[11px] font-semibold text-foreground">{name}</code>
    <span className="text-[10px] text-muted-foreground text-right">{detail}</span>
  </div>
);

export default SelfHostedPage;