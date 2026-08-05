import React from "react";
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
  GraduationCap,
  BookCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, switchRole } = useAuth();
  const role = currentUser?.role || "student";

  const studentNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "materials", label: "Learning Materials", icon: BookOpen },
    { id: "ai-assistant", label: "AI Study Generator", icon: Sparkles },
    { id: "assessments", label: "Take Quizzes & Tests", icon: CheckSquare },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "analytics", label: "Adaptive Progress", icon: TrendingUp },
    { id: "announcements", label: "Announcements", icon: Bell },
  ];

  const teacherNavItems = [
    { id: "dashboard", label: "Teacher Dashboard", icon: LayoutDashboard },
    { id: "subjects", label: "Manage Subjects", icon: FolderKanban },
    { id: "materials", label: "Upload & Manage Materials", icon: BookOpen },
    { id: "ai-assistant", label: "AI Resource Creator", icon: Sparkles },
    { id: "assessments", label: "Assessment Management", icon: BookCheck },
    { id: "analytics", label: "Student Progress Monitoring", icon: TrendingUp },
    { id: "announcements", label: "Class Announcements", icon: Bell },
  ];

  const adminNavItems = [
    { id: "dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
    { id: "users", label: "User Management", icon: Users },
    { id: "subjects", label: "Subject Catalog", icon: FolderKanban },
    { id: "announcements", label: "System Announcements", icon: Bell },
    { id: "activity-logs", label: "Audit Activity Logs", icon: Activity },
  ];

  const navItems = role === "admin" ? adminNavItems : role === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 border-r border-slate-800 shadow-xl select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-md text-white">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-tight leading-none">StudyLens AI</h1>
          <p className="text-[11px] text-blue-400 font-medium mt-1">Adaptive Learning Platform</p>
        </div>
      </div>

      {/* Role Switcher Pill */}
      <div className="p-3 mx-3 my-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 mb-1.5 px-1 flex items-center justify-between">
          <span>Active View Role</span>
          <span className="text-blue-400 font-mono text-[9px] uppercase">{role}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
          {(["student", "teacher", "admin"] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                switchRole(r);
                setActiveTab("dashboard");
              }}
              className={`py-1 text-[11px] font-medium rounded-md capitalize transition-all ${
                role === r
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
          {role} Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600/90 text-white shadow-sm ring-1 ring-blue-500/50"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile Card Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow">
          {currentUser?.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">{currentUser?.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
        </div>
      </div>
    </aside>
  );
};
