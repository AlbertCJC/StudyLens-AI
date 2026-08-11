import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Shield, Building2, Calendar, Award, CheckCircle2, Lock, Edit3, Save, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import type { User as UserType } from "../types";

export const ProfilePage: React.FC = () => {
  const { currentUser, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || "");
  const [department, setDepartment] = useState(currentUser?.department || "General");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active user profile session.
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserType = {
      ...currentUser,
      name: name.trim() || currentUser.name,
      department: department.trim() || currentUser.department,
    };
    updateUser(updated);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match.");
      return;
    }
    setPasswordMsg("Password updated successfully!");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => {
      setShowPasswordChange(false);
      setPasswordMsg("");
    }, 2000);
  };

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadge = () => {
    switch (currentUser.role) {
      case "admin":
        return {
          label: "System Administrator",
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: ShieldCheck,
        };
      case "teacher":
        return {
          label: "Faculty Instructor",
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          icon: Award,
        };
      default:
        return {
          label: "Enrolled Student",
          bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          icon: BookOpen,
        };
    }
  };

  const badge = getRoleBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white/30 shadow-inner shrink-0">
            {initials}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{currentUser.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md bg-white/10 text-white border-white/20`}>
                <BadgeIcon className="h-3.5 w-3.5" />
                {badge.label}
              </span>
            </div>
            <p className="text-indigo-100 text-sm">{currentUser.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-indigo-200 pt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> {currentUser.department || "General Department"}
              </span>
              {currentUser.studentId && (
                <span className="flex items-center gap-1 font-mono">
                  ID: {currentUser.studentId}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Joined {new Date(currentUser.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-white/20"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/20"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {savedSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Profile updated successfully!
        </motion.div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Editable Info Form / Display */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-500" />
              Account Details
            </h2>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Department / Faculty
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    value={currentUser.email}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Full Name</p>
                  <p className="text-sm font-bold text-foreground mt-1">{currentUser.name}</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {currentUser.email}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">User Role</p>
                  <p className="text-sm font-bold text-foreground mt-1 capitalize flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    {currentUser.role}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Department</p>
                  <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {currentUser.department || "General"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Security & Password Section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-500" />
              Security & Credentials
            </h2>

            {!showPasswordChange ? (
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-bold text-foreground">Password Authentication</p>
                  <p className="text-xs text-muted-foreground">Keep your StudyLens account protected</p>
                </div>
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs font-bold text-foreground">Set New Password</p>
                {passwordMsg && (
                  <p className={`text-xs font-medium ${passwordMsg.includes("successfully") ? "text-emerald-500" : "text-rose-500"}`}>
                    {passwordMsg}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(false)}
                    className="px-3 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Role Overview & Platform Capabilities */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Role Access & Privileges
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-1">
                <p className="font-bold text-indigo-600 dark:text-indigo-400">Current Role: {currentUser.role.toUpperCase()}</p>
                <p className="text-muted-foreground leading-relaxed">
                  {currentUser.role === "admin"
                    ? "Full administrative control over user accounts, subject catalog, system announcements, and audit activity logs."
                    : currentUser.role === "teacher"
                    ? "Access to create and manage courses, post class bulletins, generate AI study materials, and monitor student progress."
                    : "Access to enrolled subjects, AI study assistant, quizzes, flashcards, and personalized progress analytics."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <p className="font-bold text-foreground">Session Token</p>
                <p className="font-mono text-[10px] text-muted-foreground truncate">
                  {currentUser.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfilePage;
