import React, { useState, useCallback, useRef, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Layers, LayoutDashboard, BookOpen, CheckSquare, TrendingUp, FolderKanban, Users, Bell, Activity, BookCheck, FileText, Settings, Sparkles } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { clearWorkspace } from "./utils/aiWorkspaceCache";
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
import { AnnouncementsView } from "./pages/AnnouncementsView";
import { RequireAuth, RequireRole, elementForRole } from "./router/guards";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import type { LearningMaterial } from "./types";

const UserManagementView: React.FC = () => {
  return <AdminDashboard defaultTab="users" hideTabs={true} />;
};

const ActivityLogsView: React.FC = () => {
  return <AdminDashboard defaultTab="logs" hideTabs={true} />;
};

const SystemSettingsView: React.FC = () => {
  return <AdminDashboard defaultTab="settings" hideTabs={true} />;
};

export const MainAppContent: React.FC = () => {
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


  const { timeoutWarn, timeoutSeconds, resetIdle, doForceLogout } = useIdleTimeout();

  useEffect(() => {
    if (currentUser?.id) {
      if (prevUserIdRef.current !== currentUser.id) {
        prevUserIdRef.current = currentUser.id;
        // Role switches must not leak cross-role context (e.g. a student's
        // weak-topic AI seed or material hand-off) into the next session view.
        setAiSeedTopic(null);
        setSelectedMaterial(null);
        const role = currentUser.role || "student";
        navigate(elementForRole(role), { replace: true });
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
      dashboard: elementForRole(role),
      materials: "/materials",
      "ai-assistant": "/ai-assistant",
      assessments: "/assessments",
      flashcards: "/flashcards",
      analytics: "/analytics",
      profile: "/profile",
      subjects: "/subjects",
      announcements: "/announcements",
      reports: "/reports",
      users: role === "admin" ? "/users" : elementForRole(role),
      "activity-logs": role === "admin" ? "/activity-logs" : elementForRole(role),
    };
    const targetPath = tabToPathMap[tab] || elementForRole(role);
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
        <Route path="/" element={<Navigate to={elementForRole(role)} replace />} />

        {/* Dashboards */}
        <Route
          path="/student/dashboard"
          element={<RequireRole roles={["student"]}><StudentDashboard onNavigate={handleTabNavigate} onOpenWeakTopic={handleOpenWeakTopic} /></RequireRole>}
        />
        <Route
          path="/teacher/dashboard"
          element={<RequireRole roles={["teacher"]}><TeacherDashboard onNavigate={handleTabNavigate} /></RequireRole>}
        />
        <Route
          path="/admin/dashboard"
          element={<RequireRole roles={["admin"]}><AdminDashboard defaultTab="overview" /></RequireRole>}
        />

        {/* Admin-only Management Views */}
        <Route path="/users" element={<RequireRole roles={["admin"]}><UserManagementView /></RequireRole>} />
        <Route path="/activity-logs" element={<RequireRole roles={["admin"]}><ActivityLogsView /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole roles={["admin"]}><SystemSettingsView /></RequireRole>} />

        {/* Teacher & Admin Views */}
        <Route path="/subjects" element={<RequireRole roles={["student", "teacher", "admin"]}><SubjectsPage /></RequireRole>} />
        <Route path="/subjects/:subjectId" element={<RequireRole roles={["student", "teacher", "admin"]}><SubjectDetailPage /></RequireRole>} />

        {/* General Authorized Routes */}
        <Route path="/materials" element={<RequireAuth><LearningMaterialsPage onGenerateResource={handleGenerateFromMaterial} onNavigate={handleTabNavigate} /></RequireAuth>} />
        <Route path="/ai-assistant" element={<RequireAuth><AIStudyAssistantPage initialMaterial={selectedMaterial} initialTopic={aiSeedTopic} onSeedConsumed={() => setAiSeedTopic(null)} /></RequireAuth>} />
        <Route path="/assessments" element={<RequireAuth><AssessmentPage onNavigate={handleTabNavigate} /></RequireAuth>} />
        <Route path="/flashcards" element={<RequireAuth><FlashcardsPage onNavigate={handleTabNavigate} /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth>{role === "teacher" ? <TeacherAnalyticsPage /> : role === "admin" ? <Navigate to="/reports" replace /> : <ProgressAnalyticsPage onOpenWeakTopic={handleOpenWeakTopic} />}</RequireAuth>} />
        <Route path="/reports" element={<RequireRole roles={["teacher", "admin"]}><ReportsPage /></RequireRole>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/announcements" element={<RequireAuth><AnnouncementsView /></RequireAuth>} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to={elementForRole(role)} replace />} />
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
                className="flex-1 px-4 py-2.5 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
