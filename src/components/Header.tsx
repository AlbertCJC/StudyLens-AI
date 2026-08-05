import React, { useState } from "react";
import { Bell, Sparkles, Award, Globe, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab }) => {
  const { currentUser } = useAuth();
  const [showNotif, setShowNotif] = useState(false);

  const getTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return `${currentUser?.role.toUpperCase()} Dashboard`;
      case "materials":
        return "Learning Materials & Document Extractor";
      case "ai-assistant":
        return "AI Study Resource Generator";
      case "assessments":
        return "Assessment & Adaptive Quizzes";
      case "flashcards":
        return "Adaptive Flashcard Study Decks";
      case "analytics":
        return "Knowledge Gap & Progress Analytics";
      case "subjects":
        return "Course Subject Catalog";
      case "users":
        return "System User Management";
      case "announcements":
        return "Platform Announcements";
      case "activity-logs":
        return "System Activity & Audit Logs";
      default:
        return "StudyLens AI";
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Title & SDG Badges */}
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight capitalize">{getTitle()}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Automated Assessment & Adaptive Learning Engine</p>
        </div>

        <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-border">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>SDG 4: Quality Education</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Award className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>SDG 9: Industry & Innovation</span>
          </span>
        </div>
      </div>

      {/* Action Controls & User Pill */}
      <div className="flex items-center space-x-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-background"></span>
          </button>

          {/* Notifications Dropdown */}
          {showNotif && (
            <div className="absolute right-0 mt-2 w-80 bg-card rounded-xl shadow-xl border border-border p-4 z-50 text-xs">
              <div className="flex items-center justify-between font-bold text-foreground pb-2 border-b border-border">
                <span>System Notifications</span>
                <span className="text-[10px] text-primary font-normal">2 New</span>
              </div>
              <div className="space-y-3 mt-3">
                <div className="p-2 bg-muted/40 rounded-lg border border-border">
                  <p className="font-semibold text-foreground">New Materials Uploaded</p>
                  <p className="text-muted-foreground mt-0.5">Prof. Maria Santos uploaded lecture notes on Graph Algorithms.</p>
                  <span className="text-[9px] text-muted-foreground mt-1 block">10 mins ago</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border">
                  <p className="font-semibold text-foreground">Adaptive Recommendation Ready</p>
                  <p className="text-muted-foreground mt-0.5">Your score analysis recommends a 5-minute flashcard drill on BST.</p>
                  <span className="text-[9px] text-muted-foreground mt-1 block">1 hour ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Engine Status Pill */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span>Gemini / Cerebras AI Active</span>
        </div>

        {/* User Role Tag */}
        <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-border">
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{currentUser?.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{currentUser?.role}</p>
          </div>
          <div className="p-1.5 bg-muted rounded-lg text-muted-foreground">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
