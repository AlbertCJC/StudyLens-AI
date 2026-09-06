import React, { useState } from "react";
import { Smartphone, X } from "lucide-react";

const BANNER_KEY = "studylens_mobile_banner_dismissed";

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  // UA heuristics: anything that looks like a phone/tablet browser.
  const ua = navigator.userAgent || "";
  const check = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|webOS|IEMobile|Opera Mini/i.test(ua);
  // Touch + small viewport strengthens the signal without relying on UA alone.
  const touch = typeof navigator !== "undefined" && "maxTouchPoints" in navigator && navigator.maxTouchPoints > 0;
  const small = typeof window !== "undefined" && window.innerWidth < 900;
  return check || (touch && small);
}

export default function MobileAppBanner({ darkMode }: { darkMode?: boolean }) {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return !(localStorage.getItem(BANNER_KEY) === "1") && isMobileBrowser();
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      // ignore storage failures
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`w-full px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-3 ${
        darkMode ? "bg-indigo-950 text-indigo-200" : "bg-indigo-50 text-indigo-800"
      }`}
    >
      <Smartphone className="w-4 h-4 shrink-0" />
      <span className="text-center">
        For the best experience, use the <strong className="font-bold">StudyLens mobile app</strong> on your phone.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 shrink-0 cursor-pointer opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
