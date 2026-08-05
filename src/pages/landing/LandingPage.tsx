import React, { useState } from "react";
import {
  BookOpen, Sparkles, CheckCircle2, ArrowRight,
  Moon, Sun, User, Mail, Lock, Eye, EyeOff,
  Star, Users, PieChart, ArrowLeft, Brain
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types";

export const LandingPage: React.FC = () => {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<"home" | "features" | "about" | "contact">("home");
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [rememberMe, setRememberMe] = useState(false);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({
      id: `usr-${role}-${Date.now()}`,
      name: fullName || (role === "student" ? "Alex Johnson" : role === "teacher" ? "Dr. Sarah Smith" : "System Administrator"),
      email: email || `${role}@studylens.edu`,
      role,
      department: role === "student" ? "Computer Science" : role === "teacher" ? "Computer Science & IT" : "Academic Affairs",
    });
  };

  const handleQuickLogin = (demoRole: UserRole) => {
    if (demoRole === "student") {
      login({
        id: "usr-student-1",
        name: "Alex Johnson",
        email: "alex.johnson@studylens.edu",
        role: "student",
        department: "Computer Science",
      });
    } else if (demoRole === "teacher") {
      login({
        id: "usr-teacher-1",
        name: "Dr. Sarah Smith",
        email: "sarah.smith@studylens.edu",
        role: "teacher",
        department: "Computer Science & IT",
      });
    } else if (demoRole === "admin") {
      login({
        id: "usr-admin-1",
        name: "System Administrator",
        email: "admin@studylens.edu",
        role: "admin",
        department: "Academic Affairs",
      });
    }
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
          <div className="bg-white dark:bg-[#131b30] border border-slate-100 dark:border-slate-800/80 rounded-[28px] p-8 sm:p-10 shadow-xl space-y-6">
            {/* Logo Icon */}
            <div className="h-12 w-12 rounded-2xl bg-[#5b51d8] text-white flex items-center justify-center mx-auto shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>

            {/* Header Text */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {authModal === "login" ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {authModal === "login"
                  ? "Sign in to continue your learning journey"
                  : "Join StudyLens AI and start your learning journey"}
              </p>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs sm:text-sm">
              {authModal === "register" && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5b51d8] font-medium"
                    />
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
                    onClick={() => alert("Password reset link sent to demo user!")}
                    className="text-[#5b51d8] dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Role Option Selector (Register Only) */}
              {authModal === "register" && (
                <div className="space-y-2 pt-1">
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

              {/* Quick 1-Click Demo Portals bar for testing */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[10px] uppercase font-bold text-slate-400 text-center mb-2">
                  Quick Demo 1-Click Entry
                </p>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("student")}
                    className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-[#5b51d8] dark:text-indigo-300 font-semibold rounded-lg text-center cursor-pointer truncate"
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("teacher")}
                    className="py-1.5 px-2 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-600 dark:text-purple-300 font-semibold rounded-lg text-center cursor-pointer truncate"
                  >
                    Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin("admin")}
                    className="py-1.5 px-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-300 font-semibold rounded-lg text-center cursor-pointer truncate"
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Toggle Login/Register Link */}
              <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-2">
                {authModal === "login" ? (
                  <p>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setAuthModal("register")}
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
          </div>

          {/* Bottom Back To Home Link */}
          <div className="text-center mt-6">
            <button
              onClick={() => setAuthModal(null)}
              className="inline-flex items-center space-x-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Landing Page View
  return (
    <div className={`min-h-screen font-sans ${darkMode ? "dark bg-[#0b132b] text-slate-100" : "bg-[#f5f6fc] text-slate-900"}`}>
      {/* ----------------- HEADER NAV BAR ----------------- */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#0e1628] border-b border-slate-200/80 dark:border-slate-800/80 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-2xs transition-colors">
        {/* Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollToSection("home")}>
          <div className="h-10 w-10 rounded-xl bg-[#5b51d8] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
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
            onClick={() => setAuthModal("register")}
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
                onClick={() => setAuthModal("register")}
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
                  onClick={() => handleQuickLogin("student")}
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
                  onClick={() => handleQuickLogin("student")}
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
                  onClick={() => handleQuickLogin("student")}
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
                  onClick={() => handleQuickLogin("student")}
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
