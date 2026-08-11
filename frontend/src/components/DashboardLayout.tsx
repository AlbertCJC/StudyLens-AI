import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu, X, Bell, LogOut, ChevronRight,
  ShieldCheck, GraduationCap, UserCheck, ArrowLeftRight, User, CheckCheck
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { DarkModeToggle } from "./DarkModeToggle";
import { useAnnouncements } from "../context/AnnouncementsContext";
import { useAuth } from "../context/AuthContext";
import { UserProfileModal } from "./UserProfileModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  userRole: "Student" | "Teacher" | "Administrator";
  userName: string;
  activePath?: string;
  onRoleSwitch?: (role: "student" | "teacher" | "admin") => void;
  onLogout?: () => void;
}

declare global {
  interface Window {
    __openProfileModal?: () => void;
  }
}

export function DashboardLayout({
  children,
  menuItems,
  userRole,
  userName,
  activePath,
  onRoleSwitch,
  onLogout,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    window.__openProfileModal = () => setShowProfileModal(true);
    return () => {
      delete window.__openProfileModal;
    };
  }, []);

  const { announcements, unreadCount, markAsRead, markAllAsRead } = useAnnouncements();

  const currentPath = activePath || location.pathname;

  // Determine dynamic page title
  const activeMenuItem = menuItems.find(
    (item) => currentPath === item.path || (item.path !== "/" && currentPath.startsWith(item.path))
  );

  let pageTitle = activeMenuItem?.label;
  if (!pageTitle) {
    if (currentPath.includes("ai-assistant")) pageTitle = "AI Study Generator";
    else if (currentPath.includes("materials")) pageTitle = "Learning Materials";
    else if (currentPath.includes("assessments")) pageTitle = "Assessments & Tests";
    else if (currentPath.includes("flashcards")) pageTitle = "Flashcards";
    else if (currentPath.includes("analytics")) pageTitle = "Adaptive Progress";
    else if (currentPath.includes("subjects")) pageTitle = "Course Subjects";
    else if (currentPath.includes("announcements")) pageTitle = "Announcements";
    else if (currentPath.includes("users")) pageTitle = "User Management";
    else if (currentPath.includes("activity-logs")) pageTitle = "Audit Activity Logs";
    else if (currentPath.includes("remote")) pageTitle = "Remote Deployment";
    else if (currentPath.includes("self-hosted")) pageTitle = "Self-Hosted Setup";
    else if (currentPath.includes("student")) pageTitle = "Student Dashboard";
    else if (currentPath.includes("teacher")) pageTitle = "Teacher Dashboard";
    else if (currentPath.includes("admin")) pageTitle = "Admin Dashboard";
    else pageTitle = "Dashboard";
  }

  const handleRoleSelect = (roleKey: "student" | "teacher" | "admin", path: string) => {
    if (onRoleSwitch) {
      onRoleSwitch(roleKey);
    }
    navigate(path);
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static flex flex-col justify-between p-4 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 px-2">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-[#5b51d8] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                  S
                </div>
                <div>
                  <h1 className="font-extrabold text-base leading-none tracking-tight text-foreground">
                    StudyLens AI
                  </h1>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentPath === item.path ||
                  (item.path !== "/" && currentPath.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#5b51d8] text-white font-bold shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${
                          isActive ? "bg-white/20 text-white" : "bg-[#5b51d8]/15 text-[#5b51d8]"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className={`h-3.5 w-3.5 ${isActive ? "text-white" : "opacity-40"}`} />
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-3 px-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-xl transition-colors group"
              title="Click to view full user profile"
            >
              <div className="h-9 w-9 rounded-full bg-[#5b51d8] text-white flex items-center justify-center font-bold text-xs ring-2 ring-[#5b51d8]/20 shrink-0 group-hover:scale-105 transition-transform">
                {userName ? userName.charAt(0).toUpperCase() : "J"}
              </div>
              <div className="flex-1 truncate">
                <p className="text-xs font-bold truncate text-foreground group-hover:text-[#5b51d8] transition-colors">{userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userRole}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl text-xs font-semibold cursor-pointer"
              onClick={handleLogoutClick}
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
          </div>

          <div className="flex items-center space-x-2.5 ml-auto">
            {/* Role Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex gap-1.5 border-border bg-muted/30 text-xs font-semibold hover:bg-muted rounded-xl transition-colors"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-[#5b51d8]" />
                  <span>{userRole}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Switch Demo Portal
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleRoleSelect("student", "/student/dashboard")}
                  className="gap-2 cursor-pointer"
                >
                  <GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Student View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRoleSelect("teacher", "/teacher/dashboard")}
                  className="gap-2 cursor-pointer"
                >
                  <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Teacher View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRoleSelect("admin", "/admin/dashboard")}
                  className="gap-2 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 text-red-600 dark:text-red-400" /> Admin View
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DarkModeToggle />

            {/* Notification Popover Dropdown connected to Announcements */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[9px] font-extrabold text-white flex items-center justify-center ring-2 ring-background">
                    {unreadCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Announcements & Notices</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          {unreadCount} Unread
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <CheckCheck className="w-3 h-3 text-blue-500" /> Mark read
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {announcements.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No announcements available.</p>
                      ) : (
                        announcements.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              markAsRead(a.id);
                              setNotifOpen(false);
                              navigate(`/announcements?id=${a.id}`);
                            }}
                            className={`p-3 rounded-xl border text-xs space-y-2 transition-all cursor-pointer group ${
                              !a.isRead
                                ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 shadow-xs"
                                : "bg-muted/30 border-border/80 opacity-80 hover:opacity-100 hover:bg-muted/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                {a.title}
                              </span>
                              <div className="flex items-center space-x-1 shrink-0">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase">
                                  {a.tag || a.priority}
                                </span>
                                {!a.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {a.content}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                              <span className="font-semibold text-foreground">{a.authorName}</span>
                              <div className="flex items-center space-x-1 text-primary font-semibold">
                                <span>{a.createdAt}</span>
                                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-border">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          navigate("/announcements");
                        }}
                        className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold text-center transition-colors cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <span>View All Announcements Page</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs ring-2 ring-primary/20 hover:scale-105 transition-transform cursor-pointer">
                  {userName ? userName.slice(0, 2).toUpperCase() : "SL"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="font-bold text-xs">{userName}</DropdownMenuLabel>
                <p className="text-[11px] text-muted-foreground px-2 pb-1">{userRole} Account</p>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowProfileModal(true)} className="gap-2 cursor-pointer text-xs">
                  <User className="h-4 w-4" /> View My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogoutClick} className="gap-2 cursor-pointer text-xs text-destructive">
                  <LogOut className="h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          <motion.div
            key={currentPath}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Profile Dialog */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={currentUser}
        onUpdateUser={updateUser}
      />
    </div>
  );
}

