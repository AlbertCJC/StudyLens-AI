import React, { useState } from "react";
import {
  X, Mail, Shield, Building2, Calendar, Award, CheckCircle2,
  Lock, Edit3, Save, Sparkles, BookOpen, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { User as UserType } from "../types";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onUpdateUser?: (updated: UserType) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [prevUserId, setPrevUserId] = useState(user?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [department, setDepartment] = useState(user?.department || "General");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password reset state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  if (user && user.id !== prevUserId) {
    setPrevUserId(user.id);
    setName(user.name);
    setDepartment(user.department || "General");
  }

  if (!isOpen || !user) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserType = {
      ...user,
      name: name.trim() || user.name,
      department: department.trim() || user.department,
    };
    if (onUpdateUser) {
      onUpdateUser(updated);
    }
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

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleBadge = () => {
    switch (user.role) {
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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-[#131b30] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-900 dark:text-white"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-r from-[#5b51d8] to-indigo-600 p-6 pt-8 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
              title="Close profile"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-white text-[#5b51d8] flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-white/20">
                {initials}
              </div>

              <div>
                <h3 className="text-xl font-extrabold tracking-tight">{user.name}</h3>
                <p className="text-xs text-indigo-100 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 opacity-80" />
                  <span>{user.email}</span>
                </p>
                <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm border border-white/30">
                  <BadgeIcon className="w-3 h-3" />
                  <span>{badge.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Toast if Saved */}
          {savedSuccess && (
            <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profile details updated successfully!</span>
            </div>
          )}

          {/* Profile Details Body */}
          <div className="p-6 space-y-5">
            {!isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#5b51d8]" /> Department
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {user.department || "General Studies"}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#5b51d8]" /> ID Reference
                    </p>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {user.studentId || user.id || "STD-2024-001"}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#5b51d8]" /> Account Created
                    </p>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Member"}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#182238] rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Account Status
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Active & Verified
                    </span>
                  </div>
                </div>

                {/* Role Specific Stats Card */}
                <div className="p-4 bg-indigo-50/50 dark:bg-[#182238]/60 border border-indigo-100 dark:border-slate-800 rounded-2xl space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5b51d8] dark:text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {user.role === "student"
                      ? "Student Learning Metrics"
                      : user.role === "teacher"
                      ? "Faculty Teaching Profile"
                      : "Administrator Privileges"}
                  </h4>

                  {user.role === "student" && (
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-[#5b51d8]">3</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Enrolled</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-emerald-500">88%</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Avg Accuracy</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-purple-500">12</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Quizzes Taken</p>
                      </div>
                    </div>
                  )}

                  {user.role === "teacher" && (
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-[#5b51d8]">3</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Subjects</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-blue-500">112</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Students</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#131b30] rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-lg font-black text-purple-500">18</p>
                        <p className="text-[10px] text-slate-400 font-semibold">Materials</p>
                      </div>
                    </div>
                  )}

                  {user.role === "admin" && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                      <p className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Full System Administration & User Governance
                      </p>
                      <p className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Live Security & Real-Time Audit Log Inspection
                      </p>
                    </div>
                  )}
                </div>

                {/* Password Reset Modal Toggle */}
                {showPasswordChange ? (
                  <form onSubmit={handlePasswordChange} className="p-4 bg-slate-50 dark:bg-[#182238] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#5b51d8]" /> Change Password
                    </h4>
                    {passwordMsg && (
                      <p className={`text-[11px] font-semibold ${passwordMsg.includes("successfully") ? "text-emerald-500" : "text-rose-500"}`}>
                        {passwordMsg}
                      </p>
                    )}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full p-2 bg-white dark:bg-[#131b30] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full p-2 bg-white dark:bg-[#131b30] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPasswordChange(false)}
                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl cursor-pointer"
                      >
                        Update Password
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex-1 py-2.5 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-2xl transition-colors text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(true)}
                      className="py-2.5 px-4 bg-slate-100 dark:bg-[#182238] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl transition-colors text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Password</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Edit Form */
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#5b51d8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Department / College Program
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#182238] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#5b51d8]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-2 px-4 bg-slate-100 dark:bg-[#182238] text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-[#5b51d8] hover:bg-[#4c42c9] text-white font-semibold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
