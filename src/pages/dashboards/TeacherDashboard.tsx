import React, { useState, useEffect } from "react";
import {
  Users, FolderKanban, BookCheck, Award, Sparkles, Plus, Download,
  CheckCircle2, Clock, BarChart2, MessageSquare, Megaphone, Trash2, X
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements } from "../../context/AnnouncementsContext";
import type { Subject, Quiz } from "../../types";

interface TeacherDashboardProps {
  onNavigate: (tab: string) => void;
}

const subjectEnrollmentData = [
  { name: "CS 301 Data Structures", students: 45, avgScore: 84 },
  { name: "IT 202 Web Systems", students: 38, avgScore: 79 },
  { name: "DS 401 Data Science", students: 29, avgScore: 88 },
];

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { announcements, addAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSubjectId, setAnnSubjectId] = useState("");
  const [annAudience, setAnnAudience] = useState<"all" | "students" | "teachers">("all");
  const [annPriority, setAnnPriority] = useState<"high" | "medium" | "low">("medium");

  const [gradingQueue, setGradingQueue] = useState([
    { id: "g1", student: "Alex Johnson", quiz: "Data Structures & Trees Midterm", submitted: "25 mins ago", score: "8/10", needsFeedback: true },
    { id: "g2", student: "Maria Garcia", quiz: "Web Systems REST API Quiz", submitted: "1 hour ago", score: "9/10", needsFeedback: true },
    { id: "g3", student: "David Chen", quiz: "Data Science Pandas Lab", submitted: "3 hours ago", score: "7/10", needsFeedback: false },
  ]);

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const selectedSub = subjects.find((s) => s.id === annSubjectId);
    const subName = selectedSub ? `${selectedSub.code} - ${selectedSub.name}` : undefined;

    addAnnouncement({
      title: annTitle.trim(),
      content: annContent.trim(),
      authorName: currentUser?.name || "Faculty Instructor",
      targetAudience: annAudience,
      priority: annPriority,
      subjectId: selectedSub ? selectedSub.id : undefined,
      subjectName: subName,
      tag: selectedSub ? selectedSub.code : annPriority === "high" ? "Urgent Notice" : "Course Bulletin",
    });

    setAnnTitle("");
    setAnnContent("");
    setAnnSubjectId("");
    setShowPostModal(false);
  };

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const [subRes, qzRes] = await Promise.all([
          fetch("/api/subjects"),
          fetch("/api/quizzes"),
        ]);
        if (subRes.ok && isSubscribed) {
          const subData = await subRes.json();
          setSubjects(subData);
        }
        if (qzRes.ok && isSubscribed) {
          const qzData = await qzRes.json();
          setQuizzes(qzData);
        }
      } catch (err) {
        console.error("Teacher dashboard fetch error:", err);
      }
    };
    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, []);

  const totalStudents = subjects.reduce((sum, s) => sum + (s.studentCount || 0), 0) || 112;
  const totalQuizzes = quizzes.length;
  const publishedQuizzes = quizzes.filter((q) => q.isPublished).length;

  const handleExportReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Subject Code,Subject Name,Enrolled Students,Created Materials,Assessments,Avg Pass Rate\n" +
      subjects
        .map(
          (s) =>
            `"${s.code}","${s.name}",${s.studentCount},${s.materialCount},${
              quizzes.filter((q) => q.subjectId === s.id).length
            },82%`
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `StudyLens_Faculty_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearGradingItem = (id: string) => {
    setGradingQueue((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Teacher Header Banner - Purple / Indigo Accent */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50/50 border border-purple-200/80 text-slate-900 dark:from-purple-950 dark:via-indigo-950 dark:to-slate-950 dark:border-purple-900/30 dark:text-white rounded-3xl p-6 shadow-sm dark:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200/80 dark:bg-purple-500/30 dark:text-purple-200 dark:border-purple-400/20 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" />
            <span>Faculty & Course Instructor Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Faculty Dashboard — {currentUser?.name || "Dr. Sarah Smith"}
          </h1>
          <p className="text-slate-600 dark:text-purple-100 text-xs sm:text-sm max-w-xl leading-relaxed">
            Manage course materials, build custom quizzes, trigger AI question generators, and review student attempt performance metrics across active departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
            <span>Post Notice</span>
          </button>
          <button
            onClick={() => onNavigate("assessments")}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quiz</span>
          </button>
          <button
            onClick={() => onNavigate("ai-assistant")}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Resource Generator</span>
          </button>
          <button
            onClick={handleExportReport}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Faculty Overview Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Active Students</p>
            <p className="text-2xl font-black text-foreground">{totalStudents}</p>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Enrolled in 3 Courses</p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Assigned Courses</p>
            <p className="text-2xl font-bold text-foreground">{subjects.length || 3}</p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">Active Term Catalog</p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <BookCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Assessments Created</p>
            <p className="text-2xl font-bold text-foreground">{totalQuizzes}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {publishedQuizzes} Published to Students
            </p>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Avg Class Score</p>
            <p className="text-2xl font-bold text-foreground">82%</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">+4% from last exam</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Subject Distribution Chart + Grading Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Enrollment & Performance Chart (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Class Size & Score Distribution
                </h3>
                <p className="text-xs text-muted-foreground">Enrolled student count and average pass rate by subject</p>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectEnrollmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "1px solid #334155", color: "#f8fafc", fontSize: "12px" }}
                  />
                  <Bar dataKey="students" fill="#8b5cf6" name="Enrolled Students" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Score (%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Subjects Table / Cards */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Faculty Subject List</h3>
                <p className="text-xs text-muted-foreground">Course overview and materials uploaded</p>
              </div>
              <button
                onClick={() => onNavigate("subjects")}
                className="px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Manage Subject</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((sub) => (
                <div key={sub.id} className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md font-mono text-xs font-bold">
                      {sub.code}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {sub.studentCount} Students
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{sub.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{sub.description}</p>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sub.materialCount} Documents</span>
                    <button
                      onClick={() => onNavigate("materials")}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      View Documents →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Course Bulletins & Announcements */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Active Course Bulletins & Announcements</h3>
                  <p className="text-xs text-muted-foreground">Notices published to students across your active course subjects</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPostModal(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post Notice</span>
                </button>
                <button
                  onClick={() => onNavigate("announcements")}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  View All →
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
                  No active announcements published yet. Click "Post Notice" to broadcast a message.
                </div>
              ) : (
                announcements.slice(0, 3).map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ann.priority === "high"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : ann.priority === "medium"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          }`}
                        >
                          {ann.priority || "medium"} Priority
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                          Audience: {ann.targetAudience}
                        </span>
                        {ann.tag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {ann.tag}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] text-muted-foreground font-mono">{ann.createdAt}</span>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-1 text-rose-600 hover:text-rose-700 rounded cursor-pointer"
                          title="Delete Bulletin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-foreground">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{ann.content}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Author: {ann.authorName}</span>
                      {ann.subjectName && (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">{ann.subjectName}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column: Pending Grading Queue */}
        <div className="space-y-6">
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-foreground">Pending Grading Queue</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                {gradingQueue.length} Queue
              </span>
            </div>

            <div className="space-y-3">
              {gradingQueue.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{item.student}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{item.submitted}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{item.quiz}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Score: {item.score}</span>
                    <button
                      onClick={() => handleClearGradingItem(item.id)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Review & Release</span>
                    </button>
                  </div>
                </div>
              ))}

              {gradingQueue.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  All submissions graded!
                </div>
              )}
            </div>
          </div>

          {/* Teacher AI Quick Actions */}
          <div className="bg-gradient-to-br from-purple-900 to-indigo-950 p-5 rounded-2xl text-white shadow-md space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-300" />
              <h4 className="text-sm font-bold">AI Quiz Generator</h4>
            </div>
            <p className="text-xs text-purple-200 leading-relaxed">
              Upload any lecture note or PDF document to instantly synthesize Bloom's taxonomy assessments for your students.
            </p>
            <button
              onClick={() => onNavigate("ai-assistant")}
              className="w-full py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-1"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch Creator Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* POST ANNOUNCEMENT MODAL FOR TEACHER */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Post Course Announcement</h3>
                  <p className="text-xs text-muted-foreground">Broadcast notice to enrolled students</p>
                </div>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
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
                  placeholder="e.g. Midterm Coverage & Lab Submission Deadline"
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    <option value="teachers">Faculty / Staff Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Notice Priority</label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                  >
                    <option value="high">High (Urgent Red)</option>
                    <option value="medium">Medium (Standard Amber)</option>
                    <option value="low">Low (General Blue)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Associated Course Subject (Optional)</label>
                <select
                  value={annSubjectId}
                  onChange={(e) => setAnnSubjectId(e.target.value)}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
                >
                  <option value="">-- General Institutional Bulletin --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Notice Details & Content</label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Provide clear details regarding exam schedules, assignment updates, or lecture materials..."
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Publish Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
