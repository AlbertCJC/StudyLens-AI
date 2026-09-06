import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const TOAST_STYLES: Record<ToastType, { icon: React.ReactNode; bar: string }> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    bar: "bg-emerald-600 text-white border-emerald-700",
  },
  error: {
    icon: <XCircle className="w-4 h-4 shrink-0" />,
    bar: "bg-rose-600 text-white border-rose-700",
  },
  info: {
    icon: <Info className="w-4 h-4 shrink-0" />,
    bar: "bg-indigo-600 text-white border-indigo-700",
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", durationMs = 3500) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              className={`p-3.5 rounded-xl border shadow-xl flex items-start gap-2.5 ${style.bar}`}
            >
              {style.icon}
              <span className="flex-1 text-xs font-semibold leading-relaxed text-white">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 p-0.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
