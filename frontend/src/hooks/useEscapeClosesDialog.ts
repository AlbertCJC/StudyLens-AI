import { useEffect } from "react";

// Every modal backdrop closes itself on a click whose target is the backdrop
// (and honors its own busy guard), so Esc just clicks the topmost one.
// ponytail: relies on the role="dialog" backdrop convention; switch to a shared
// <Modal> if a dialog ever needs Esc without backdrop-click close.
export function useEscapeClosesDialog() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const top = dialogs[dialogs.length - 1];
      if (top) {
        e.preventDefault();
        top.click();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
