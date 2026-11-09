import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  Layers,
  TrendingUp,
  FolderKanban,
  Users,
  Bell,
  Activity,
  BookCheck,
  Plus,
  Trash2,
  X,
  GraduationCap,
  Pencil,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AnnouncementsProvider, useAnnouncements, type AnnouncementItem } from "./context/AnnouncementsContext";
import { ToastProvider } from "./context/ToastContext";
import { useToast } from "./context/ToastContext";
import { authFetch, getStoredToken } from "./utils/authFetch";
import { clearWorkspace } from "./utils/aiWorkspaceCache";
import { RelativeTime } from "./utils/time";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AnnouncementComposer } from "./components/AnnouncementComposer";
import { DashboardLayout, type MenuItem } from "./components/DashboardLayout";
import { StudentDashboard } from "./pages/dashboards/StudentDashboard";
import { TeacherDashboard } from "./pages/dashboards/TeacherDashboard";
import { AdminDashboard } from "./pages/dashboards/AdminDashboard";
import { LearningMaterialsPage } from "./pages/learning/LearningMaterialsPage";
import { AIStudyAssistantPage } from "./pages/ai/AIStudyAssistantPage";
import { AssessmentPage } from "./pages/learning/AssessmentPage";
import { FlashcardsPage } from "./pages/learning/FlashcardsPage";
import { ProgressAnalyticsPage } from "./pages/analytics/ProgressAnalyticsPage";
import { TeacherAnalyticsPage } from "./pages/analytics/TeacherAnalyticsPage";
import { SubjectsPage } from "./pages/learning/SubjectsPage";
import { SubjectDetailPage } from "./pages/learning/SubjectDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LandingPage } from "./pages/landing/LandingPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import type { LearningMaterial, Subject } from "./types";

const AnnouncementsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { announcements, deleteAnnouncement } = useAnnouncements();
  const { showToast } = useToast();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Post/Edit Announcement Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [annToDelete, setAnnToDelete] = useState<string | null>(null);

  // Selected Announcement Detail Modal
  const [detailItem, setDetailItem] = useState<AnnouncementItem | null>(null);
  const [dismissedTargetId, setDismissedTargetId] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetId = queryParams.get("id");

  // Fetch Subjects for Dropdown
  useEffect(() => {
    authFetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubjects(data);
      })
      .catch(() => {});
  }, []);

  // Open detail if targetId query param is present
  useEffect(() => {
    if (targetId && targetId !== dismissedTargetId && detailItem?.id !== targetId) {
      const found = announcements.find((a) => a.id === targetId);
      if (found) {
        const timer = setTimeout(() => {
          setDetailItem(found);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [targetId, dismissedTargetId, announcements, detailItem]);

  const handleCloseDetail = () => {
    if (targetId) {
      setDismissedTargetId(targetId);
    }
    setDetailItem(null);
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("id")) {
      searchParams.delete("id");
      const searchStr = searchParams.toString();
      navigate(`${location.pathname}${searchStr ? `?${searchStr}` : ""}`, { replace: true });
    }
  };

  const openEditAnnouncement = (ann: AnnouncementItem) => {
    setEditingAnn(ann);
    setShowPostModal(true);
  };

  const isTeacherOrAdmin = currentUser?.role === "teacher" || currentUser?.role === "admin";
  // Only the author can edit/delete an announcement; teacher/admin cannot manage
  // the other role's posts (enforced on both the client and the server).
  const isAnnouncementAuthor = (ann: AnnouncementItem) =>
    !!currentUser?.id && currentUser.id === ann.authorId;

  const filtered = announcements.filter((a) => {
    if (selectedSubjectFilter !== "all" && a.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} - {sub.name}
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-1 p-1 bg-muted/50 rounded-xl border border-border text-xs">
            <button
              onClick={() => setSelectedSubjectFilter("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedSubjectFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({announcements.length})
            </button>
          </div>

          {isTeacherOrAdmin && (
            <button
              onClick={() => {
                setEditingAnn(null);
                setShowPostModal(true);
              }}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-2xl">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">No announcements found</p>
            <p className="text-xs text-muted-foreground">No announcements posted yet.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isTargeted = targetId === item.id;
            return (
              <div
                key={item.id}
                id={`announcement-${item.id}`}
                onClick={() => {
                  setDetailItem(item);
                }}
                className={`p-5 rounded-2xl border transition-all space-y-3 cursor-pointer group ${
                  isTargeted
                    ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30 shadow-md"
                    : "bg-card border-border hover:border-primary/50 opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/30">
                  <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                        item.priority === "high"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : item.priority === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {item.tag || item.priority.toUpperCase()}
                    </span>
                    {item.subjectName && (
                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {item.subjectName}
                      </span>
                    )}
                    {isTargeted && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <RelativeTime iso={item.createdAt} className="text-xs text-muted-foreground" />
                    {isAnnouncementAuthor(item) && (
                      <>
                        <button
                          onClick={() => openEditAnnouncement(item)}
                          className="p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                          title="Edit Announcement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAnnToDelete(item.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.content}</p>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Posted by <strong className="text-foreground">{item.authorName}</strong></span>
                  <span className="capitalize text-[11px]">Audience: {item.targetAudience}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnnouncementComposer
        open={showPostModal}
        onClose={() => { setShowPostModal(false); setEditingAnn(null); }}
        editingAnn={editingAnn}
      />

      {/* ANNOUNCEMENT DETAIL VIEW MODAL */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-card border border-border p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                    {detailItem.tag || detailItem.priority.toUpperCase()}
                  </span>
                  {detailItem.subjectName && (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {detailItem.subjectName}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground capitalize">
                    Audience: {detailItem.targetAudience}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-foreground leading-snug">{detailItem.title}</h2>
              </div>

              <button
                onClick={handleCloseDetail}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Author and Date Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{detailItem.authorName}</p>
                  <p className="text-[10px] text-muted-foreground">Course Announcement Author</p>
                </div>
              </div>
              <RelativeTime iso={detailItem.createdAt} className="font-medium text-foreground" />
            </div>

            {/* Content Body */}
            <div className="bg-muted/20 p-4 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {detailItem.content}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={handleCloseDetail}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={annToDelete !== null}
        title="Delete Announcement?"
        message="This announcement will be permanently removed for everyone. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (annToDelete) {
            deleteAnnouncement(annToDelete);
            showToast("Announcement deleted.");
          }
          setAnnToDelete(null);
        }}
        onCancel={() => setAnnToDelete(null)}
      />
    </div>
  );
};

const UserManagementView: React.FC = () => {
  return <AdminDashboard defaultTab="users" hideTabs={true} />;
};

const ActivityLogsView: React.FC = () => {
  return <AdminDashboard defaultTab="logs" hideTabs={true} />;
};

const SystemSettingsView: React.FC = () => {
  return <AdminDashboard defaultTab="settings" hideTabs={true} />;
};

interface RoleGuardProps {
  allowedRoles: ("student" | "teacher" | "admin")[];
  userRole: "student" | "teacher" | "admin";
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, userRole, children }) => {
  if (!allowedRoles.includes(userRole)) {
    const defaultPath =
      userRole === "admin"
        ? "/admin/dashboard"
        : userRole === "teacher"
        ? "/teacher/dashboard"
        : "/student/dashboard";
    return <Navigate to={defaultPath} replace />;
  }
  return <>{children}</>;
};

const MainAppContent: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterial | null>(null);
  const [aiSeedTopic, setAiSeedTopic] = useState<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  // Re-clicking the sidebar item for the page you are already on is a no-op in
  // react-router: the path is unchanged, so the route element stays mounted and
  // its fetch effects never re-run. Bumping this counter and keying <Routes>
  // with it remounts the current page, which re-runs its fetches and clears
  // per-page state (active deck, card index, filters, pagination, modals).
  const [refreshKey, setRefreshKey] = useState(0);
  const handleNavigateActive = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Idle session timeout (web only). Reads sessionTimeoutMins from system
  // settings, resets on user activity, and force-signs-out after the grace
  // countdown. A JWT-expiry watchdog catches tokens that have already lapsed.
  const [timeoutWarn, setTimeoutWarn] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number | null>(null);
  const timeoutMinsRef = useRef(60);
  const idleTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const doForceLogout = useCallback(() => {
    clearWorkspace(currentUser?.id || "");
    logout();
    navigate("/", { replace: true });
  }, [currentUser?.id, logout, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    timeoutMinsRef.current = 60;
    authFetch("/api/system/settings")
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((s: { sessionTimeoutMins?: string | number } | null) => {
        const v = Number(s?.sessionTimeoutMins);
        if (v >= 5 && v <= 1440) timeoutMinsRef.current = v;
      })
      .catch(() => {});
  }, [currentUser]);

  const resetIdle = useCallback(() => {
    if (!currentUser) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    countdownRef.current = null;
    setTimeoutWarn(false);
    setTimeoutSeconds(null);
    const mins = Math.max(5, timeoutMinsRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setTimeoutWarn(true);
      let remaining = 60;
      setTimeoutSeconds(remaining);
      countdownRef.current = window.setInterval(() => {
        remaining -= 1;
        setTimeoutSeconds(Math.max(remaining, 0));
        if (remaining <= 0) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          countdownRef.current = null;
          setTimeoutWarn(false);
          doForceLogout();
        }
      }, 1000);
    }, mins * 60 * 1000);
  }, [currentUser, doForceLogout]);

  useEffect(() => {
    if (!currentUser) return;
    resetIdle();
    const discrete: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];
    const onDiscrete = () => resetIdle();
    let lastMoveReset = 0;
    const onMove = () => {
      const now = Date.now();
      if (now - lastMoveReset > 10000) {
        lastMoveReset = now;
        resetIdle();
      }
    };
    discrete.forEach((e) => window.addEventListener(e, onDiscrete, { passive: true }));
    window.addEventListener("pointermove", onMove, { passive: true });
const jwtPoll = window.setInterval(() => {
      const token = getStoredToken();
      if (!token) return;
      try {
        const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(b64));
        if (typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now()) {
          // Belt-and-suspenders: token already expired → hard sign-out.
          doForceLogout();
        }
      } catch {
        // Malformed token — the API layer will still reject requests.
      }
    }, 30000);
    return () => {
      discrete.forEach((e) => window.removeEventListener(e, onDiscrete));
      window.removeEventListener("pointermove", onMove);
      window.clearInterval(jwtPoll);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [currentUser, resetIdle, doForceLogout]);

  const getRoleDefaultPath = (r: "student" | "teacher" | "admin") => {
    if (r === "admin") return "/admin/dashboard";
    if (r === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
  };

  useEffect(() => {
    if (currentUser?.id) {
      if (prevUserIdRef.current !== currentUser.id) {
        prevUserIdRef.current = currentUser.id;
        // Role switches must not leak cross-role context (e.g. a student's
        // weak-topic AI seed or material hand-off) into the next session view.
        setAiSeedTopic(null);
        setSelectedMaterial(null);
        const role = currentUser.role || "student";
        navigate(getRoleDefaultPath(role), { replace: true });
      }
    } else {
      prevUserIdRef.current = null;
    }
  }, [currentUser?.id, currentUser?.role, navigate]);

  if (!currentUser) {
    return <LandingPage />;
  }

  const role = currentUser.role || "student";

  const userRoleDisplay: "Student" | "Teacher" | "Administrator" =
    role === "admin"
      ? "Administrator"
      : role === "teacher"
      ? "Teacher"
      : "Student";

  const studentMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/student/dashboard" },
    { icon: FolderKanban, label: "My Subjects", path: "/subjects" },
    { icon: BookOpen, label: "Learning Materials", path: "/materials" },
    { icon: Sparkles, label: "AI Study Assistant", path: "/ai-assistant" },
    { icon: CheckSquare, label: "Quizzes & Tests", path: "/assessments" },
    { icon: Layers, label: "Flashcards", path: "/flashcards" },
    { icon: TrendingUp, label: "Adaptive Progress", path: "/analytics" },
    { icon: Bell, label: "Announcements", path: "/announcements" },
  ];

  const teacherMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Teacher Dashboard", path: "/teacher/dashboard" },
    { icon: FolderKanban, label: "Manage Subjects", path: "/subjects" },
    { icon: BookOpen, label: "Upload & Manage Materials", path: "/materials" },
    { icon: Layers, label: "Resource Creator", path: "/ai-assistant" },
    { icon: BookCheck, label: "Assessment Management", path: "/assessments" },
    { icon: Layers, label: "Flashcards", path: "/flashcards" },
    { icon: TrendingUp, label: "Student Progress Monitoring", path: "/analytics" },
    { icon: FileText, label: "Reports & Analytics", path: "/reports" },
    { icon: Bell, label: "Class Announcements", path: "/announcements" },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Admin Dashboard", path: "/admin/dashboard" },
    { icon: Users, label: "User Management", path: "/users" },
    { icon: FolderKanban, label: "Subject Catalog", path: "/subjects" },
    { icon: FileText, label: "Reports & Analytics", path: "/reports" },
    { icon: Bell, label: "System Announcements", path: "/announcements" },
    { icon: Activity, label: "Audit Activity Logs", path: "/activity-logs" },
    { icon: Settings, label: "System Settings", path: "/admin/settings" },
  ];

  const menuItems =
    role === "admin"
      ? adminMenuItems
      : role === "teacher"
      ? teacherMenuItems
      : studentMenuItems;

  const handleTabNavigate = (tab: string, options?: { mode?: string }) => {
    const tabToPathMap: Record<string, string> = {
      dashboard: getRoleDefaultPath(role),
      materials: "/materials",
      "ai-assistant": "/ai-assistant",
      assessments: "/assessments",
      flashcards: "/flashcards",
      analytics: "/analytics",
      profile: "/profile",
      subjects: "/subjects",
      announcements: "/announcements",
      reports: "/reports",
      users: role === "admin" ? "/users" : getRoleDefaultPath(role),
      "activity-logs": role === "admin" ? "/activity-logs" : getRoleDefaultPath(role),
    };
    const targetPath = tabToPathMap[tab] || getRoleDefaultPath(role);
    const destination =
      options?.mode && tab === "ai-assistant" ? `${targetPath}?mode=${encodeURIComponent(options.mode)}` : targetPath;
    // Dashboard quick-action buttons reach the same pages as the sidebar but
    // bypass it, so they need the same re-click refresh. Compare on pathname
    // only: a path with a query string is still the same page.
    if (location.pathname === targetPath && !options?.mode) {
      handleNavigateActive();
      return;
    }
    navigate(destination);
  };

  const handleGenerateFromMaterial = (material: LearningMaterial) => {
    setSelectedMaterial(material);
    navigate("/ai-assistant");
  };

  const handleOpenWeakTopic = (topic: string) => {
    setAiSeedTopic(topic);
    navigate("/ai-assistant");
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      userRole={userRoleDisplay}
      userName={currentUser.name}
      activePath={location.pathname}
      onNavigateActive={handleNavigateActive}
      onLogout={() => {
        clearWorkspace(currentUser.id);
        logout();
        navigate("/", { replace: true });
      }}
    >
      <Routes key={refreshKey}>
        <Route path="/" element={<Navigate to={getRoleDefaultPath(role)} replace />} />

        {/* Dashboards */}
        <Route
          path="/student/dashboard"
          element={
            <RoleGuard allowedRoles={["student"]} userRole={role}>
              <StudentDashboard onNavigate={handleTabNavigate} onOpenWeakTopic={handleOpenWeakTopic} />
            </RoleGuard>
          }
        />
        <Route
          path="/teacher/dashboard"
          element={
            <RoleGuard allowedRoles={["teacher"]} userRole={role}>
              <TeacherDashboard onNavigate={handleTabNavigate} />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RoleGuard allowedRoles={["admin"]} userRole={role}>
              <AdminDashboard defaultTab="overview" />
            </RoleGuard>
          }
        />

        {/* Admin-only Management Views */}
        <Route
          path="/users"
          element={
            <RoleGuard allowedRoles={["admin"]} userRole={role}>
              <UserManagementView />
            </RoleGuard>
          }
        />
        <Route
          path="/activity-logs"
          element={
            <RoleGuard allowedRoles={["admin"]} userRole={role}>
              <ActivityLogsView />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RoleGuard allowedRoles={["admin"]} userRole={role}>
              <SystemSettingsView />
            </RoleGuard>
          }
        />

        {/* Teacher & Admin Views */}
        <Route
          path="/subjects"
          element={
            <RoleGuard allowedRoles={["student", "teacher", "admin"]} userRole={role}>
              <SubjectsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/subjects/:subjectId"
          element={
            <RoleGuard allowedRoles={["student", "teacher", "admin"]} userRole={role}>
              <SubjectDetailPage />
            </RoleGuard>
          }
        />

        {/* General Authorized Routes */}
        <Route path="/materials" element={<LearningMaterialsPage onGenerateResource={handleGenerateFromMaterial} onNavigate={handleTabNavigate} />} />
        <Route path="/ai-assistant" element={<AIStudyAssistantPage initialMaterial={selectedMaterial} initialTopic={aiSeedTopic} onSeedConsumed={() => setAiSeedTopic(null)} />} />
        <Route path="/assessments" element={<AssessmentPage onNavigate={handleTabNavigate} />} />
        <Route path="/flashcards" element={<FlashcardsPage onNavigate={handleTabNavigate} />} />
        <Route
          path="/analytics"
          element={
            role === "teacher" ? (
              <TeacherAnalyticsPage />
            ) : role === "admin" ? (
              <Navigate to="/reports" replace />
            ) : (
              <ProgressAnalyticsPage onOpenWeakTopic={handleOpenWeakTopic} />
            )
          }
        />
        <Route
          path="/reports"
          element={
            <RoleGuard allowedRoles={["teacher", "admin"]} userRole={role}>
              <ReportsPage />
            </RoleGuard>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/announcements" element={<AnnouncementsView />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to={getRoleDefaultPath(role)} replace />} />
      </Routes>

      {timeoutWarn && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer">
          <div
            className="bg-card border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center animate-in zoom-in-95 fade-in">
              <Layers className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Your session is about to end</h2>
            <p className="text-sm text-muted-foreground">
              You've been inactive. Your session will expire in{" "}
              <strong className="text-foreground">{timeoutSeconds}</strong> seconds.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => resetIdle()}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                onClick={doForceLogout}
                className="flex-1 px-4 py-2.5 bg-muted text-foreground hover:bg-muted/70 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AnnouncementsProvider>
        <ToastProvider>
          <BrowserRouter>
            <MainAppContent />
          </BrowserRouter>
        </ToastProvider>
      </AnnouncementsProvider>
    </AuthProvider>
  );
}

export default App;
