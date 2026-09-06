import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const accentClasses = destructive
    ? "bg-rose-600 hover:bg-rose-700 text-white"
    : "bg-primary hover:bg-primary/90 text-primary-foreground";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 ${destructive ? "text-rose-600" : "text-amber-500"}`}
              />
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${accentClasses}`}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
