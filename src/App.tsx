import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Sparkles,
  CheckSquare,
  Layers,
  TrendingUp,
  FolderKanban,
  Users,
  Bell,
  Activity,
  BookCheck,
  CheckCircle2,
  CheckCheck,
  Circle,
  Plus,
  Trash2,
  X,
  Megaphone,
  GraduationCap,
  Eye,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AnnouncementsProvider, useAnnouncements, type AnnouncementItem } from "./context/AnnouncementsContext";
import { DashboardLayout, type MenuItem } from "./components/DashboardLayout";
import { StudentDashboard } from "./pages/dashboards/StudentDashboard";
import { TeacherDashboard } from "./pages/dashboards/TeacherDashboard";
import { AdminDashboard } from "./pages/dashboards/AdminDashboard";
import { LearningMaterialsPage } from "./pages/learning/LearningMaterialsPage";
import { AIStudyAssistantPage } from "./pages/ai/AIStudyAssistantPage";
import { AssessmentPage } from "./pages/learning/AssessmentPage";
import { FlashcardsPage } from "./pages/learning/FlashcardsPage";
import { ProgressAnalyticsPage } from "./pages/analytics/ProgressAnalyticsPage";
import { SubjectsPage } from "./pages/learning/SubjectsPage";
import { LandingPage } from "./pages/landing/LandingPage";
import type { LearningMaterial, Subject } from "./types";

const AnnouncementsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { announcements, unreadCount, markAsRead, markAsUnread, markAllAsRead, addAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Post Announcement Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all" | "students" | "teachers">("all");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  // Selected Announcement Detail Modal
  const [detailItem, setDetailItem] = useState<AnnouncementItem | null>(null);
  const [dismissedTargetId, setDismissedTargetId] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetId = queryParams.get("id");

  // Fetch Subjects for Dropdown
  useEffect(() => {
    fetch("/api/subjects")
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
          markAsRead(found.id);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [targetId, dismissedTargetId, announcements, detailItem, markAsRead]);

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

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const selectedSub = subjects.find((s) => s.id === subjectId);
    const subName = selectedSub ? `${selectedSub.code} - ${selectedSub.name}` : undefined;

    addAnnouncement({
      title: title.trim(),
      content: content.trim(),
      authorName: currentUser?.name || "Faculty Instructor",
      targetAudience,
      priority,
      subjectId: selectedSub ? selectedSub.id : undefined,
      subjectName: subName,
      tag: selectedSub ? selectedSub.code : priority === "high" ? "Urgent" : "Notice",
    });

    setTitle("");
    setContent("");
    setSubjectId("");
    setShowPostModal(false);
  };

  const isTeacherOrAdmin = currentUser?.role === "teacher" || currentUser?.role === "admin";

  const filtered = announcements.filter((a) => {
    if (filter === "unread" && a.isRead) return false;
    if (selectedSubjectFilter !== "all" && a.subjectId !== selectedSubjectFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Announcements & Bulletins</h2>
            <p className="text-xs text-muted-foreground">Stay updated with course announcements, academic notices, and exam dates</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({announcements.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === "unread" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          {isTeacherOrAdmin && (
            <button
              onClick={() => setShowPostModal(true)}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer ml-auto"
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
            <p className="text-xs text-muted-foreground">
              {filter === "unread" ? "All announcements have been marked as read!" : "No announcements posted yet."}
            </p>
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
                  if (!item.isRead) markAsRead(item.id);
                }}
                className={`p-5 rounded-2xl border transition-all space-y-3 cursor-pointer group ${
                  isTargeted
                    ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30 shadow-md"
                    : !item.isRead
                    ? "bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50 shadow-xs"
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
                    {!item.isRead && !isTargeted && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                        New
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground font-mono">{item.createdAt}</span>
                    <button
                      onClick={() => (item.isRead ? markAsUnread(item.id) : markAsRead(item.id))}
                      className={`p-1.5 rounded-lg border transition-all flex items-center space-x-1 text-xs font-semibold cursor-pointer ${
                        item.isRead
                          ? "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                          : "bg-blue-600/10 border-blue-500/30 text-blue-600 hover:bg-blue-600 hover:text-white"
                      }`}
                      title={item.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {item.isRead ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="hidden sm:inline">Read</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Mark Read</span>
                        </>
                      )}
                    </button>
                    {isTeacherOrAdmin && (
                      <button
                        onClick={() => deleteAnnouncement(item.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                    <span>{item.title}</span>
                    <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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

      {/* CREATE ANNOUNCEMENT MODAL */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handlePostAnnouncement}
            className="bg-card border border-border p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Post Subject / Course Announcement</h3>
                  <p className="text-xs text-muted-foreground">Broadcast updates to enrolled students and staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm Coverage & Lab Submission Deadline"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Associated Course Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">General Announcement (All Subjects)</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as "all" | "students" | "teachers")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Everyone (All Roles)</option>
                    <option value="students">Enrolled Students Only</option>
                    <option value="teachers">Faculty Instructors Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="high">High (Urgent Notice)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="low">Low (General Info)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Full Announcement Message</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Provide complete details regarding the examination, lecture schedule, or project assignment..."
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Publish Announcement</span>
              </button>
            </div>
          </form>
        </div>
      )}

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
              <span className="font-medium text-foreground">{detailItem.createdAt}</span>
            </div>

            {/* Content Body */}
            <div className="bg-muted/20 p-4 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {detailItem.content}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={() => {
                  if (detailItem.isRead) {
                    markAsUnread(detailItem.id);
                    setDetailItem({ ...detailItem, isRead: false });
                  } else {
                    markAsRead(detailItem.id);
                    setDetailItem({ ...detailItem, isRead: true });
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  detailItem.isRead
                    ? "bg-muted text-muted-foreground hover:text-foreground"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {detailItem.isRead ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5" />}
                <span>{detailItem.isRead ? "Marked as Read" : "Mark as Read"}</span>
              </button>

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
    </div>
  );
};

const UserManagementView: React.FC = () => {
  return <AdminDashboard defaultTab="users" hideTabs={true} />;
};

const ActivityLogsView: React.FC = () => {
  return <AdminDashboard defaultTab="logs" hideTabs={true} />;
};

const MainAppContent: React.FC = () => {
  const { currentUser, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterial | null>(null);

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
    { icon: BookOpen, label: "Learning Materials", path: "/materials" },
    { icon: Sparkles, label: "AI Study Generator", path: "/ai-assistant", badge: "AI" },
    { icon: CheckSquare, label: "Take Quizzes & Tests", path: "/assessments" },
    { icon: Layers, label: "Flashcards", path: "/flashcards" },
    { icon: TrendingUp, label: "Adaptive Progress", path: "/analytics" },
    { icon: Bell, label: "Announcements", path: "/announcements" },
  ];

  const teacherMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Teacher Dashboard", path: "/teacher/dashboard" },
    { icon: FolderKanban, label: "Manage Subjects", path: "/subjects" },
    { icon: BookOpen, label: "Upload & Manage Materials", path: "/materials" },
    { icon: Sparkles, label: "AI Resource Creator", path: "/ai-assistant", badge: "AI" },
    { icon: BookCheck, label: "Assessment Management", path: "/assessments" },
    { icon: TrendingUp, label: "Student Progress Monitoring", path: "/analytics" },
    { icon: Bell, label: "Class Announcements", path: "/announcements" },
  ];

  const adminMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Admin Dashboard", path: "/admin/dashboard" },
    { icon: Users, label: "User Management", path: "/users" },
    { icon: FolderKanban, label: "Subject Catalog", path: "/subjects" },
    { icon: Bell, label: "System Announcements", path: "/announcements" },
    { icon: Activity, label: "Audit Activity Logs", path: "/activity-logs" },
  ];

  const menuItems =
    role === "admin"
      ? adminMenuItems
      : role === "teacher"
      ? teacherMenuItems
      : studentMenuItems;

  const handleTabNavigate = (tab: string) => {
    const tabToPathMap: Record<string, string> = {
      dashboard: role === "admin" ? "/admin/dashboard" : role === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
      materials: "/materials",
      "ai-assistant": "/ai-assistant",
      assessments: "/assessments",
      flashcards: "/flashcards",
      analytics: "/analytics",
      subjects: "/subjects",
      announcements: "/announcements",
      users: "/users",
      "activity-logs": "/activity-logs",
    };
    const targetPath = tabToPathMap[tab] || "/student/dashboard";
    navigate(targetPath);
  };

  const handleGenerateFromMaterial = (material: LearningMaterial) => {
    setSelectedMaterial(material);
    navigate("/ai-assistant");
  };

  const getRoleDefaultPath = (r: "student" | "teacher" | "admin") => {
    if (r === "admin") return "/admin/dashboard";
    if (r === "teacher") return "/teacher/dashboard";
    return "/student/dashboard";
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      userRole={userRoleDisplay}
      userName={currentUser.name}
      activePath={location.pathname}
      onRoleSwitch={(r) => {
        switchRole(r);
        navigate(getRoleDefaultPath(r));
      }}
      onLogout={() => {
        logout();
      }}
    >
      <Routes>
        <Route path="/" element={<Navigate to={getRoleDefaultPath(role)} replace />} />
        <Route path="/student/dashboard" element={<StudentDashboard onNavigate={handleTabNavigate} />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard onNavigate={handleTabNavigate} />} />
        <Route path="/admin/dashboard" element={<AdminDashboard defaultTab="overview" />} />
        <Route path="/materials" element={<LearningMaterialsPage onGenerateResource={handleGenerateFromMaterial} onNavigate={handleTabNavigate} />} />
        <Route path="/ai-assistant" element={<AIStudyAssistantPage initialMaterial={selectedMaterial} />} />
        <Route path="/assessments" element={<AssessmentPage onNavigate={handleTabNavigate} />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/analytics" element={<ProgressAnalyticsPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/announcements" element={<AnnouncementsView />} />
        <Route path="/users" element={<UserManagementView />} />
        <Route path="/activity-logs" element={<ActivityLogsView />} />
        <Route path="*" element={<Navigate to={getRoleDefaultPath(role)} replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AnnouncementsProvider>
        <BrowserRouter>
          <MainAppContent />
        </BrowserRouter>
      </AnnouncementsProvider>
    </AuthProvider>
  );
}

export default App;
