import React, { useState, useEffect } from "react";
import { Plus, Trash2, GraduationCap, Mail, X, Pencil, BookOpen, ShieldCheck, UserCheck, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { Pagination, slicePage } from "../../components/Pagination";
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
  const { showToast } = useToast();
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

  // Assign students (admin only)
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assigningStudents, setAssigningStudents] = useState(false);

  // Subject search & filters (Part E)
  const [subjectQuery, setSubjectQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");

  // Pagination
  const [subjectPage, setSubjectPage] = useState(1);
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterPage, setRosterPage] = useState(1);

  // Assign modal search & filter (Part D)
  const [assignQuery, setAssignQuery] = useState("");
  const [assignStatusFilter, setAssignStatusFilter] = useState<"all" | "enrolled" | "unenrolled">("all");
  const [assignPage, setAssignPage] = useState(1);


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
    setRosterQuery("");
    setRosterPage(1);
    setAssignQuery("");
    setAssignStatusFilter("all");
    setAssignPage(1);

    try {
      const res = await authFetch(`/api/subjects/${sub.id}/students`);
      if (res.ok) {
        const data = await res.json();
        setRoster(data);
        setSelectedStudentIds(new Set((data as EnrolledStudent[]).map((s) => s.id)));
      }
      if (isAdmin) {
        const uRes = await authFetch("/api/users");
        if (uRes.ok) {
          const users = (await uRes.json()) as User[];
          setAllStudents(users.filter((u) => u.role === "student"));
        }
      }
    } catch (err) {
      console.error("Fetch roster error:", err);
    } finally {
      setRosterLoading(false);
    }
  };

  const toggleAssignStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleSaveAssignment = async () => {
    if (!rosterSubject) return;
    setAssigningStudents(true);

    const enrolled = new Set(roster.map((s) => s.id));
    const toAdd = Array.from(selectedStudentIds).filter((id) => !enrolled.has(id));
    const toRemove = Array.from(enrolled).filter((id) => !selectedStudentIds.has(id));
    try {
      if (toAdd.length > 0) {
        const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: toAdd }),
        });
        if (!res.ok) throw new Error("Could not assign the selected students.");
      }
      if (toRemove.length > 0) {
        const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: toRemove }),
        });
        if (!res.ok) throw new Error("Could not remove the selected students.");
      }
      const res = await authFetch(`/api/subjects/${rosterSubject.id}/students`);
      if (res.ok) {
        const data = (await res.json()) as EnrolledStudent[];
        setRoster(data);
        setSelectedStudentIds(new Set(data.map((s) => s.id)));
        setSubjects((prev) =>
          prev.map((s) => (s.id === rosterSubject.id ? { ...s, studentCount: data.length } : s))
        );
        showToast("Student roster updated.");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the roster.", "error");
    } finally {
      setAssigningStudents(false);
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
        showToast(errData.error || (modalMode === "edit" ? "Could not update the subject." : "Could not create the subject."), "error");
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
        showToast("Subject deleted.");
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Could not delete the subject.", "error");
      }
    } catch (err) {
      console.error("Delete subject error:", err);
    }
  };

  const canViewRoster = (sub: Subject) =>
    isAdmin || (currentUser?.role === "teacher" && currentUser.id === sub.teacherId);

  const filteredSubjects = subjects.filter((sub) => {
    if (!isAdmin) return true;
    const q = subjectQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      sub.name.toLowerCase().includes(q) ||
      sub.code.toLowerCase().includes(q) ||
      (sub.description || "").toLowerCase().includes(q);
    const matchesSemester = semesterFilter === "all" || sub.semester === semesterFilter;
    const matchesCourse = courseFilter === "all" || sub.course === courseFilter;
    const matchesTeacher = teacherFilter === "all" || sub.teacherId === teacherFilter;
    return matchesQuery && matchesSemester && matchesCourse && matchesTeacher;
  });

  useEffect(() => {
    setSubjectPage(1);
  }, [subjectQuery, semesterFilter, courseFilter, teacherFilter]);

  const pagedSubjects = slicePage(filteredSubjects, subjectPage);

  const rosterSearch = rosterQuery.trim().toLowerCase();
  const pagedRoster = slicePage(
    roster.filter(
      (s) =>
        !rosterSearch ||
        s.name.toLowerCase().includes(rosterSearch) ||
        s.email.toLowerCase().includes(rosterSearch) ||
        (s.studentId || "").toLowerCase().includes(rosterSearch)
    ),
    rosterPage
  );

  useEffect(() => {
    setRosterPage(1);
  }, [rosterQuery]);

  const assignSearch = assignQuery.trim().toLowerCase();
  const filteredAssignStudents = allStudents.filter((s) => {
    const matchesQuery =
      !assignSearch ||
      s.name.toLowerCase().includes(assignSearch) ||
      s.email.toLowerCase().includes(assignSearch) ||
      (s.studentId || "").toLowerCase().includes(assignSearch);
    const isEnrolled = selectedStudentIds.has(s.id);
    const matchesStatus =
      assignStatusFilter === "all" ||
      (assignStatusFilter === "enrolled" && isEnrolled) ||
      (assignStatusFilter === "unenrolled" && !isEnrolled);
    return matchesQuery && matchesStatus;
  });
  useEffect(() => {
    setAssignPage(1);
  }, [assignQuery, assignStatusFilter]);
  const pagedAssignStudents = slicePage(filteredAssignStudents, assignPage);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Subject</span>
          </button>
        )}
      </div>

      {/* Subject Search & Filters (Admin only) */}
      {isAdmin && (
        <div className="bg-card p-3 rounded-2xl border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              placeholder="Search name, code, or keyword..."
              className="w-full pl-9 pr-3 py-1.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
          >
            <option value="all">All Semesters</option>
            {DEFAULT_SEMESTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
          >
            <option value="all">All Courses</option>
            {DEFAULT_COURSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
          >
            <option value="all">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {filteredSubjects.length === 0 ? (
        <div className="bg-card p-10 rounded-2xl border border-border shadow-xs text-center space-y-2">
          <p className="text-sm font-bold text-foreground">No subjects match your filters.</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting the search query or clearing the filters above.
          </p>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pagedSubjects.map((sub) => (
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

      <Pagination
        page={subjectPage}
        total={filteredSubjects.length}
        onPageChange={(p) => setSubjectPage(p)}
      />
      </>
      )}

      {/* Create / Edit Subject Modal (Admin only) */}
      {modalOpen && isAdmin && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
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
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">People in this Subject</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rosterSubject.code} - {rosterSubject.name}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button
                    onClick={() => {

                      setShowAssignModal(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Assign Students</span>
                  </button>
                )}
                <button
                  onClick={() => setRosterSubject(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
            </div>

            <div className="text-xs font-semibold text-muted-foreground pt-1">
              Enrolled Students ({roster.length})
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={rosterQuery}
                onChange={(e) => setRosterQuery(e.target.value)}
                placeholder="Search enrolled students..."
                className="w-full pl-9 pr-3 py-1.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {rosterLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading enrolled students...</p>
            ) : roster.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No students are enrolled in this subject yet.
              </p>
            ) : (
              <>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {pagedRoster.map((s) => (
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
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                page={rosterPage}
                total={roster.length}
                onPageChange={(p) => setRosterPage(p)}
              />
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign Students Modal (admin only) */}
      {showAssignModal && rosterSubject && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAssignModal(false);
          }}
        >
          <div className="bg-card rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Assign Students</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select which students to enroll in {rosterSubject.code} - {rosterSubject.name}
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                {selectedStudentIds.size} selected of {allStudents.length} students
              </p>
              <button
                onClick={() =>
                  setSelectedStudentIds(
                    selectedStudentIds.size === allStudents.length
                      ? new Set()
                      : new Set(allStudents.map((s) => s.id))
                  )
                }
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {selectedStudentIds.size === allStudents.length ? "Clear all" : "Select all"}
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={assignQuery}
                  onChange={(e) => setAssignQuery(e.target.value)}
                  placeholder="Search students by name, email, or ID..."
                  className="w-full pl-9 pr-3 py-1.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "enrolled", "unenrolled"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setAssignStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                      assignStatusFilter === status
                        ? "bg-blue-600 text-white"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {status === "all" ? "All" : status === "enrolled" ? "Enrolled" : "Unenrolled"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredAssignStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No students match the current search or filter.
                </p>
              ) : (
                pagedAssignStudents.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={() => toggleAssignStudent(s.id)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                      </div>
                    </div>
                    <span className="flex items-center space-x-2 shrink-0">
                      {selectedStudentIds.has(s.id) && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg">
                          Enrolled
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                        {s.studentId || "—"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <Pagination
              page={assignPage}
              total={filteredAssignStudents.length}
              onPageChange={(p) => setAssignPage(p)}
            />

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={assigningStudents}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
              >
                {assigningStudents ? "Saving..." : "Save Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
