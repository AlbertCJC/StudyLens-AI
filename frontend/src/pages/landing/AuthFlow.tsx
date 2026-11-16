import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User,
  X,
} from "lucide-react";
import MobileAppBanner from "../../components/MobileAppBanner";
import { PasswordRequirements } from "../../components/PasswordRequirements";
import type { LandingAuthController } from "./useLandingAuth";

export function AuthFlow({ auth }: { auth: LandingAuthController }) {
  const {
    authModal,
    setAuthModal,
    darkMode,
    setDarkMode,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    role,
    setRole,
    rememberMe,
    setRememberMe,
    forgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotStep,
    forgotOtp,
    setForgotOtp,
    forgotPassword,
    setForgotPassword,
    forgotConfirm,
    setForgotConfirm,
    forgotSubmitting,
    forgotNotice,
    effectivePending,
    verifyCode,
    setVerifyCode,
    verifySubmitting,
    verifyResending,
    verifyError,
    verifyNotice,
    f2aCode,
    setF2aCode,
    f2aSubmitting,
    f2aResending,
    f2aError,
    f2aNotice,
    pending2FA,
    openRegisterModal,
    handleAuthSubmit,
    handleVerifyEmailSubmit,
    handleResendVerifyCode,
    handleVerify2FASubmit,
    handleResend2FASubmit,
    handleUseDifferent2FA,
    handleUseDifferentAccount,
    handleBackToHome,
    handleForgotSendCode,
    handleForgotVerifyOtp,
    handleForgotResetSubmit,
    closeForgotModal,
    setForgotOpen,
  } = auth;

  return (
    <>
      <MobileAppBanner darkMode={darkMode} />
      <div className={`min-h-screen font-sans flex flex-col items-center justify-center p-4 sm:p-6 ${
        darkMode ? "dark bg-[#0b132b] text-slate-100" : "bg-[#f5f6fc] text-slate-900"
      }`}>
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
          <div className="bg-white dark:bg-[#131b30] border border-slate-100 dark:border-slate-800/80 rounded-2xl p-8 sm:p-10 shadow-sm space-y-6">
            {effectivePending ? (
              <>
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
                        autoComplete="one-time-code"
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
                      onClick={handleUseDifferentAccount}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white font-medium cursor-pointer pt-1 underline"
                    >
                      Use a different account
                    </button>
                  </div>
                </form>
              </>
            ) : pending2FA ? (
              <>
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
                        autoComplete="one-time-code"
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
                <img
                  src="/studylens.png"
                  alt="StudyLens AI"
                  className="h-12 w-12 rounded-2xl object-cover shadow-md mx-auto"
                />

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

                <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs sm:text-sm">
                  {authModal === "register" && (
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
                            autoComplete="given-name"
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
                            autoComplete="family-name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-800 dark:text-slate-200">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete={authModal === "login" ? "current-password" : "new-password"}
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

                  {authModal === "register" && (
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-slate-800 dark:text-slate-200">Confirm Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          autoComplete="new-password"
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

                  {authModal === "register" && (
                    <div className="space-y-3 pt-1">
                      <label className="block font-semibold text-slate-800 dark:text-slate-200">I am a</label>
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

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer mt-2"
                  >
                    {authModal === "login" ? "Sign In" : "Create Account"}
                  </button>

                  <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-2">
                    {authModal === "login" ? (
                      <p>
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={openRegisterModal}
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

                  {authModal === "register" && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-3 border-t border-slate-100 dark:border-slate-800">
                      By creating an account, you agree to our Terms of Service and Privacy Policy
                    </p>
                  )}
                </form>
              </>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleBackToHome}
              className="inline-flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </button>
          </div>
        </div>
      </div>

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
                    : forgotStep === "verify"
                      ? "Enter the 6-digit code we sent to your email to verify it."
                      : "Code verified. Choose and confirm your new password."}
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
            ) : forgotStep === "verify" ? (
              <form onSubmit={handleForgotVerifyOtp} className="space-y-3">
                {forgotNotice && (
                  <div className="text-xs font-medium text-[#4a41c4] bg-[#5b51d8]/5 border border-[#5b51d8]/15 rounded-xl px-3 py-2.5">
                    {forgotNotice}
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
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full py-2.5 bg-[#5b51d8] hover:bg-[#4a41c4] text-white rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-60"
                >
                  {forgotSubmitting ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotResetSubmit} className="space-y-3">
                {forgotNotice && (
                  <div className="text-xs font-medium text-[#4a41c4] bg-[#5b51d8]/5 border border-[#5b51d8]/15 rounded-xl px-3 py-2.5">
                    {forgotNotice}
                  </div>
                )}
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
