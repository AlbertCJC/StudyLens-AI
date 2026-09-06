import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { User, Mail, Shield, Building2, Calendar, Award, CheckCircle2, Lock, Edit3, Save, Camera, UserCheck, BookOpen, ShieldCheck, Trash2 } from "lucide-react";
import { authFetch } from "../utils/authFetch";
import { checkPasswordStrength } from "../utils/password";
import { PasswordRequirements } from "../components/PasswordRequirements";
import type { User as UserType } from "../types";

export const ProfilePage: React.FC = () => {
  const { currentUser, updateUser, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || "");

  // Password state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
      showToast("Please choose a PNG, JPG, GIF, or WEBP image.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("The image must be 5 MB or smaller.", "error");
      return;
    }
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`/api/users/${currentUser.id}/avatar`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not upload the image. Please try again.", "error");
        return;
      }
      await updateUser(data);
      showToast("Profile photo updated.");
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentUser?.avatar || removingAvatar) return;
    setRemovingAvatar(true);
    try {
      const res = await authFetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not remove the photo. Please try again.", "error");
        return;
      }
      await updateUser(data);
      showToast("Profile photo removed.");
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRemovingAvatar(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active user profile session.
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    performSave();
  };

  const performSave = async () => {
    const updated: UserType = {
      ...currentUser,
      name: name.trim() || currentUser.name,
    };
    await updateUser(updated);
    setIsEditing(false);
    showToast("Profile updated successfully!");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const strengthErr = checkPasswordStrength(newPassword);
    if (strengthErr) {
      showToast(strengthErr, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }
    setPasswordSubmitting(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not update the password. Please try again.", "error");
        return;
      }
      showToast("Password updated successfully!");
      // The backend bumped token_version when the password changed, so the old
      // JWT is invalid; swap in the freshly issued token to stay signed in.
      if (data.token && data.user) {
        refreshSession(data.user, data.token);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      setPasswordSubmitting(false);
    }
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

  const roleInfo = {
    student: {
      description:
        "You're enrolled in your subjects and have everything you need to study — AI-generated quizzes, flashcards, summaries, and reviewers built from your actual lecture materials, plus your own progress analytics.",
      highlights: [
        "Study your enrolled subjects and course materials",
        "Take teacher quizzes and personal practice drills",
        "Generate AI quizzes, flashcards, and reviewers",
        "Track your mastery and get study recommendations",
      ],
    },
    teacher: {
      description:
        "You manage your assigned subjects and publish everything students need — lecture materials, quizzes, and class announcements — while keeping an eye on how the class is performing.",
      highlights: [
        "Upload and organize lecture materials",
        "Build, publish, and manage quizzes",
        "Post class bulletins and announcements",
        "Monitor student progress and performance",
      ],
    },
    admin: {
      description:
        "You keep the platform running smoothly — managing accounts and roles, maintaining the subject catalog, moderating materials, and watching over activity and system performance.",
      highlights: [
        "Manage user accounts and assign roles",
        "Maintain the subject catalog and rosters",
        "Moderate uploaded learning materials",
        "Review activity logs and system performance",
      ],
    },
  }[currentUser.role] as { description: string; highlights: string[] };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-xl bg-[#5b51d8] p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-white/30 shadow-inner"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white/30 shadow-inner">
                {initials}
              </div>
            )}
            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title={uploadingAvatar ? "Uploading..." : "Change profile photo"}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white text-[#5b51d8] flex items-center justify-center shadow-md border border-white/60 hover:scale-105 transition-transform cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
            {isEditing && currentUser.avatar && (
              <button
                onClick={handleRemovePhoto}
                disabled={removingAvatar}
                title={removingAvatar ? "Removing..." : "Remove photo"}
                className="absolute -bottom-1 -right-7 h-7 w-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md border border-white/60 hover:scale-105 transition-transform cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
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
              onClick={performSave}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-white/20"
            >
              <Save className="w-3.5 h-3.5" /> Save Edit
            </button>
          )}
        </div>
      </div>

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
                    Department / Faculty (Read-only)
                  </label>
                  <input
                    type="text"
                    value={currentUser.department || "General"}
                    disabled
                    title="Department is managed by the administration"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed"
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
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                    />
                    <PasswordRequirements password={newPassword} />
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
                    disabled={passwordSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {passwordSubmitting ? "Updating..." : "Update Password"}
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

        {/* Right Column: About My Role */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              About My Role
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">{roleInfo.description}</p>

            <ul className="space-y-2 text-xs">
              {roleInfo.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleAvatarChange}
        className="hidden"
      />
    </div>
  );
};
export default ProfilePage;
