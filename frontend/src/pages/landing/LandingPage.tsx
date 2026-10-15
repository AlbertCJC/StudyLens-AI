import React, { useState } from "react";
import {
  BookOpen, CheckCircle2, ArrowRight,
  Moon, Sun, User, Mail, Lock, Eye, EyeOff,
  Users, ArrowLeft, ShieldCheck,
  X, Sparkles, Brain, PieChart, Star
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import MobileAppBanner from "../../components/MobileAppBanner";
import { PasswordRequirements } from "../../components/PasswordRequirements";
import { checkPasswordStrength } from "../../utils/password";
import type { UserRole } from "../../types";

const FORGOT_RESET_KEY = "studylens_forgot_reset";
const PENDING_VERIFY_KEY = "studylens_pending_verification";
const PENDING_2FA_KEY = "studylens_pending_2fa";
const VERIFY_CODE_KEY = "studylens_verify_code";

function readForgotReset(): { open: boolean; email: string; step: "request" | "verify" } {
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

function readStoredPending(): { userId: string; email: string } | null {
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

function readStoredPending2FA(): boolean {
  try {
    return !!localStorage.getItem(PENDING_2FA_KEY);
  } catch {
    return false;
  }
}

function readStoredVerifyCode(): string {
  try {
    return localStorage.getItem(VERIFY_CODE_KEY) || "";
  } catch {
    return "";
  }
}

function storeVerifyCode(code: string): void {
  try {
    if (code) {
      localStorage.setItem(VERIFY_CODE_KEY, code);
    } else {
      localStorage.removeItem(VERIFY_CODE_KEY);
    }
  } catch {
    // ignore persistence failures
  }
}

export const LandingPage: React.FC = () => {
  const { login, register, verifyEmail, resendEmailCode, clearEmailVerification, pendingEmailVerification, pending2FA, verify2FA, resend2FA, clear2FA } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"home" | "features" | "about" | "contact">("home");
  // If a pending email-verification or two-factor step was restored from localStorage, reopen
  // the auth panel so the Verify Email / Confirm Sign-In screen survives a reload / tab discard.
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(() => (readStoredPending() || readStoredPending2FA() ? "login" : null));
  
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    }
    return false;
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Auth Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("studylens_remembered_email") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(() => readForgotReset().open);
  const [forgotEmail, setForgotEmail] = useState(() => readForgotReset().email);
  const [forgotStep, setForgotStep] = useState<"request" | "verify">(() => readForgotReset().step);
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotDevCode, setForgotDevCode] = useState("");

  // Persist the forgot-password OTP step (email + which step) so it survives a
  // reload / tab discard. The devCode is never persisted.
  React.useEffect(() => {
    try {
      localStorage.setItem(FORGOT_RESET_KEY, JSON.stringify({ open: forgotOpen, email: forgotEmail, step: forgotStep }));
    } catch {
      // ignore persistence failures
    }
  }, [forgotOpen, forgotEmail, forgotStep]);

  // Local mirror of the pending email-verification step, restored straight from
  // localStorage on mount (same pattern as the forgot-password flow) so the
  // Verify Email panel survives a reload / tab discard even if the AuthContext
  // restore lands late. The context value takes precedence once available.
  const [restoredPending, setRestoredPending] = useState<{ userId: string; email: string } | null>(() => readStoredPending());
  const effectivePending = pendingEmailVerification || restoredPending;

  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setRestoredPending(
      pendingEmailVerification
        ? { userId: pendingEmailVerification.userId, email: pendingEmailVerification.email }
        : null
    );
  }, [pendingEmailVerification]);

  // Keep the typed verification code across reload / tab restore; cleared once
  // the pending step is resolved (success, "Use a different account", logout).
  React.useEffect(() => {
    if (mountedRef.current && !pendingEmailVerification && !restoredPending) {
      storeVerifyCode("");
    }
  }, [pendingEmailVerification, restoredPending]);

  const openRegisterModal = () => {
    setAuthModal("register");
    if (role === "admin") setRole("student");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (authModal === "register") {
        if (!firstName.trim()) {
          showToast("Please enter your first name.", "error");
          return;
        }
        if (!lastName.trim()) {
          showToast("Please enter your last name.", "error");
          return;
        }
        if (!email.trim()) {
          showToast("Please enter a valid email address.", "error");
          return;
        }
        if (password && confirmPassword && password !== confirmPassword) {
          showToast("Passwords do not match.", "error");
          return;
        }
        if (!password) {
          showToast("Please enter a password.", "error");
          return;
        }
        const strengthErr = checkPasswordStrength(password);
        if (strengthErr) {
          showToast(strengthErr, "error");
          return;
        }

        const computedFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

        const dept = role === "student" ? "Computer Science" : role === "teacher" ? "Computer Science & IT" : "Academic Affairs";
        await register(computedFullName, email.trim(), role, dept, password);
      } else {
        if (!email.trim()) {
          showToast("Please enter your email address.", "error");
          return;
        }
        await login({
          email: email.trim(),
          role: role,
          password: password,
        });
        try {
          if (rememberMe) {
            localStorage.setItem("studylens_remembered_email", email.trim());
          } else {
            localStorage.removeItem("studylens_remembered_email");
          }
        } catch {
          // storage unavailable - skip persisting the remember-me preference
        }
      }
    } catch (err) {
      const errMsg = (err as Error).message || "Authentication failed. Please check your credentials.";
      if (
        errMsg.toLowerCase().includes("already registered") ||
        errMsg.toLowerCase().includes("already exists")
      ) {
        showToast(
          `This email (${email.trim()}) is already registered in our system. Would you like to log in instead?`,
          "error"
        );
      } else {
        showToast(errMsg, "error");
      }
    }
  };

  // Email Verification State
  const [verifyCode, setVerifyCode] = useState(() => readStoredVerifyCode());
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifyNotice, setVerifyNotice] = useState("");

  // Keep the typed verification code across reload / tab restore; cleared once
  // the pending step is resolved (success, "Use a different account", logout).
  React.useEffect(() => {
    storeVerifyCode(verifyCode);
  }, [verifyCode]);

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    if (!effectivePending) return;
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setVerifyError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setVerifySubmitting(true);
    try {
      await verifyEmail(effectivePending.userId, verifyCode.trim());
    } catch (err) {
      setVerifyError((err as Error).message || "Could not verify the email. Please try again.");
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleResendVerifyCode = async () => {
    setVerifyError("");
    if (!effectivePending) return;
    setVerifyResending(true);
    try {
      await resendEmailCode(effectivePending.userId);
      setVerifyNotice("A new verification code has been sent.");
    } catch (err) {
      setVerifyError((err as Error).message || "Could not resend the verification code.");
    } finally {
      setVerifyResending(false);
    }
  };

  // Two-Factor Verification State
  const [f2aCode, setF2aCode] = useState("");
  const [f2aSubmitting, setF2aSubmitting] = useState(false);
  const [f2aResending, setF2aResending] = useState(false);
  const [f2aError, setF2aError] = useState("");
  const [f2aNotice, setF2aNotice] = useState("");

  const handleVerify2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setF2aError("");
    if (!pending2FA) return;
    if (!/^\d{6}$/.test(f2aCode.trim())) {
      setF2aError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setF2aSubmitting(true);
    try {
      await verify2FA(pending2FA.userId, f2aCode.trim());
      setF2aCode("");
    } catch (err) {
      setF2aError((err as Error).message || "Could not complete sign-in. Please try again.");
    } finally {
      setF2aSubmitting(false);
    }
  };

  const handleResend2FASubmit = async () => {
    setF2aError("");
    setF2aNotice("");
    if (!pending2FA) return;
    setF2aResending(true);
    try {
      await resend2FA(pending2FA.userId);
      setF2aNotice("A new verification code has been sent.");
      setF2aCode("");
    } catch (err) {
      setF2aError((err as Error).message || "Could not resend the verification code.");
    } finally {
      setF2aResending(false);
    }
  };

  const handleUseDifferent2FA = () => {
    clear2FA();
    setF2aCode("");
    setF2aError("");
    setF2aNotice("");
  };

  const handleFeatureCardClick = () => {
    // Feature cards now open the login modal — no more 1-click demo sessions.
    setRole("student");
    setAuthModal("login");
  };

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    setForgotSubmitting(true);
    setForgotNotice("");
    setForgotDevCode("");
    try {
      const res = await fetch("/api/auth/reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not issue a reset code. Please try again.", "error");
        return;
      }
      setForgotStep("verify");
      setForgotNotice(data?.message || "A 6-digit verification code was sent to your email.");
      setForgotDevCode(data?.devCode || "");
      showToast(res.status === 200 ? "Verification code sent." : data?.message || "Code sent.");
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      showToast("Please enter the 6-digit verification code.", "error");
      return;
    }
    if (!forgotPassword) {
      showToast("Please enter a new password.", "error");
      return;
    }
    const forgotError = checkPasswordStrength(forgotPassword);
    if (forgotError) {
      showToast(forgotError, "error");
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      showToast("Passwords do not match.", "error");
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim(), newPassword: forgotPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not reset the password. Please try again.", "error");
        return;
      }
      showToast("Password reset successfully! You can now sign in with your new password.");
      setTimeout(() => {
        setForgotOpen(false);
        setForgotEmail("");
        setForgotOtp("");
        setForgotPassword("");
        setForgotConfirm("");
        setForgotStep("request");
        setForgotNotice("");
        setForgotDevCode("");
      }, 2200);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const closeForgotModal = () => {
    setForgotOpen(false);
    setForgotStep("request");
    setForgotEmail("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotConfirm("");
    setForgotNotice("");
    setForgotDevCode("");
  };

  const scrollToSection = (id: "home" | "features" | "about" | "contact") => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // If Auth View is Active (Login or Register)
  if (authModal) {
    return (
      <>
      <MobileAppBanner darkMode={darkMode} />
      <div className={`min-h-screen font-sans flex flex-col items-center justify-center p-4 sm:p-6 ${
        darkMode ? "dark bg-[#0b132b] text-slate-100" : "bg-[#f5f6fc] text-slate-900"
      }`}>
        {/* Top Dark/Light Switch Floating Right */}
        <div className="absolute top-4 right-6">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="w-full max-w-[420px] mx-auto py-8">
          {/* Centered White / Dark Card */}
          <div className="bg-white dark:bg-[#131b30] border border-slate-100 dark:border-slate-800/80 rounded-2xl p-8 sm:p-10 shadow-sm space-y-6">
            {effectivePending ? (
              <>
                {/* Verify Email Panel */}
                <div className="h-12 w-12 rounded-2xl bg-[#5b51d8] text-white flex items-center justify-center mx-auto shadow-md">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Verify Your Email
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    We sent a 6-digit code to <span className="font-semibold text-slate-700 dark:text-slate-200">{effectivePending.email}</span>.
                    Enter it below to activate your account.
                  </p>
                  {!!effectivePending.devCode && (
                    <div className="mt-3 text-xs font-medium text-[#15803d] bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-xl px-3 py-2.5">
                      Dev mode: your code is <span className="font-mono font-bold text-sm tracking-[0.25em]">{effectivePending.devCode}</span>
                    </div>
                  )}
                </div>
                <form onSubmit={handleVerifyEmailSubmit} className="space-y-4 text-xs sm:text-sm">
                  {verifyNotice && (
                    <div className="text-xs font-medium text-[#4a41c4] bg-[#5b51d8]/5 border border-[#5b51d8]/15 rounded-xl px-3 py-2.5">
                      {verifyNotice}
                    </div>
                  )}
                  {verifyError && (
                    <div className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-3 py-2.5">
                      {verifyError}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">Verification Code</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="6-digit code"
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium tracking-[0.25em]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={verifySubmitting}
                    className="w-full py-3 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer mt-2 disabled:opacity-60"
                  >
                    {verifySubmitting ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-1">
                    Didn't get a code?{" "}
                    <button
                      type="button"
                      onClick={handleResendVerifyCode}
                      disabled={verifyResending}
                      className="text-[#5b51d8] dark:text-indigo-400 font-bold hover:underline cursor-pointer disabled:opacity-60"
                    >
                      {verifyResending ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={clearEmailVerification}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white font-medium cursor-pointer pt-1 underline"
                    >
                      Use a different account
                    </button>
                  </div>
                </form>
              </>
            ) : pending2FA ? (
              <>
                {/* Two-Factor Verification Panel */}
                <div className="h-12 w-12 rounded-2xl bg-[#5b51d8] text-white flex items-center justify-center mx-auto shadow-md">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Confirm Your Sign-In
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    We sent a 6-digit code to <span className="font-semibold text-slate-700 dark:text-slate-200">{pending2FA.email}</span>. Enter it below to finish signing in.
                  </p>
                  {!!pending2FA.devCode && (
                    <div className="mt-3 text-xs font-medium text-[#15803d] bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-xl px-3 py-2.5">
                      Dev mode: your code is <span className="font-mono font-bold text-sm tracking-[0.25em]">{pending2FA.devCode}</span>
                    </div>
                  )}
                </div>
                <form onSubmit={handleVerify2FASubmit} className="space-y-4 text-xs sm:text-sm">
                  {f2aNotice && (
                    <div className="text-xs font-medium text-[#4a41c4] bg-[#5b51d8]/5 border border-[#5b51d8]/15 rounded-xl px-3 py-2.5">
                      {f2aNotice}
                    </div>
                  )}
                  {f2aError && (
                    <div className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-3 py-2.5">
                      {f2aError}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">Verification Code</label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={f2aCode}
                        onChange={(e) => setF2aCode(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="6-digit code"
                        className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium tracking-[0.25em]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={f2aSubmitting}
                    className="w-full py-3 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer mt-2 disabled:opacity-60"
                  >
                    {f2aSubmitting ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-1">
                    Didn't get a code?{" "}
                    <button
                      type="button"
                      onClick={handleResend2FASubmit}
                      disabled={f2aResending}
                      className="text-[#5b51d8] dark:text-indigo-400 font-bold hover:underline cursor-pointer disabled:opacity-60"
                    >
                      {f2aResending ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleUseDifferent2FA}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white font-medium cursor-pointer pt-1 underline"
                    >
                      Use a different account
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
            {/* Logo Icon */}
            <img
              src="/studylens.png"
              alt="StudyLens AI"
              className="h-12 w-12 rounded-2xl object-cover shadow-md mx-auto"
            />

            {/* Header Text */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {authModal === "login" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {authModal === "login"
                  ? "Sign in to continue your learning journey"
                  : "Create your account to get started"}
              </p>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs sm:text-sm">
              {authModal === "register" && (
                <div className="space-y-3">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-slate-800 dark:text-slate-200">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First name"
                          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-semibold text-slate-800 dark:text-slate-200">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authModal === "login" ? "Enter your password" : "Create a password"}
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authModal === "register" && <PasswordRequirements password={password} />}
              </div>

              {/* Confirm Password Field (Register Only) */}
              {authModal === "register" && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password (Login Only) */}
              {authModal === "login" && (
                <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#5b51d8] focus:ring-[#5b51d8]"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email.trim());
                      setForgotOpen(true);
                    }}
                    className="text-[#5b51d8] dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Role Option Selector (Register Only) */}
              {authModal === "register" && (
                <div className="space-y-3 pt-1">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    I am a
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={`w-full p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                        role === "student"
                          ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#182238] text-slate-900 dark:text-white font-bold ring-1 ring-slate-300 dark:ring-slate-600"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b30] text-slate-600 dark:text-slate-400 font-medium hover:border-slate-300"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${role === "student" ? "bg-[#5b51d8]" : "border border-slate-300 dark:border-slate-600"}`} />
                      <span>Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("teacher")}
                      className={`w-full p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                        role === "teacher"
                          ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-[#182238] text-slate-900 dark:text-white font-bold ring-1 ring-slate-300 dark:ring-slate-600"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b30] text-slate-600 dark:text-slate-400 font-medium hover:border-slate-300"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${role === "teacher" ? "bg-[#5b51d8]" : "border border-slate-300 dark:border-slate-600"}`} />
                      <span>Teacher</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer mt-2"
              >
                {authModal === "login" ? "Sign In" : "Create Account"}
              </button>

              {/* Toggle Login/Register Link */}
              <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-2">
                {authModal === "login" ? (
                  <p>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModal("register");
                        if (role === "admin") setRole("student");
                      }}
                      className="text-[#5b51d8] dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthModal("login")}
                      className="text-[#5b51d8] dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Sign in here
                    </button>
                  </p>
                )}
              </div>

              {/* Disclaimer for Register */}
              {authModal === "register" && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-3 border-t border-slate-100 dark:border-slate-800">
                  By creating an account, you agree to our Terms of Service and Privacy Policy
                </p>
              )}
            </form>
            </>
            )}
          </div>

          {/* Bottom Back To Home Link */}
          <div className="text-center mt-6">
            <button
              onClick={() => { setAuthModal(null); setVerifyCode(""); storeVerifyCode(""); }}
              className="inline-flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeForgotModal}>
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e1628] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {forgotStep === "request"
                    ? "Enter your account email to receive a 6-digit verification code."
                    : "Enter the code we sent and choose a new password."}
                </p>
              </div>
              <button
                onClick={closeForgotModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotStep === "request" ? (
              <form onSubmit={handleForgotSendCode} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@studylens.edu"
                      required
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full py-2.5 bg-[#5b51d8] hover:bg-[#4a41c4] text-white rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
                >
                  {forgotSubmitting ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotResetSubmit} className="space-y-3">
                {forgotNotice && (
                  <div className="text-xs font-medium text-[#4a41c4] bg-[#5b51d8]/5 border border-[#5b51d8]/15 rounded-xl px-3 py-2.5">
                    {forgotNotice}
                  </div>
                )}
                {forgotDevCode && (
                  <div className="text-xs font-medium text-[#15803d] bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-xl px-3 py-2.5">
                    Dev mode: your code is <span className="font-mono font-bold text-sm tracking-[0.25em]">{forgotDevCode}</span>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Verification Code</label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="6-digit code"
                      required
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none tracking-[0.25em]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={forgotPassword}
                      onChange={(e) => setForgotPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <PasswordRequirements password={forgotPassword} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={forgotConfirm}
                      onChange={(e) => setForgotConfirm(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full py-2.5 bg-[#5b51d8] hover:bg-[#4a41c4] text-white rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
                >
                  {forgotSubmitting ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      </>
    );
  }

  // Main Landing Page View
  return (
    <div className={`min-h-screen font-sans ${darkMode ? "dark bg-[#0b132b] text-slate-100" : "bg-[#f5f6fc] text-slate-900"}`}>
      <MobileAppBanner darkMode={darkMode} />
      {/* ----------------- HEADER NAV BAR ----------------- */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0e1628] border-b border-slate-200/80 dark:border-slate-800/80 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-2xs transition-colors">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection("home")}>
          <img
            src="/studylens.png"
            alt="StudyLens AI"
            className="h-10 w-10 rounded-xl object-cover shadow-sm"
          />
          <span className="font-extrabold text-xl text-[#5b51d8] dark:text-white tracking-tight">
            StudyLens AI
          </span>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold">
          <button
            onClick={() => scrollToSection("home")}
            className={`transition-colors cursor-pointer ${
              activeTab === "home" ? "text-[#5b51d8] dark:text-[#818cf8] font-bold" : "text-slate-700 dark:text-white hover:text-[#5b51d8]"
            }`}
          >
            Home
          </button>
          <button
            onClick={() => scrollToSection("features")}
            className={`transition-colors cursor-pointer ${
              activeTab === "features" ? "text-[#5b51d8] dark:text-[#818cf8] font-bold" : "text-slate-700 dark:text-white hover:text-[#5b51d8]"
            }`}
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection("about")}
            className={`transition-colors cursor-pointer ${
              activeTab === "about" ? "text-[#5b51d8] dark:text-[#818cf8] font-bold" : "text-slate-700 dark:text-white hover:text-[#5b51d8]"
            }`}
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("contact")}
            className={`transition-colors cursor-pointer ${
              activeTab === "contact" ? "text-[#5b51d8] dark:text-[#818cf8] font-bold" : "text-slate-700 dark:text-white hover:text-[#5b51d8]"
            }`}
          >
            Contact
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setAuthModal("login")}
            className="text-sm font-semibold text-slate-700 dark:text-white hover:text-[#5b51d8] px-2 py-1 transition-colors cursor-pointer"
          >
            Login
          </button>

          <button
            onClick={openRegisterModal}
            className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
          >
            Register
          </button>
        </div>
      </header>

      {/* ----------------- HERO SECTION (IMAGE 4 DARK MODE MATCH) ----------------- */}
      <section id="home" className="px-6 sm:px-12 lg:px-20 py-12 lg:py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 text-[#5b51d8] dark:text-indigo-300 text-xs font-bold border border-indigo-200/50 dark:border-indigo-800/60">
              <Sparkles className="w-4 h-4 text-[#5b51d8] dark:text-indigo-400" />
              <span>AI-Powered Learning</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
              Transform Your Learning <br className="hidden sm:inline" />
              with <span className="text-[#5b51d8] dark:text-[#818cf8]">AI Technology</span>
            </h1>

            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
              StudyLens AI is an adaptive learning and automated assessment generation platform that personalizes your educational journey with intelligent quizzes, flashcards, and progress tracking.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={openRegisterModal}
                className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => scrollToSection("features")}
                className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer"
              >
                Learn More
              </button>
            </div>

            {/* Bottom Stats (Exact match to screenshot 4) */}
            <div className="grid grid-cols-3 gap-6 pt-8 max-w-lg border-t border-slate-200/60 dark:border-slate-800/80">
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">1000+</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Active Students</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">500+</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Quiz Generated</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-[#5b51d8] dark:text-[#818cf8]">95%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Success Rate</p>
              </div>
            </div>
          </div>

          {/* Right Column: Cards Container */}
          <div className="lg:col-span-5 relative">
            {/* Lavender / Dark Navy Outer Box */}
            <div className="bg-[#e0e3f8] dark:bg-[#131b30] border border-indigo-200/50 dark:border-slate-800/80 p-6 sm:p-8 rounded-[32px] shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                {/* 1. AI Quiz Card */}
                <div
                  onClick={handleFeatureCardClick}
                  className="bg-white dark:bg-[#182238] p-5 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                >
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8] group-hover:scale-105 transition-transform">
                    <Brain className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">AI Quiz</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Auto-generated assessments</p>
                  </div>
                </div>

                {/* 2. Flashcards Card */}
                <div
                  onClick={handleFeatureCardClick}
                  className="bg-white dark:bg-[#182238] p-5 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                >
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8] group-hover:scale-105 transition-transform">
                    <BookOpen className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Flashcards</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Smart study cards</p>
                  </div>
                </div>

                {/* 3. Progress Card */}
                <div
                  onClick={handleFeatureCardClick}
                  className="bg-white dark:bg-[#182238] p-5 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                >
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8] group-hover:scale-105 transition-transform">
                    <PieChart className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Progress</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Track your growth</p>
                  </div>
                </div>

                {/* 4. Community Card */}
                <div
                  onClick={handleFeatureCardClick}
                  className="bg-white dark:bg-[#182238] p-5 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 hover:shadow-md transition-all space-y-3 cursor-pointer group"
                >
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8] group-hover:scale-105 transition-transform">
                    <Users className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Community</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Learn together</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- FEATURES SECTION ----------------- */}
      <section id="features" className="bg-[#e8ebfb] dark:bg-[#0f172a] py-20 px-6 sm:px-12 lg:px-20 border-y border-indigo-100 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Powerful Features for Modern Learning
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              Everything you need to excel in your studies, powered by artificial intelligence
            </p>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-[#f5f6fc] dark:bg-[#151d34] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8]">
                <Brain className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">AI Quiz Generator</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automatically generate customized quizzes from your study materials using advanced AI
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#f5f6fc] dark:bg-[#151d34] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8]">
                <BookOpen className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">AI Flashcard Generator</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Create interactive flashcards instantly from PDFs and learning materials
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#f5f6fc] dark:bg-[#151d34] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8]">
                <PieChart className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Learning Progress Tracking</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Monitor your performance with detailed analytics and insights
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#f5f6fc] dark:bg-[#151d34] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/50 rounded-xl w-fit text-[#5b51d8] dark:text-[#818cf8]">
                <Star className="w-7 h-7 text-[#5b51d8] dark:text-[#818cf8]" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Personalized Recommendations</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Get AI-powered suggestions tailored to your learning style and goals
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- ABOUT SECTION ----------------- */}
      <section id="about" className="py-20 px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Side: About Text & Bullet Points */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              About StudyLens AI
            </h2>

            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
              StudyLens AI is designed to revolutionize the way students learn and teachers assess. Our platform leverages cutting-edge artificial intelligence to create personalized learning experiences that adapt to each student's unique needs.
            </p>

            <ul className="space-y-3.5 pt-2">
              {[
                "Adaptive learning algorithms",
                "Automated assessment generation",
                "Real-time progress tracking",
                "Collaborative learning tools",
                "Multi-format content support",
              ].map((item, idx) => (
                <li key={idx} className="flex items-center space-x-3 text-slate-800 dark:text-slate-200 text-sm font-semibold">
                  <div className="p-1 bg-[#5b51d8]/10 text-[#5b51d8] dark:text-[#818cf8] rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-[#5b51d8] dark:text-[#818cf8]" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Side: Why Choose Us Box */}
          <div className="lg:col-span-5 bg-[#e0e3f8] dark:bg-[#131b30] border border-indigo-200/50 dark:border-slate-800 p-8 rounded-[32px] shadow-sm space-y-6">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Why Choose Us?
            </h3>

            <div className="space-y-5">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Students</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Personalized learning paths, instant feedback, and comprehensive progress tracking to help you achieve your academic goals.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Teachers</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Save time with automated assessment generation, gain insights into student performance, and focus on what matters most - teaching.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">For Administrators</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Comprehensive analytics, user management, and system monitoring to ensure optimal learning outcomes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- CALL TO ACTION SECTION ----------------- */}
      <section id="contact" className="bg-[#e8ebfb] dark:bg-[#0f172a] py-20 px-6 sm:px-12 text-center border-t border-indigo-100 dark:border-slate-800/80 transition-colors">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ready to Get Started?
          </h2>

          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Join thousands of students and educators already using StudyLens AI to transform their learning experience.
          </p>

          <div className="pt-4">
            <button
              onClick={() => setAuthModal("register")}
              className="bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-md transition-all inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>Start Learning Today</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ----------------- FOOTER ----------------- */}
      <footer className="bg-[#f8fafc] dark:bg-[#0b132b] border-t border-slate-200/80 dark:border-slate-800/80 py-12 px-6 sm:px-12 lg:px-20 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-[#5b51d8] text-white flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base text-[#5b51d8] dark:text-[#818cf8]">
                StudyLens AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              Adaptive Learning and Automated Assessment Generation Platform
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Product</h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li><a href="#features" className="hover:text-[#5b51d8] transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#5b51d8] transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-[#5b51d8] transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Company</h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li><a href="#about" className="hover:text-[#5b51d8] transition-colors">About Us</a></li>
              <li><a href="#blog" className="hover:text-[#5b51d8] transition-colors">Blog</a></li>
              <li><a href="#careers" className="hover:text-[#5b51d8] transition-colors">Careers</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Support</h4>
            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
              <li><a href="#contact" className="hover:text-[#5b51d8] transition-colors">Contact</a></li>
              <li><a href="#help" className="hover:text-[#5b51d8] transition-colors">Help Center</a></li>
              <li><a href="#privacy" className="hover:text-[#5b51d8] transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-200 dark:border-slate-800/80 text-center text-slate-400 text-xs">
          © 2026 StudyLens AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export const LoginScreen = LandingPage;
