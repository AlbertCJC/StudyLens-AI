import { Download, X } from "lucide-react";
import type { GeneratedReport } from "../../types";
import { ReportDetails } from "./ReportDetails";
import { summaryRows } from "./reportUtils";

interface ReportViewModalProps {
  report: GeneratedReport;
  onClose: () => void;
  onExport: (report: GeneratedReport) => void;
}

export function ReportViewModal({ report, onClose, onExport }: ReportViewModalProps) {
  const rows = summaryRows(report);
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-2xl w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-1 min-w-0">
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
              {report.reportType}
            </span>
            <h3 className="text-lg font-bold text-foreground leading-snug">{report.title}</h3>
            <p className="text-[11px] text-muted-foreground">Generated {report.generatedAt}</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <ReportDetails report={report} />

          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No summary data available for this report.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/60 text-xs">
                  <span className="font-bold text-foreground">{row.label}</span>
                  <span className="text-muted-foreground text-right">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <button
            onClick={() => onExport(report)}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
