import React, { useState, useEffect } from "react";
import {
  Users, Activity, Plus, Trash2, Megaphone,
  Search, Download, RefreshCw, CheckCircle2,
  X, Pencil, Eye, Key, Lock, Settings, Check, Wrench,
  BookOpen, ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAnnouncements, type AnnouncementItem } from "../../context/AnnouncementsContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { RelativeTime } from "../../utils/time";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CardDetailModal, DetailRow } from "../../components/CardDetailModal";
import { Pagination, slicePage } from "../../components/Pagination";
import type { User, ActivityLog, UserRole, Subject } from "../../types";

const LOG_PAGE_SIZE = 10;

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "User logged in",
  USER_REGISTER: "New account registered",
  USER_CREATED: "User account created",
  USER_UPDATED: "User profile updated",
  USER_STATUS_CHANGED: "Account status changed",
  USER_DELETED: "User account deleted",
  PASSWORD_RESET: "Password reset",
  RESET_OTP_REQUESTED: "Password reset requested",
  PASSWORD_CHANGED: "Password changed",
  LOGIN_FAILED: "Failed login attempt",
  MATERIAL_UPLOAD: "Material uploaded",
  MATERIAL_UPDATE: "Material updated",
  MATERIAL_DELETE: "Material deleted",
  MATERIAL_AI_SAVE: "AI material saved",
  QUIZ_CREATE: "Quiz created",
  QUIZ_UPDATE: "Quiz updated",
  QUIZ_DELETE: "Quiz deleted",
  QUIZ_PUBLISH: "Quiz published",
  QUIZ_UNPUBLISH: "Quiz unpublished",
  QUIZ_SUBMIT: "Quiz submitted",
  ANNOUNCEMENT_POSTED: "Announcement posted",
  ANNOUNCEMENT_DELETED: "Announcement deleted",
  SETTINGS_UPDATED: "Settings updated",
  SYSTEM_BOOT: "System boot",
  SUBJECT_CREATE: "Subject created",
  SUBJECT_UPDATE: "Subject updated",
  SUBJECT_DELETE: "Subject deleted",
  SUBJECT_ENROLL: "Students assigned to subject",
  SUBJECT_UNENROLL: "Students removed from subject",
  AI_QUIZ_GENERATE: "AI quiz generated",
  AI_SUMMARY_GENERATE: "AI summary generated",
  AI_REVIEWER_GENERATE: "AI reviewer generated",
  AI_FLASHCARDS_GENERATE: "AI flashcards generated",
  AI_RESOURCE_GENERATE: "AI resource generated",
  AI_RESOURCE_SAVE: "AI resource saved",
  AI_SERVICE_DOWN: "AI service unavailable",
  FLASHCARD_UPDATE: "Flashcard deck updated",
  FLASHCARD_DELETE: "Flashcard deck deleted",
  SUMMARY_UPDATE: "Summary updated",
  SUMMARY_DELETE: "Summary deleted",
  REVIEWER_UPDATE: "Reviewer updated",
  REVIEWER_DELETE: "Reviewer deleted",
  REPORT_GENERATE: "Report generated",
  LOGS_CLEARED: "Activity logs cleared",
  DIAGNOSTIC_CHECK: "System diagnostic run",
};

const ACTION_CATEGORY: Record<string, { group: string; badge: string }> = {
  USER_LOGIN: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_REGISTER: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_CREATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_UPDATED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_STATUS_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  USER_DELETED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_RESET: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  RESET_OTP_REQUESTED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PASSWORD_CHANGED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LOGIN_FAILED: { group: "Accounts & Authentication", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  MATERIAL_UPLOAD: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_UPDATE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_DELETE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  MATERIAL_AI_SAVE: { group: "Learning Materials", badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  QUIZ_CREATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UPDATE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_DELETE: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_PUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_UNPUBLISH: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUIZ_SUBMIT: { group: "Quizzes & Assessments", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  SUBJECT_CREATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UPDATE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_DELETE: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_ENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  SUBJECT_UNENROLL: { group: "Subjects & Enrollments", badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  AI_QUIZ_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SUMMARY_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_REVIEWER_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_FLASHCARDS_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_GENERATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_RESOURCE_SAVE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AI_SERVICE_DOWN: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  FLASHCARD_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  SUMMARY_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_UPDATE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEWER_DELETE: { group: "AI Generation & Resources", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ANNOUNCEMENT_POSTED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ANNOUNCEMENT_DELETED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SETTINGS_UPDATED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  SYSTEM_BOOT: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  REPORT_GENERATE: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  LOGS_CLEARED: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  DIAGNOSTIC_CHECK: { group: "System & Announcements", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

const ACTION_GROUPS: { group: string; codes: string[] }[] = [
  {
    group: "Accounts & Authentication",
    codes: ["USER_LOGIN", "USER_REGISTER", "USER_CREATED", "USER_UPDATED", "USER_STATUS_CHANGED", "USER_DELETED", "PASSWORD_CHANGED", "PASSWORD_RESET", "RESET_OTP_REQUESTED", "LOGIN_FAILED"],
  },
  {
    group: "Learning Materials",
    codes: ["MATERIAL_UPLOAD", "MATERIAL_UPDATE", "MATERIAL_DELETE", "MATERIAL_AI_SAVE"],
  },
  {
    group: "Quizzes & Assessments",
    codes: ["QUIZ_CREATE", "QUIZ_UPDATE", "QUIZ_DELETE", "QUIZ_PUBLISH", "QUIZ_UNPUBLISH", "QUIZ_SUBMIT"],
  },
  {
    group: "Subjects & Enrollments",
    codes: ["SUBJECT_CREATE", "SUBJECT_UPDATE", "SUBJECT_DELETE", "SUBJECT_ENROLL", "SUBJECT_UNENROLL"],
  },
  {
    group: "AI Generation & Resources",
    codes: ["AI_QUIZ_GENERATE", "AI_SUMMARY_GENERATE", "AI_REVIEWER_GENERATE", "AI_FLASHCARDS_GENERATE", "AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE", "AI_SERVICE_DOWN", "FLASHCARD_UPDATE", "FLASHCARD_DELETE", "SUMMARY_UPDATE", "SUMMARY_DELETE", "REVIEWER_UPDATE", "REVIEWER_DELETE"],
  },
  {
    group: "System & Announcements",
    codes: ["ANNOUNCEMENT_POSTED", "ANNOUNCEMENT_DELETED", "SETTINGS_UPDATED", "SYSTEM_BOOT", "REPORT_GENERATE", "LOGS_CLEARED", "DIAGNOSTIC_CHECK"],
  },
];

const actionLabel = (code: string): string => ACTION_LABELS[code] || code;

const actionCategory = (code: string): { group: string; badge: string } =>
  ACTION_CATEGORY[code] || { group: "Other", badge: "bg-muted text-muted-foreground" };

export const MODERATION_FILTER = "__moderation__";

interface AdminDashboardProps {
  defaultTab?: "overview" | "logs" | "users" | "announcements" | "settings" | "subjects";
  hideTabs?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = "overview", hideTabs = false }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    announcements: globalAnnouncements,
    addAnnouncement,
    deleteAnnouncement: removeGlobalAnnouncement,
  } = useAnnouncements();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "users" | "announcements" | "settings" | "subjects">(defaultTab);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveTab(defaultTab);
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultTab]);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Log Refresh State
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  // Log Filters & Search State
  const [searchLog, setSearchLog] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("all");
  const [selectedLogRoleFilter, setSelectedLogRoleFilter] = useState("all");
  const [selectedLogModal, setSelectedLogModal] = useState<ActivityLog | null>(null);

  // User Management State
  const [searchUser, setSearchUser] = useState("");
  const [selectedUserRoleFilter, setSelectedUserRoleFilter] = useState<string>(searchParams.get("role") || "all");
  const [selectedUserStatusFilter, setSelectedUserStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [userPage, setUserPage] = useState(1);

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

  // Subject Management State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subTeacherId, setSubTeacherId] = useState("");
  const [subSemester, setSubSemester] = useState("1st Semester");
  const [subCourse, setSubCourse] = useState("BSIT");
  const [subYear, setSubYear] = useState("2026-2027");

  // Roster Management State
  const [rosterSubject, setRosterSubject] = useState<Subject | null>(null);
  const [rosterStudents, setRosterStudents] = useState<{ id: string; name: string; email: string; studentId?: string; dateEnrolled?: string }[]>([]);
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [assignFilter, setAssignFilter] = useState<"all" | "enrolled" | "unenrolled">("all");
  const [assignSearch, setAssignSearch] = useState("");

  const DEFAULT_SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];
  const DEFAULT_COURSES = ["BSIT", "BSCS", "BSIS", "BSCPE"];

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    require2FA: false,
    maintenanceMode: false,
    sessionTimeoutMins: 60,
    autoAuditArchiving: true,
  });

  // Banner message state (settings / subjects / roster feedback)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);
  const [settingsSavedAt, setSettingsSavedAt] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [subMsg, setSubMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [rosterMsg, setRosterMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Fetch Core Data — activity logs are fetched server-side (filtered + paginated)
  const fetchLogs = async (page: number = logPage, limit: number = LOG_PAGE_SIZE) => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (selectedActionFilter !== "all") params.set("action", selectedActionFilter);
      if (selectedLogRoleFilter !== "all") params.set("role", selectedLogRoleFilter);
      if (searchLog.trim()) params.set("search", searchLog.trim());
      const res = await authFetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
        setLogPage(data.page || 1);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Refetch logs whenever filters / page change (page-size is fixed at 10).
  useEffect(() => {
    fetchLogs(logPage, LOG_PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLog, selectedActionFilter, selectedLogRoleFilter, logPage]);

  useEffect(() => {
    let isMounted = true;
    const loadAllData = async () => {
      try {
        const [logsRes, usersRes, subRes, setRes] = await Promise.all([
          authFetch("/api/logs?page=1&limit=10"),
          authFetch("/api/users"),
          authFetch("/api/subjects"),
          authFetch("/api/system/settings"),
        ]);
        if (!isMounted) return;
        if (logsRes.ok) {
          const data = await logsRes.json();
          setLogs(data.logs || []);
          setLogsTotal(data.total || 0);
          setLogPage(data.page || 1);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User Management Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      const res = await authFetch("/api/users", {
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
        showToast("User account created successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not create the user account. Please try again.", "error");
      }
    } catch (err) {
      console.error("Create user failed:", err);
      showToast("Could not create the user account. Please try again.", "error");
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
      const res = await authFetch(`/api/users/${editingUser.id}`, {
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
        showToast("User account updated successfully.");
      }
    } catch (err) {
      console.error("Save user edit failed:", err);
      showToast("Could not update the user account. Please try again.", "error");
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        fetchLogs();
        showToast(nextStatus === "active" ? "User account activated." : "User account suspended.");
      }
    } catch (err) {
      console.error("Toggle user status failed:", err);
      showToast("Could not update the account status. Please try again.", "error");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user account?")) return;
    try {
      const res = await authFetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        fetchLogs();
        showToast("User account deleted.");
      }
    } catch (err) {
      console.error("Delete user failed:", err);
      showToast("Could not delete the user account. Please try again.", "error");
    }
  };

  const handleResetPassword = async (user: User) => {
    const tempPass = `A!${Math.floor(100000 + Math.random() * 900000)}x`;
    const resetting = window.confirm(`Generate a temporary password for ${user.name} (${user.email})?\n\nThe account password will be reset to a new temporary value.`);
    if (!resetting) return;
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: tempPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`Could not reset the password: ${data?.error || "Please try again."}`, "error");
        return;
      }
      showToast(`Temporary password generated for ${user.name} (${user.email}): ${tempPass}`, "success", 10000);
    } catch {
      showToast("Could not reach the server. Please check your connection and try again.", "error");
      return;
    }
    // Submit log
    authFetch("/api/logs", {
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
    showToast("Announcement posted.");
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
      const res = await authFetch(`/api/announcements/${editingAnn.id}`, {
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
        showToast("Announcement updated.");
      }
    } catch (err) {
      console.error("Save announcement edit failed:", err);
      showToast("Could not update the announcement. Please try again.", "error");
    }
  };

  const [annToDelete, setAnnToDelete] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<"users" | "subjects" | null>(null);

  const handleDeleteAnnouncement = (id: string) => {
    setAnnToDelete(id);
  };

  const confirmDeleteAnnouncement = () => {
    if (annToDelete) {
      removeGlobalAnnouncement(annToDelete);
      setTimeout(() => fetchLogs(), 500);
      showToast("Announcement deleted.");
    }
    setAnnToDelete(null);
  };

  // Subject Management Actions
  const teachers = users.filter((u) => u.role === "teacher");

  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubCode("");
    setSubName("");
    setSubDesc("");
    setSubTeacherId(teachers[0]?.id || "");
    setSubSemester("1st Semester");
    setSubCourse("BSIT");
    setSubYear("2026-2027");
    setShowSubjectModal(true);
  };

  const handleOpenEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setSubCode(sub.code);
    setSubName(sub.name);
    setSubDesc(sub.description || "");
    setSubTeacherId(sub.teacherId);
    setSubSemester(sub.semester || "1st Semester");
    setSubCourse(sub.course || "BSIT");
    setSubYear(sub.schoolYear || "2026-2027");
    setShowSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim() || !subTeacherId) {
      showToast("Subject code, name, and assigned teacher are required.", "error");
      return;
    }
    const payload = {
      code: subCode.trim(),
      name: subName.trim(),
      description: subDesc.trim(),
      teacherId: subTeacherId,
      semester: subSemester,
      course: subCourse,
      schoolYear: subYear,
    };
    try {
      const res = editingSubject
        ? await authFetch(`/api/subjects/${editingSubject.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await authFetch("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubMsg({ type: "error", text: data?.error || "Could not save the subject. Please try again." });
        showToast(data?.error || "Could not save the subject. Please try again.", "error");
        return;
      }
      if (editingSubject) {
        setSubjects((prev) => prev.map((s) => (s.id === data.id ? data : s)));
        setSubMsg({ type: "success", text: "Subject updated successfully." });
        showToast("Subject updated successfully.");
      } else {
        setSubjects((prev) => [data, ...prev]);
        setSubMsg({ type: "success", text: "Subject created successfully." });
        showToast("Subject created successfully.");
      }
      setShowSubjectModal(false);
      fetchLogs();
    } catch {
      setSubMsg({ type: "error", text: "Could not reach the server. Please try again." });
      showToast("Could not reach the server. Please try again.", "error");
    }
  };

  const handleDeleteSubject = async (sub: Subject) => {
    if (!window.confirm(`Delete subject "${sub.code} - ${sub.name}"? Students will be removed from this subject.`)) return;
    try {
      const res = await authFetch(`/api/subjects/${sub.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error || "Could not delete this subject.", "error");
        return;
      }
      setSubjects((prev) => prev.filter((s) => s.id !== sub.id));
      fetchLogs();
      showToast("Subject deleted successfully.");
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    }
  };

  const handleOpenRoster = async (sub: Subject) => {
    setRosterSubject(sub);
    setRosterStudents([]);
    setAssignStudentIds([]);
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${sub.id}/students`);
      if (res.ok) {
        setRosterStudents(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch roster:", err);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleAssignStudents = async () => {
    if (!rosterSubject || assignStudentIds.length === 0) return;
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: assignStudentIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRosterMsg({ type: "error", text: data?.error || "Could not assign the selected students." });
        showToast(data?.error || "Could not assign the selected students.", "error");
        return;
      }
      setRosterStudents(data.students || rosterStudents);
      setAssignStudentIds([]);
      setRosterMsg({ type: "success", text: `${data.added || assignStudentIds.length} student(s) assigned.` });
      showToast(`${data.added || assignStudentIds.length} student(s) assigned.`);
      const updated = await authFetch("/api/subjects");
      if (updated.ok) setSubjects(await updated.json());
      fetchLogs();
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRosterLoading(false);
    }
  };

  const handleRemoveRosterStudent = async (studentId: string) => {
    if (!rosterSubject) return;
    if (!window.confirm("Remove this student from the subject?")) return;
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRosterStudents(data.students || rosterStudents);
        const updated = await authFetch("/api/subjects");
        if (updated.ok) setSubjects(await updated.json());
        fetchLogs();
        setRosterMsg({ type: "success", text: "Student removed from subject." });
        showToast("Student removed from subject.");
      }
    } catch {
      showToast("Could not reach the server. Please try again.", "error");
    } finally {
      setRosterLoading(false);
    }
  };

  // Audit Logs Actions
  const handleClearAuditLogs = async () => {
    if (!window.confirm("Are you sure you want to archive and clear all active audit logs?")) return;
    try {
      const res = await authFetch("/api/logs", { method: "DELETE" });
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
      logs
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

  // Settings Actions
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const timeoutMins = Number(systemSettings.sessionTimeoutMins);
    if (!Number.isFinite(timeoutMins) || timeoutMins < 5 || timeoutMins > 1440) {
      setSettingsSavedMessage(null);
      showToast("Session timeout must be between 5 and 1440 minutes.", "error");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await authFetch("/api/system/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...systemSettings, sessionTimeoutMins: timeoutMins }),
      });
      if (res.ok) {
        const saved = await res.json();
        setSystemSettings(saved);
        setSettingsSavedMessage("System configuration saved.");
        setSettingsSavedAt(new Date().toLocaleString());
        showToast("System configuration saved.");
        fetchLogs();
      } else {
        const data = await res.json().catch(() => ({}));
        setSettingsSavedMessage(null);
        showToast(data?.error || "Could not save the settings. Please try again.", "error");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      showToast("Could not save the settings. Please try again.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    setSystemSettings({
      require2FA: false,
      maintenanceMode: false,
      sessionTimeoutMins: 60,
      autoAuditArchiving: true,
    });
    showToast("Settings reset in the form. Press Save to apply them.");
  };

  const handleExportSystemBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await authFetch("/api/system/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not create the backup. Please try again.", "error");
        return;
      }
      const backupData = await res.json();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().getTime();
      a.download = `StudyLens_System_Backup_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Full database backup downloaded.");
    } catch (err) {
      console.error("Backup error:", err);
      showToast("Could not create the backup. Please try again.", "error");
    } finally {
      setBackupLoading(false);
    }
  };

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

  // Reset the user page whenever any user filter changes.
  useEffect(() => {
    setUserPage(1);
  }, [searchUser, selectedUserRoleFilter, selectedUserStatusFilter]);

  const pagedUsers = slicePage(filteredUsers, userPage);

  return (
    <div className="space-y-6">
      {!hideTabs ? (
        <>
{/* Welcome header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Welcome back, {currentUser?.name?.split(" ")[0] || "Admin"}!
              </h1>
              <p className="text-sm text-muted-foreground">
                Here's what's happening across the platform today.
              </p>
            </div>

<div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
        </>
      ) : (
        /* Standalone Nav View Toolbar */
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

      {/* TAB 1: DASHBOARD */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setDetailCard("users")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-rose-500/50 hover:shadow-xs transition-all group"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">User Accounts</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{users.length}</p>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0 relative">
                <Users className="w-6 h-6" />
                <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDetailCard("subjects")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-blue-500/50 hover:shadow-xs transition-all group"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Course Subjects</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{subjects.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0 relative">
                <BookOpen className="w-6 h-6" />
                <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate("/activity-logs")}
              className="text-left bg-card p-5 rounded-2xl border border-border shadow-2xs flex items-start justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-xs transition-all group"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Activity Events</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{logsTotal.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 relative">
                <Activity className="w-6 h-6" />
                <ChevronRight className="w-3 h-3 absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {/* Recent Activity Snippet */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
              <button
                onClick={() => navigate("/activity-logs")}
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
                  {logs.slice(0, 5).map((log, index) => (
                    <tr key={`${log.id}-${index}`} onClick={() => setSelectedLogModal(log)} className="hover:bg-muted/20 cursor-pointer">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${actionCategory(log.action).badge}`}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-foreground">{log.userName}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-xs">{log.details}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Bulletins Snippet */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Recent Institutional Bulletins</h3>
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
                      <RelativeTime iso={ann.createdAt} className="text-[11px] text-muted-foreground" />
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
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-5">
          {/* Audit Trail Toolbar & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-600" /> Activity Logs
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last update: {lastRefreshed}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => fetchLogs(logPage, LOG_PAGE_SIZE)}
                disabled={loadingLogs}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin text-rose-600" : ""}`} />
                <span>Refresh</span>
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
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5"
                title="Archive and clear the audit trail"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
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
                <option value="all">All Action Categories</option>
                {ACTION_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.codes.map((code) => (
                      <option key={code} value={code}>
                        {actionLabel(code)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Content Moderation">
                  <option value={MODERATION_FILTER}>Learning Materials Moderation</option>
                </optgroup>
              </select>
            </div>

            <div>
              <select
                value={selectedLogRoleFilter}
                onChange={(e) => setSelectedLogRoleFilter(e.target.value)}
                className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
              >
                <option value="all">All Roles (Students, Teachers, Admins)</option>
                <option value="student">Student Role</option>
                <option value="teacher">Faculty / Teacher Role</option>
                <option value="admin">Administrator Role</option>
              </select>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
                <tr>
                  <th className="p-3">Event</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Details & Scope</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                      Loading activity logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No matching activity logs found. Try adjusting search query or filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr
                      key={`${log.id}-${index}`}
                      onClick={() => setSelectedLogModal(log)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${actionCategory(log.action).badge}`}>
                          {actionLabel(log.action)}
                        </span>
                        <span className="block text-[10px] font-mono text-muted-foreground mt-0.5">{log.action}</span>
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

          <Pagination
            page={logPage}
            total={logsTotal}
            onPageChange={(p) => setLogPage(p)}
          />
        </div>
      )}

      {/* TAB 3: USER ACCOUNTS DIRECTORY */}
      {activeTab === "users" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Institutional User Directory</h3>
            </div>
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No users match the current filters.
                    </td>
                  </tr>
                ) : (
                pagedUsers.map((u, index) => (
                  <tr key={`${u.id}-${index}`} className="hover:bg-muted/20">
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
                  )))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={userPage}
            total={filteredUsers.length}
            onPageChange={(p) => setUserPage(p)}
          />
        </div>
      )}

      {/* TAB 4: SUBJECT CATALOG */}
      {activeTab === "subjects" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Subject Catalog</h3>
            </div>

            <button
              onClick={handleOpenAddSubject}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Subject & Description</th>
                  <th className="p-3">Assigned Teacher</th>
                  <th className="p-3">Semester / Course</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Materials</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No subjects yet. Click "Add Subject" to create the first course entry.
                    </td>
                  </tr>
                ) : (
                  subjects.map((sub, index) => (
                    <tr key={`${sub.id}-${index}`} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[11px] font-bold">
                          {sub.code}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-foreground">{sub.name}</p>
                        {sub.description && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-xs">{sub.description}</p>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-muted-foreground">{sub.teacherName}</td>
                      <td className="p-3 text-muted-foreground">
                        <p>{sub.semester || "1st Semester"}</p>
                        <p className="text-[11px]">{sub.course || "BSIT"} • {sub.schoolYear || "2026-2027"}</p>
                      </td>
                      <td className="p-3 font-bold text-foreground">{sub.studentCount}</td>
                      <td className="p-3 font-bold text-foreground">{sub.materialCount}</td>
                      <td className="p-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEditSubject(sub)}
                          className="p-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors cursor-pointer"
                          title="Edit Subject"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenRoster(sub)}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-colors cursor-pointer"
                          title="Manage Class Roster"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(sub)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete Subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 6: BULLETINS & ANNOUNCEMENTS (IDENTICAL TO TEACHER PROCESS) */}
      {activeTab === "announcements" && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Global Institutional Bulletins</h3>
            </div>
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
                      <RelativeTime iso={ann.createdAt} className="text-xs text-muted-foreground" />
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
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5 text-rose-600" /> System Settings & Governance
              </h3>
            </div>

            <button
              onClick={handleExportSystemBackup}
              disabled={backupLoading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{backupLoading ? "Creating Backup..." : "Download System Backup"}</span>
            </button>
          </div>

          {settingsSavedMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 font-bold flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{settingsSavedMessage}{settingsSavedAt ? ` (saved ${settingsSavedAt})` : ""}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              These settings are stored in the database and take effect immediately for the whole platform.
            </p>

            {/* Security & Authentication */}
            <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
              <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Security & Authentication</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="font-bold text-foreground">Require Multi-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-muted-foreground">Require a one-time 6-digit code after password login for faculty and administrative roles</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.require2FA}
                    onChange={(e) => setSystemSettings({ ...systemSettings, require2FA: e.target.checked })}
                    className="w-5 h-5 accent-rose-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-card border border-border rounded-xl">
                  <label className="block font-bold mb-1">Idle Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={systemSettings.sessionTimeoutMins}
                    onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeoutMins: Number(e.target.value) })}
                    className="w-full p-2.5 bg-card border border-border rounded-xl font-mono text-foreground"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">JWT sessions expire after this idle time (5–1440 minutes).</p>
                </div>
              </div>
            </div>

            {/* Maintenance & Data Retention */}
            <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-4">
              <h4 className="font-bold text-foreground text-sm flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-rose-600" />
                <span>Maintenance & Data Retention</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div>
                    <p className="font-bold text-foreground">System Maintenance Mode</p>
                    <p className="text-[11px] text-muted-foreground">Restrict all non-admin access while the platform is being updated</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemSettings.maintenanceMode}
                    onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
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
            </div>

            <div className="flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={handleResetSettings}
                className="px-4 py-2.5 border border-border text-foreground text-xs font-bold rounded-xl cursor-pointer hover:bg-muted/30 transition-colors"
              >
                Reset to Defaults
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingSettings ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: ADD USER MODAL */}
      {showAddUserModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddUserModal(false);
          }}
        >
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
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingUser(null);
          }}
        >
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

      {/* MODAL 3: ADD / EDIT SUBJECT MODAL */}
      {showSubjectModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSubjectModal(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-base font-bold text-foreground">{editingSubject ? "Edit Subject" : "Add New Subject"}</h3>
              <button
                onClick={() => setShowSubjectModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Subject Code</label>
                  <input
                    type="text"
                    required
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="e.g. CS 301"
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-mono font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="e.g. Data Structures & Algorithms"
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  placeholder="Brief description of the subject"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Assigned Teacher</label>
                <select
                  value={subTeacherId}
                  onChange={(e) => setSubTeacherId(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
                >
                  {teachers.length === 0 ? (
                    <option value="">No teacher accounts available</option>
                  ) : (
                    teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Semester</label>
                  <select
                    value={subSemester}
                    onChange={(e) => setSubSemester(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
                  >
                    {DEFAULT_SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Course Program</label>
                  <select
                    value={subCourse}
                    onChange={(e) => setSubCourse(e.target.value)}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
                  >
                    {DEFAULT_COURSES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">School Year</label>
                <input
                  type="text"
                  value={subYear}
                  onChange={(e) => setSubYear(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-mono font-medium focus:outline-none"
                />
              </div>

              {subMsg && (
                <p className={`text-xs font-bold ${subMsg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                  {subMsg.text}
                </p>
              )}

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teachers.length === 0}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {editingSubject ? "Save Changes" : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CLASS ROSTER MODAL */}
      {rosterSubject && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRosterSubject(null);
          }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Class Roster</h3>
                <p className="text-xs text-muted-foreground">
                  {rosterSubject.code} - {rosterSubject.name} • {rosterStudents.length} enrolled
                </p>
              </div>
              <button
                onClick={() => setRosterSubject(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rosterMsg && (
              <p className={`text-xs font-bold ${rosterMsg.type === "error" ? "text-rose-600" : "text-emerald-600"}`}>
                {rosterMsg.text}
              </p>
            )}

            {/* Assign students */}
            <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3">
              <p className="font-bold text-foreground text-xs">Assign Students</p>
              {users.filter((u) => u.role === "student").length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No student accounts exist to assign.</p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Search students by name, email, or ID..."
                        className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <select
                      value={assignFilter}
                      onChange={(e) => setAssignFilter(e.target.value as "all" | "enrolled" | "unenrolled")}
                      className="px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
                    >
                      <option value="all">All students</option>
                      <option value="unenrolled">Unenrolled</option>
                      <option value="enrolled">Enrolled</option>
                    </select>
                  </div>
                  {(() => {
                    const q = assignSearch.trim().toLowerCase();
                    const filteredList = users
                      .filter((u) => u.role === "student")
                      .filter((student) => {
                        const enrolled = rosterStudents.some((rs) => rs.id === student.id);
                        if (assignFilter === "enrolled" && !enrolled) return false;
                        if (assignFilter === "unenrolled" && enrolled) return false;
                        if (q) {
                          const haystack = `${student.name} ${student.email} ${student.studentId || ""}`.toLowerCase();
                          if (!haystack.includes(q)) return false;
                        }
                        return true;
                      });
                    if (filteredList.length === 0) {
                      return (
                        <p className="text-[11px] text-muted-foreground py-2">
                          No students match the current filter/search.
                        </p>
                      );
                    }
                    return (
                      <div className="max-h-40 overflow-y-auto space-y-1.5">
                        {filteredList.map((student) => {
                          const alreadyEnrolled = rosterStudents.some((rs) => rs.id === student.id);
                          const checked = assignStudentIds.includes(student.id);
                          return (
                            <label
                              key={student.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border border-border bg-card cursor-pointer ${
                                alreadyEnrolled ? "opacity-50 cursor-not-allowed" : "hover:border-rose-500/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={alreadyEnrolled}
                                onChange={(e) =>
                                  setAssignStudentIds((prev) =>
                                    e.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id)
                                  )
                                }
                                className="w-4 h-4 accent-rose-600 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-foreground flex-1">{student.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{student.studentId || student.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}
              <div className="flex items-center justify-end">
                <button
                  onClick={handleAssignStudents}
                  disabled={assignStudentIds.length === 0 || rosterLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {rosterLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Assign Selected ({assignStudentIds.length})</span>
                </button>
              </div>
            </div>

            {/* Roster table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Enrolled</th>
                    <th className="p-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {rosterStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        {rosterLoading ? "Loading roster..." : "No students enrolled yet. Use the assign list above."}
                      </td>
                    </tr>
                  ) : (
                    rosterStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-muted/20">
                        <td className="p-3 font-bold text-foreground">{student.name}</td>
                        <td className="p-3 text-muted-foreground font-mono text-[11px]">{student.email}</td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {student.dateEnrolled ? new Date(student.dateEnrolled).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRemoveRosterStudent(student.id)}
                            disabled={rosterLoading}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Remove from subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setRosterSubject(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BROADCAST ANNOUNCEMENT MODAL */}
      {showAnnounceModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAnnounceModal(false);
          }}
        >
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
                    <option value="high">High / Urgent</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low / Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Associated Course Subject</label>
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
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingAnn(null);
          }}
        >
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
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLogModal(null);
          }}
        >
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
                  <span className={`font-bold text-sm ${actionCategory(selectedLogModal.action).badge}`}>{actionLabel(selectedLogModal.action)}</span>
                  <span className="block text-[10px] font-mono text-muted-foreground">{selectedLogModal.action}</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Device</span>
                  <p className="font-semibold text-foreground text-xs mt-0.5 break-words">
                    {selectedLogModal.device || "Web Browser"}
                  </p>
                </div>
                <div className="p-3 bg-muted/20 rounded-xl border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Browser</span>
                  <p className="font-semibold text-foreground text-xs mt-0.5 break-words">
                    {selectedLogModal.browser || "Chrome/Edge"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedLogModal, null, 2));
                  showToast("Audit log JSON payload copied to clipboard!");
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

      <ConfirmDialog
        open={annToDelete !== null}
        title="Delete Bulletin"
        message='Are you sure you want to delete this announcement? This action cannot be undone.'
        confirmLabel="Yes, Delete"
        destructive
        onConfirm={confirmDeleteAnnouncement}
        onCancel={() => setAnnToDelete(null)}
      />

      <CardDetailModal
        open={detailCard === "users"}
        title="User Accounts"
        subtitle={`${users.length} registered account${users.length === 1 ? "" : "s"} in the system.`}
        onClose={() => setDetailCard(null)}
      >
        <ul className="space-y-2">
          {(["student", "teacher", "admin"] as UserRole[]).map((role) => {
            const count = users.filter((u) => u.role === role).length;
            const label = role === "student" ? "Students" : role === "teacher" ? "Teachers" : "Administrators";
            return (
              <li key={role}>
                <DetailRow
                  label={label}
                  trailing={
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      {count}
                    </span>
                  }
                  onClick={() => {
                    setDetailCard(null);
                    navigate(`/users?role=${role}`);
                  }}
                />
              </li>
            );
          })}
          <li>
            <DetailRow
              label="Suspended Accounts"
              trailing={
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
                  {users.filter((u) => u.status === "suspended").length}
                </span>
              }
              onClick={() => {
                setDetailCard(null);
                navigate("/users?status=suspended");
              }}
            />
          </li>
        </ul>
      </CardDetailModal>

      <CardDetailModal
        open={detailCard === "subjects"}
        title="Course Subjects"
        subtitle={`${subjects.length} course subject${subjects.length === 1 ? "" : "s"} in the catalog.`}
        onClose={() => setDetailCard(null)}
      >
        {subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No course subjects in the catalog yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s) => (
              <li key={s.id}>
                <DetailRow
                  label={`${s.code} — ${s.name}`}
                  sublabel={s.teacherName || [s.semester, s.course].filter(Boolean).join(" • ")}
                  trailing={
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {s.studentCount ?? 0} student{(s.studentCount ?? 0) === 1 ? "" : "s"}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
                        {s.materialCount ?? 0} material{(s.materialCount ?? 0) === 1 ? "" : "s"}
                      </span>
                    </span>
                  }
                  onClick={() => {
                    setDetailCard(null);
                    navigate(`/subjects/${s.id}`);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardDetailModal>

    </div>
  );
};
