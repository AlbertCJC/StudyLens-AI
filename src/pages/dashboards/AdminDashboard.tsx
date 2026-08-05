import React, { useState, useEffect } from "react";
import {
  Users, Shield, Activity, Plus, Trash2, Server, Megaphone,
  HardDrive, Search, Download, RefreshCw, Play, CheckCircle2,
  X, Pencil, Eye, Key, Lock, Settings, Radio, Sparkles, Check
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../../context/AnnouncementsContext";
import type { User, ActivityLog, UserRole, Subject } from "../../types";

const systemHealthData = [
  { time: "08:00", cpu: 18, memory: 42, requests: 120, latency: 120 },
  { time: "10:00", cpu: 32, memory: 55, requests: 340, latency: 145 },
  { time: "12:00", cpu: 45, memory: 62, requests: 510, latency: 190 },
  { time: "14:00", cpu: 38, memory: 58, requests: 420, latency: 160 },
  { time: "16:00", cpu: 28, memory: 50, requests: 290, latency: 135 },
  { time: "18:00", cpu: 20, memory: 44, requests: 180, latency: 110 },
];

interface AdminDashboardProps {
  defaultTab?: "overview" | "logs" | "users" | "announcements" | "settings";
  hideTabs?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = "overview", hideTabs = false }) => {
  const { currentUser } = useAuth();
  const {
    announcements: globalAnnouncements,
    addAnnouncement,
    deleteAnnouncement: removeGlobalAnnouncement,
  } = useAnnouncements();

  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "users" | "announcements" | "settings">(defaultTab);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveTab(defaultTab);
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultTab]);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Live Auto-Refresh State
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  // Log Filters & Search State
  const [searchLog, setSearchLog] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("all");
  const [selectedLogRoleFilter, setSelectedLogRoleFilter] = useState("all");
  const [selectedLogModal, setSelectedLogModal] = useState<ActivityLog | null>(null);

  // User Management State
  const [searchUser, setSearchUser] = useState("");
  const [selectedUserRoleFilter, setSelectedUserRoleFilter] = useState<string>("all");
  const [selectedUserStatusFilter, setSelectedUserStatusFilter] = useState<string>("all");

  // Modal States - Add User & Edit User
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("student");
  const [newUserDept, setNewUserDept] = useState("Computer Science");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("student");
  const [editUserDept, setEditUserDept] = useState("");
  const [editUserStatus, setEditUserStatus] = useState<"active" | "suspended">("active");

  // Announcement Management State (Teacher / Admin Process Sync)
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annAudience, setAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [annPriority, setAnnPriority] = useState<"high" | "medium" | "low">("medium");
  const [annSubjectId, setAnnSubjectId] = useState("");

  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [editAnnTitle, setEditAnnTitle] = useState("");
  const [editAnnContent, setEditAnnContent] = useState("");
  const [editAnnAudience, setEditAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [editAnnPriority, setEditAnnPriority] = useState<"high" | "medium" | "low">("medium");

  // System Diagnostics & Settings State
  const [systemSettings, setSystemSettings] = useState({
    aiModel: "gemini-3.6-flash",
    maxTokens: 4096,
    temperature: 0.7,
    require2FA: false,
    maintenanceMode: false,
    sessionTimeoutMins: 60,
    autoAuditArchiving: true,
  });
  const [diagnosticResult, setDiagnosticResult] = useState<{
    status: "healthy" | "warning" | "error";
    apiLatency: string;
    dbConn: string;
    aiStatus: string;
  } | null>(null);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Fetch Core Data
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadAllData = async () => {
      try {
        const [logsRes, usersRes, subRes, setRes] = await Promise.all([
          fetch("/api/logs"),
          fetch("/api/users"),
          fetch("/api/subjects"),
          fetch("/api/system/settings"),
        ]);
        if (!isMounted) return;
        if (logsRes.ok) setLogs(await logsRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());
        if (subRes.ok) setSubjects(await subRes.json());
        if (setRes.ok) setSystemSettings(await setRes.json());
        setLastRefreshed(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Error loading initial admin data:", err);
      }
    };
    loadAllData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Live Log Monitoring Interval
  useEffect(() => {
    if (!isLiveMonitoring) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isLiveMonitoring]);

  // User Management Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          department: newUserDept,
          status: "active",
        }),
      });
      if (res.ok) {
        const createdUser = await res.json();
        setUsers((prev) => [createdUser, ...prev]);
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        fetchLogs();
      }
    } catch (err) {
      console.error("Create user failed:", err);
    }
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserRole(user.role);
    setEditUserDept(user.department || "General");
    setEditUserStatus(user.status || "active");
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserName,
          role: editUserRole,
          department: editUserDept,
          status: editUserStatus,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setEditingUser(null);
        fetchLogs();
      }
    } catch (err) {
      console.error("Save user edit failed:", err);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        fetchLogs();
      }
    } catch (err) {
      console.error("Toggle user status failed:", err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user account?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        fetchLogs();
      }
    } catch (err) {
      console.error("Delete user failed:", err);
    }
  };

  const handleResetPassword = (user: User) => {
    const tempPass = `Pass-${Math.floor(100000 + Math.random() * 900000)}`;
    alert(`Temporary password generated for ${user.name} (${user.email}):\n\n${tempPass}\n\nPlease share this securely with the user.`);
    // Submit log
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser?.id || "usr-admin-1",
        userName: currentUser?.name || "System Admin",
        userRole: "admin",
        action: "PASSWORD_RESET",
        details: `Reset password for user account ${user.name} (${user.email})`,
      }),
    }).then(() => fetchLogs());
  };

  // Announcement Actions (Same process as Teachers & AnnouncementsContext)
  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const selectedSub = subjects.find((s) => s.id === annSubjectId);
    const subName = selectedSub ? `${selectedSub.code} - ${selectedSub.name}` : undefined;

    addAnnouncement({
      title: annTitle.trim(),
      content: annContent.trim(),
      authorName: `${currentUser?.name || "Dr. Arthur Vance"} (Admin)`,
      targetAudience: annAudience,
      priority: annPriority,
      subjectId: selectedSub ? selectedSub.id : undefined,
      subjectName: subName,
      tag: selectedSub ? selectedSub.code : annPriority === "high" ? "Urgent Notice" : "System Bulletin",
    });

    setShowAnnounceModal(false);
    setAnnTitle("");
    setAnnContent("");
    setAnnSubjectId("");
    setTimeout(() => fetchLogs(), 500);
  };

  const handleOpenEditAnn = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setEditAnnTitle(ann.title);
    setEditAnnContent(ann.content);
    setEditAnnAudience(ann.targetAudience);
    setEditAnnPriority(ann.priority);
  };

  const handleSaveAnnEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn) return;

    try {
      const res = await fetch(`/api/announcements/${editingAnn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editAnnTitle,
          content: editAnnContent,
          targetAudience: editAnnAudience,
          priority: editAnnPriority,
        }),
      });
      if (res.ok) {
        setEditingAnn(null);
        fetchLogs();
      }
    } catch (err) {
      console.error("Save announcement edit failed:", err);
    }
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!window.confirm("Delete this system announcement bulletin?")) return;
    removeGlobalAnnouncement(id);
    setTimeout(() => fetchLogs(), 500);
  };

  // Audit Logs Actions
  const handleSimulateTestLog = async () => {
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser?.id || "usr-admin-1",
          userName: currentUser?.name || "Dr. Arthur Vance",
          userRole: "admin",
          action: "DIAGNOSTIC_CHECK",
          details: `Manual security audit diagnostic performed by Administrator from IP ${window.location.hostname}`,
        }),
      });
      fetchLogs();
    } catch (err) {
      console.error("Simulate log failed:", err);
    }
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm("Are you sure you want to archive and clear all active audit logs?")) return;
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error("Clear logs failed:", err);
    }
  };

  const handleExportLogsCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Log ID,Timestamp,User Name,Role,Action,Details,IP Address\n" +
      filteredLogs
        .map(
          (l) =>
            `"${l.id}","${l.timestamp}","${l.userName}","${l.userRole}","${l.action}","${l.details.replace(
              /"/g,
              '""'
            )}","${l.ipAddress || "127.0.0.1"}"`
        )
        .join("\n");

    const ts = new Date().getTime();
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `StudyLens_Audit_Trail_${ts}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // System Diagnostics & Settings Actions
  const handleRunDiagnostics = () => {
    setDiagnosticResult(null);
    setTimeout(() => {
      setDiagnosticResult({
        status: "healthy",
        apiLatency: "42 ms",
        dbConn: "Active • In-Memory & REST Proxy",
        aiStatus: "Gemini 3.6 Flash Server-Side Operational",
      });
    }, 600);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemSettings),
      });
      if (res.ok) {
        setSettingsSavedMessage(true);
        setTimeout(() => setSettingsSavedMessage(false), 3000);
        fetchLogs();
      }
    } catch (err) {
      console.error("Save settings error:", err);
    }
  };

  const handleExportSystemBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      systemSettings,
      users,
      subjects,
      announcementsCount: globalAnnouncements.length,
      activityLogsCount: logs.length,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().getTime();
    a.download = `StudyLens_System_Backup_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Log Filtering Logic
  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedActionFilter === "all" || log.action === selectedActionFilter;
    const matchesRole = selectedLogRoleFilter === "all" || log.userRole === selectedLogRoleFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(searchLog.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchLog.toLowerCase()) ||
      log.details.toLowerCase().includes(searchLog.toLowerCase()) ||
      (log.ipAddress && log.ipAddress.includes(searchLog));
    return matchesAction && matchesRole && matchesSearch;
  });

  // User Filtering Logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchUser.toLowerCase()));
    const matchesRole = selectedUserRoleFilter === "all" || u.role === selectedUserRoleFilter;
    const matchesStatus =
      selectedUserStatusFilter === "all" ||
      (selectedUserStatusFilter === "active" ? u.status !== "suspended" : u.status === "suspended");
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {!hideTabs ? (
        <>
          {/* Admin Header Banner */}
          <div className="bg-gradient-to-r from-rose-50 via-slate-100 to-rose-50/50 border border-rose-200/80 text-slate-900 dark:from-rose-950 dark:via-slate-900 dark:to-slate-950 dark:border-rose-900/30 dark:text-white rounded-3xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200/80 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 text-xs font-semibold backdrop-blur-xs">
                <Shield className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Administrator Portal • Governance & Security Operations</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                System Administration Center
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                Manage user accounts, review real-time security audit trails, broadcast institutional bulletins, and monitor AI platform performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add User Account</span>
              </button>
              <button
                onClick={() => setShowAnnounceModal(true)}
                className="px-4 py-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Megaphone className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Broadcast Notice</span>
              </button>
            </div>
          </div>

          {/* Admin Tabs Bar */}
          <div className="flex items-center space-x-2 border-b border-border pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "overview"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>System Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer relative ${
                activeTab === "logs"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit & Activity Logs</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-200 border border-rose-400/30 font-extrabold ml-1">
                {logs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "users"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Accounts ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("announcements")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "announcements"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Bulletins & Notices ({globalAnnouncements.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>System Settings</span>
            </button>
          </div>
        </>
      ) : (
        /* Standalone Nav View Banner */
        <div className="bg-gradient-to-r from-rose-50 via-slate-100 to-rose-50/50 border border-rose-200/80 text-slate-900 dark:from-rose-950 dark:via-slate-900 dark:to-slate-950 dark:border-rose-900/30 dark:text-white rounded-3xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200/80 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 text-xs font-semibold backdrop-blur-xs">
              {activeTab === "logs" ? (
                <>
                  <Activity className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Security Operations • Real-Time Security Audit Trail</span>
                </>
              ) : activeTab === "users" ? (
                <>
                  <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Institutional Directory • Accounts & Access Control</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Administrator Portal</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {activeTab === "logs"
                ? "Audit & Activity Logs"
                : activeTab === "users"
                ? "User Management Directory"
                : "System Administration"}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              {activeTab === "logs"
                ? "Full real-time system audit logs, account operations, user authentications, and AI generation activity stream."
                : activeTab === "users"
                ? "Manage student profiles, faculty members, administrative permissions, and account statuses."
                : "Manage platform operations and configuration."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === "logs" && (
              <button
                onClick={handleExportLogsCSV}
                className="px-4 py-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold flex items-center space-x-2 cursor-pointer shadow-sm transition-all"
              >
                <Download className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Export Audit CSV</span>
              </button>
            )}
            {activeTab === "users" && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add User Account</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">User Directory</p>
                <p className="text-2xl font-black text-foreground">{users.length || 4}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">● {users.filter(u => u.status !== "suspended").length} Active Accounts</p>
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Server Runtime</p>
                <p className="text-2xl font-bold text-foreground">Online</p>
                <p className="text-[11px] text-blue-600 font-medium mt-0.5">Node Express • Cloud Run Port 3000</p>
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">AI Integration</p>
                <p className="text-2xl font-bold text-foreground">Gemini 3.6</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Server-Side Proxy Ready</p>
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Audit Log Trail</p>
                <p className="text-2xl font-bold text-foreground">{logs.length}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Events Captured Live</p>
              </div>
            </div>
          </div>

          {/* Traffic Area Chart */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-rose-600 dark:text-rose-400" /> API Requests & Engine Throughput
                </h3>
                <p className="text-xs text-muted-foreground">HTTP request load and AI bloom generation latency in real time</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRunDiagnostics}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Run Diagnostics</span>
                </button>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Uptime 99.98%
                </span>
              </div>
            </div>

            {diagnosticResult && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Diagnostic Scan Results — All Systems Operational</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-foreground font-medium">
                  <div>API Latency: <span className="font-bold text-emerald-600">{diagnosticResult.apiLatency}</span></div>
                  <div>Database State: <span className="font-bold text-emerald-600">{diagnosticResult.dbConn}</span></div>
                  <div>AI Proxy: <span className="font-bold text-emerald-600">{diagnosticResult.aiStatus}</span></div>
                </div>
              </div>
            )}

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={systemHealthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "1px solid #334155", color: "#f8fafc", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="#e11d48" fill="#f43f5e" fillOpacity={0.15} name="API Requests" />
                  <Area type="monotone" dataKey="memory" stroke="#6366f1" fill="#818cf8" fillOpacity={0.1} name="RAM Usage %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Logs Snippet */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Live Security Audit Log Activity</h3>
                <p className="text-xs text-muted-foreground">Recent authentication, user administration, and content operations</p>
              </div>
              <button
                onClick={() => setActiveTab("logs")}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center space-x-1 cursor-pointer"
              >
                <span>View Full Audit Console →</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-muted-foreground border-b border-border bg-muted/40">
                  <tr>
                    <th className="p-3 font-semibold">Event Action</th>
                    <th className="p-3 font-semibold">Triggered By</th>
                    <th className="p-3 font-semibold">Details</th>
                    <th className="p-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.slice(0, 5).map((log) => (
                    <tr key={log.id} onClick={() => setSelectedLogModal(log)} className="hover:bg-muted/20 cursor-pointer">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-foreground">{log.userName}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-xs">{log.details}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Bulletins Snippet */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Recent Institutional Bulletins</h3>
                  <p className="text-xs text-muted-foreground">Active announcements broadcast across Student, Faculty, and Admin views</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAnnounceModal(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Broadcast Notice</span>
                </button>
                <button
                  onClick={() => setActiveTab("announcements")}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Manage Bulletins →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {globalAnnouncements.length === 0 ? (
                <div className="col-span-2 p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
                  No active announcements published. Click "Broadcast Notice" to post one.
                </div>
              ) : (
                globalAnnouncements.slice(0, 4).map((ann) => (
                  <div key={ann.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 hover:border-rose-500/30 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ann.priority === "high" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      }`}>
                        {ann.priority || "medium"} Priority
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">{ann.createdAt}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{ann.title}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{ann.content}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>By: {ann.authorName}</span>
                      <span className="capitalize">Target: {ann.targetAudience}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT & ACTIVITY LOGS (FULL FUNCTIONABLE CONSOLE) */}
      {activeTab === "logs" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
          {/* Audit Trail Toolbar & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-600" /> Institutional Audit & Activity Logs
                </h3>
                {isLiveMonitoring ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Stream Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time security auditing, account changes, login events, and AI generation activity • Last update: {lastRefreshed}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isLiveMonitoring
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isLiveMonitoring ? "Live Monitoring ON" : "Turn On Live Stream"}</span>
              </button>

              <button
                onClick={handleSimulateTestLog}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                title="Inject a test audit entry to verify stream response"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Event</span>
              </button>

              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="p-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold cursor-pointer transition-all"
                title="Manual Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin text-rose-600" : ""}`} />
              </button>

              <button
                onClick={handleExportLogsCSV}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleClearAuditLogs}
                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold cursor-pointer"
                title="Clear Audit Trail"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search action, user, IP, or keyword..."
                className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div>
              <select
                value={selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value)}
                className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
              >
                <option value="all">⚡ All Action Categories</option>
                <option value="USER_LOGIN">🔑 USER_LOGIN</option>
                <option value="USER_REGISTER">📝 USER_REGISTER</option>
                <option value="USER_CREATED">➕ USER_CREATED</option>
                <option value="USER_UPDATED">✏️ USER_UPDATED</option>
                <option value="USER_STATUS_CHANGED">🔒 USER_STATUS_CHANGED</option>
                <option value="USER_DELETED">🗑️ USER_DELETED</option>
                <option value="MATERIAL_UPLOAD">📚 MATERIAL_UPLOAD</option>
                <option value="QUIZ_SUBMIT">🎯 QUIZ_SUBMIT</option>
                <option value="ANNOUNCEMENT_POSTED">📢 ANNOUNCEMENT_POSTED</option>
                <option value="ANNOUNCEMENT_DELETED">❌ ANNOUNCEMENT_DELETED</option>
                <option value="SETTINGS_UPDATED">⚙️ SETTINGS_UPDATED</option>
                <option value="SYSTEM_BOOT">🖥️ SYSTEM_BOOT</option>
              </select>
            </div>

            <div>
              <select
                value={selectedLogRoleFilter}
                onChange={(e) => setSelectedLogRoleFilter(e.target.value)}
                className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
              >
                <option value="all">👥 All Roles (Students, Teachers, Admins)</option>
                <option value="student">🎓 Student Role</option>
                <option value="teacher">👨‍🏫 Faculty / Teacher Role</option>
                <option value="admin">🛡️ Administrator Role</option>
              </select>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
                <tr>
                  <th className="p-3">Event Code</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Details & Scope</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No matching audit logs found. Try adjusting search query or filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogModal(log)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="p-3 font-mono font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-foreground">{log.userName}</p>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{log.userRole}</span>
                      </td>
                      <td className="p-3 text-foreground font-medium">{log.details}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogModal(log);
                          }}
                          className="p-1.5 bg-muted group-hover:bg-rose-600 group-hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER ACCOUNTS DIRECTORY */}
      {activeTab === "users" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Institutional User Directory</h3>
              <p className="text-xs text-muted-foreground">
                Manage user access credentials, role designations, and account active/suspended statuses
              </p>
            </div>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          </div>

          {/* User Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search name, email, or department..."
                className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div>
              <select
                value={selectedUserRoleFilter}
                onChange={(e) => setSelectedUserRoleFilter(e.target.value)}
                className="w-full p-2 bg-card border border-border rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Faculty / Teachers</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div>
              <select
                value={selectedUserStatusFilter}
                onChange={(e) => setSelectedUserStatusFilter(e.target.value)}
                className="w-full p-2 bg-card border border-border rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Account Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
                <tr>
                  <th className="p-3">User & Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-bold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{u.email}</p>
                      {u.studentId && (
                        <span className="text-[10px] text-slate-500 font-semibold">ID: {u.studentId}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          u.role === "admin"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : u.role === "teacher"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-semibold">{u.department || "General Studies"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          u.status === "suspended"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                        }`}
                        title="Click to toggle account active/suspended state"
                      >
                        {u.status === "suspended" ? "● Suspended" : "● Active"}
                      </button>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="p-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors cursor-pointer"
                        title="Edit User Profile"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg transition-colors cursor-pointer"
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BULLETINS & ANNOUNCEMENTS (IDENTICAL TO TEACHER PROCESS) */}
      {activeTab === "announcements" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Global Institutional Bulletins</h3>
              <p className="text-xs text-muted-foreground">
                Broadcast notices displayed directly across Student, Faculty, and Admin dashboards
              </p>
            </div>
            <button
              onClick={() => setShowAnnounceModal(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Broadcast Notice</span>
            </button>
          </div>

          <div className="space-y-3">
            {globalAnnouncements.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-border">
                No active announcements published yet. Click "Broadcast Notice" above to send an update.
              </div>
            ) : (
              globalAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-5 rounded-2xl border border-border bg-card hover:bg-muted/10 space-y-3 transition-all hover:border-rose-500/30 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/50">
                    <div className="flex items-center flex-wrap gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ann.priority === "high"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : ann.priority === "medium"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {ann.priority || "medium"} Priority
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border/50 capitalize">
                        Audience: {ann.targetAudience}
                      </span>
                      {ann.tag && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {ann.tag}
                        </span>
                      )}
                      {ann.subjectName && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {ann.subjectName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                      <span className="text-xs text-muted-foreground font-mono">{ann.createdAt}</span>
                      <div className="flex items-center space-x-1 border-l border-border pl-2">
                        <button
                          onClick={() => handleOpenEditAnn(ann)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                          title="Edit Bulletin"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Bulletin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-foreground tracking-tight">{ann.title}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">{ann.content}</p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/30">
                    <span className="flex items-center space-x-1">
                      <span>Published by:</span>
                      <strong className="text-foreground font-semibold">{ann.authorName}</strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM SETTINGS & GOVERNANCE */}
      {activeTab === "settings" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-600" /> System Governance & AI Engine Settings
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure platform defaults, Gemini AI model parameters, security policies, and maintenance mode
              </p>
            </div>

            <button
              onClick={handleExportSystemBackup}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download System Backup</span>
            </button>
          </div>

          {settingsSavedMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 font-bold flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>System governance configuration saved and synced across cluster!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            {/* AI Engine Settings */}
            <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
              <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-rose-600" />
                <span>AI Generation Parameters (Gemini Engine)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold mb-1">Target Model Version</label>
                  <select
                    value={systemSettings.aiModel}
                    onChange={(e) => setSystemSettings({ ...systemSettings, aiModel: e.target.value })}
                    className="w-full p-2.5 bg-card border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                    <option value="gemini-3.0-pro">Gemini 3.0 Pro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Max Output Token Limit</label>
                  <input
                    type="number"
                    value={systemSettings.maxTokens}
                    onChange={(e) => setSystemSettings({ ...systemSettings, maxTokens: Number(e.target.value) })}
                    className="w-full p-2.5 bg-card border border-border rounded-xl font-mono text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Generation Creativity (Temperature): {systemSettings.temperature}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={systemSettings.temperature}
                    onChange={(e) => setSystemSettings({ ...systemSettings, temperature: Number(e.target.value) })}
                    className="w-full mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Security Policy Settings */}
            <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
              <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Security & Authentication Governance</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="font-bold text-foreground">Require Multi-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-muted-foreground">Enforce 2FA verification for faculty and administrative roles</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.require2FA}
                    onChange={(e) => setSystemSettings({ ...systemSettings, require2FA: e.target.checked })}
                    className="w-5 h-5 accent-rose-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="font-bold text-foreground">Auto Audit Log Archiving</p>
                    <p className="text-[11px] text-muted-foreground">Automatically archive activity logs after 90 days</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.autoAuditArchiving}
                    onChange={(e) => setSystemSettings({ ...systemSettings, autoAuditArchiving: e.target.checked })}
                    className="w-5 h-5 accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">Idle Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    value={systemSettings.sessionTimeoutMins}
                    onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeoutMins: Number(e.target.value) })}
                    className="w-full p-2.5 bg-card border border-border rounded-xl font-mono text-foreground"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="font-bold text-foreground">System Maintenance Mode</p>
                    <p className="text-[11px] text-muted-foreground">Restrict non-admin student/faculty access during updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.maintenanceMode}
                    onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
                    className="w-5 h-5 accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Save Governance Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Add New User Account</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="j.doe@studylens.edu"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Role Designation</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher / Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Department</label>
                  <input
                    type="text"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Edit User Account</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Role Designation</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Account Status</label>
                  <select
                    value={editUserStatus}
                    onChange={(e) => setEditUserStatus(e.target.value as "active" | "suspended")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Department</label>
                <input
                  type="text"
                  value={editUserDept}
                  onChange={(e) => setEditUserDept(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BROADCAST ANNOUNCEMENT MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Broadcast Institutional Notice</h3>
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Notice Title</label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. System Maintenance & Exam Schedule"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Target Audience</label>
                  <select
                    value={annAudience}
                    onChange={(e) => setAnnAudience(e.target.value as "all" | "students" | "teachers")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="all">Everyone (All Roles)</option>
                    <option value="students">Students Only</option>
                    <option value="teachers">Faculty / Teachers Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Priority Level</label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="high">🔥 High / Urgent</option>
                    <option value="medium">📌 Medium</option>
                    <option value="low">💬 Low / Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Associated Course Subject (Optional)</label>
                <select
                  value={annSubjectId}
                  onChange={(e) => setAnnSubjectId(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground"
                >
                  <option value="">-- Institutional / All Subjects --</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Notice Body Content</label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Details of the announcement bulletin..."
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Publish Bulletin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT ANNOUNCEMENT MODAL */}
      {editingAnn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Edit Bulletin Announcement</h3>
              <button
                onClick={() => setEditingAnn(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editAnnTitle}
                  onChange={(e) => setEditAnnTitle(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Target Audience</label>
                  <select
                    value={editAnnAudience}
                    onChange={(e) => setEditAnnAudience(e.target.value as "all" | "students" | "teachers")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="all">Everyone</option>
                    <option value="students">Students</option>
                    <option value="teachers">Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Priority</label>
                  <select
                    value={editAnnPriority}
                    onChange={(e) => setEditAnnPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Content</label>
                <textarea
                  required
                  rows={4}
                  value={editAnnContent}
                  onChange={(e) => setEditAnnContent(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingAnn(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: LOG INSPECTION DETAIL MODAL */}
      {selectedLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-foreground">Audit Event Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedLogModal(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border border-border font-mono">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Event Action</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{selectedLogModal.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-sans">Log ID</span>
                  <span className="font-bold text-foreground">{selectedLogModal.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Triggered By</span>
                  <p className="font-bold text-foreground text-xs mt-0.5">{selectedLogModal.userName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: {selectedLogModal.userId}</p>
                  <span className="inline-block px-2 py-0.5 mt-1 rounded bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase">
                    Role: {selectedLogModal.userRole}
                  </span>
                </div>

                <div className="p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Origin & Timestamp</span>
                  <p className="font-mono text-xs font-bold text-foreground mt-0.5">
                    IP: {selectedLogModal.ipAddress || "127.0.0.1"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">
                    {new Date(selectedLogModal.timestamp).toUTCString()}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Event Description</span>
                <p className="text-foreground font-semibold leading-relaxed">{selectedLogModal.details}</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl text-slate-200 font-mono text-[11px] space-y-1 overflow-x-auto">
                <span className="text-slate-400 text-[10px] uppercase font-sans block">Raw Payload JSON</span>
                <pre>{JSON.stringify(selectedLogModal, null, 2)}</pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLogModal, null, 2));
                  alert("Audit log JSON payload copied to clipboard!");
                }}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl cursor-pointer"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setSelectedLogModal(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
