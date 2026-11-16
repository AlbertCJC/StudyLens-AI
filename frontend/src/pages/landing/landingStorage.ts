export const FORGOT_RESET_KEY = "studylens_forgot_reset";
export const PENDING_VERIFY_KEY = "studylens_pending_verification";

export function readForgotReset(): { open: boolean; email: string; step: "request" | "verify" | "reset" } {
  try {
    const raw = localStorage.getItem(FORGOT_RESET_KEY);
    if (!raw) return { open: false, email: "", step: "request" };
    const parsed = JSON.parse(raw);
    return {
      open: !!parsed.open,
      email: typeof parsed.email === "string" ? parsed.email : "",
      step: parsed.step === "verify" ? "verify" : "request",
    };
  } catch {
    return { open: false, email: "", step: "request" };
  }
}

export function readStoredPending(): { userId: string; email: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_VERIFY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.userId !== "string") return null;
    return { userId: parsed.userId, email: typeof parsed.email === "string" ? parsed.email : "" };
  } catch {
    return null;
  }
}
