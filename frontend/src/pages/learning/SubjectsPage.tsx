import React, { useState, useEffect } from "react";
import { FolderKanban, Plus, Users, Trash2, GraduationCap, Mail, X, Pencil, BookOpen, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import type { Subject, User } from "../../types";

interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  studentId: string;
  dateEnrolled: string;
}

const DEFAULT_SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];
const DEFAULT_COURSES = [
  "BSIT",
  "BSCS",
  "BSIS",
  "BSIT - Data Science",
  "BSCpE",
  "BSEntrep",
  "BSED",
  "BSCrim",
  "BSHM",
  "BSA",
  "BSBA",
  "BSMT",
  "BS Psychology",
  "BS Nursing",
  "AB Communication",
  "General Education",
];

export const SubjectsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === "admin";
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  // Unified Create/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [semester, setSemester] = useState(DEFAULT_SEMESTERS[0]);
  const [course, setCourse] = useState(DEFAULT_COURSES[0]);
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [saving, setSaving] = useState(false);

  const [rosterSubject, setRosterSubject] = useState<Subject | null>(null);
  const [roster, setRoster] = useState<EnrolledStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    const fetchSubjects = async () => {
      try {
        const res = await authFetch("/api/subjects");
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) setSubjects(data);
        }
      } catch (err) {
        console.error("Fetch subjects error:", err);
      }
    };

    fetchSubjects();
    return () => {
      isSubscribed = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let isSubscribed = true;
    const fetchTeachers = async () => {
      try {
        const res = await authFetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setTeachers((data as User[]).filter((u) => u.role === "teacher"));
          }
        }
      } catch (err) {
        console.error("Fetch teachers error:", err);
      }
    };
    fetchTeachers();
    return () => {
      isSubscribed = false;
    };
  }, [isAdmin]);

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
    setTeacherId("");
    setSemester(DEFAULT_SEMESTERS[0]);
    setCourse(DEFAULT_COURSES[0]);
    setSchoolYear("2026-2027");
    setEditingSubject(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setModalOpen(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setCode(sub.code);
    setName(sub.name);
    setDescription(sub.description || "");
    setTeacherId(sub.teacherId);
    setSemester(sub.semester || DEFAULT_SEMESTERS[0]);
    setCourse(sub.course || DEFAULT_COURSES[0]);
    setSchoolYear(sub.schoolYear || "2026-2027");
    setModalMode("edit");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const openRoster = async (sub: Subject) => {
    setRosterSubject(sub);
    setRoster([]);
    setRosterLoading(true);
    try {
      const res = await authFetch(`/api/subjects/${sub.id}/students`);
      if (res.ok) {
        const data = await res.json();
        setRoster(data);
      }
    } catch (err) {
      console.error("Fetch roster error:", err);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleSubmitSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !teacherId) return;

    setSaving(true);
    try {
      const payload = JSON.stringify({ code, name, description, teacherId, semester, course, schoolYear });
      const url = modalMode === "edit" && editingSubject ? `/api/subjects/${editingSubject.id}` : "/api/subjects";
      const method = modalMode === "edit" ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (res.ok) {
        const saved = await res.json();
        if (modalMode === "edit") {
          setSubjects((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        } else {
          setSubjects((prev) => [saved, ...prev]);
        }
        closeModal();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || (modalMode === "edit" ? "Could not update the subject." : "Could not create the subject."));
      }
    } catch (err) {
      console.error("Save subject error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course subject?")) return;
    try {
      const res = await authFetch(`/api/subjects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubjects((prev) => prev.filter((s) => s.id !== id));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Could not delete the subject.");
      }
    } catch (err) {
      console.error("Delete subject error:", err);
    }
  };

  const canViewRoster = (sub: Subject) =>
    isAdmin || (currentUser?.role === "teacher" && currentUser.id === sub.teacherId);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border border-blue-200/80 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-900 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200/80 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/20 text-xs font-semibold">
            <FolderKanban className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            <span>{isAdmin ? "Academic Course Management" : "My Assigned Subjects"}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isAdmin ? "Subjects & Course Catalog" : "My Subjects"}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xl leading-relaxed">
            {isAdmin
              ? "Create course subjects, assign a teacher/instructor to manage each one, and inspect enrolled student rosters. Click a subject to open its workspace."
              : "Only the subjects assigned to you by the administrator are shown here. Open a subject to manage its materials, quizzes, announcements, and enrolled students."}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 self-start sm:self-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Subject</span>
          </button>
        )}
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((sub) => (
          <div
            key={sub.id}
            onClick={() => navigate(`/subjects/${sub.id}`)}
            className="bg-card p-6 rounded-2xl border border-border shadow-xs hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold rounded-lg">
                  {sub.code}
                </span>
                <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{sub.studentCount} People</span>
                </span>
              </div>

              <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {sub.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{sub.description}</p>
              {sub.semester && (
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {sub.semester} • {sub.schoolYear || ""} • {sub.course || ""}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{sub.materialCount} Materials</span>
                </span>
                <span className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <span>Open Workspace</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </span>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-1">
                <div className="flex items-center space-x-1">
                  {canViewRoster(sub) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoster(sub);
                      }}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer"
                      title="View People"
                    >
                      <GraduationCap className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  {isAdmin && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(sub);
                        }}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer"
                        title="Edit Subject"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubject(sub.id);
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Subject Modal (Admin only) */}
      {modalOpen && isAdmin && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {modalMode === "edit" ? "Edit Course Subject" : "Add New Course Subject"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitSubject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Subject Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g., CS 301 or DB 204"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Subject Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Data Structures & Algorithms"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Assigned Instructor</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>Select a teacher to manage this subject</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  The assigned teacher will be the only one who can manage this subject.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Course Overview & Syllabus</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of learning objectives..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DEFAULT_SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">School Year</label>
                  <input
                    type="text"
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(e.target.value)}
                    placeholder="e.g., 2026-2027"
                    className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Program / Course</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g., BSIT, BSCS, General Education"
                  list="subject-course-options"
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="subject-course-options">
                  {DEFAULT_COURSES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {saving ? "Saving..." : modalMode === "edit" ? "Save Changes" : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* People Roster Modal */}
      {rosterSubject && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRosterSubject(null);
          }}
        >
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">People in this Subject</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rosterSubject.code} - {rosterSubject.name}
                </p>
              </div>
              <button
                onClick={() => setRosterSubject(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Assigned Teacher */}
            <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{rosterSubject.teacherName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">Assigned instructor for this subject</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg shrink-0">
                Teacher
              </span>
            </div>

            <div className="text-xs font-semibold text-muted-foreground pt-1">
              Enrolled Students ({roster.length})
            </div>

            {rosterLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading enrolled students...</p>
            ) : roster.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No students are enrolled in this subject yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {roster.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center space-x-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                        {s.studentId || "—"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg">
                        Student
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
