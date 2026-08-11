import React, { useState, useEffect } from "react";
import { FolderKanban, Plus, Users, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Subject } from "../../types";

export const SubjectsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let isSubscribed = true;
    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/subjects");
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

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;

    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          description,
          teacherId: currentUser?.id,
          teacherName: currentUser?.name || "Faculty Staff",
        }),
      });

      if (res.ok) {
        const newSub = await res.json();
        setSubjects((prev) => [...prev, newSub]);
        setCode("");
        setName("");
        setDescription("");
        setShowModal(false);
      }
    } catch (err) {
      console.error("Create subject error:", err);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course subject?")) return;
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubjects((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Delete subject error:", err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border border-blue-200/80 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-900 dark:border-blue-900/30 dark:text-white rounded-2xl p-6 shadow-xs dark:shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200/80 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/20 text-xs font-semibold">
            <FolderKanban className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            <span>Academic Course Management</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subjects & Course Catalog</h1>
          <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xl leading-relaxed">
            Browse active course subjects, manage learning material repositories, and inspect enrolled student rosters.
          </p>
        </div>

        {(currentUser?.role === "teacher" || currentUser?.role === "admin") && (
          <button
            onClick={() => setShowModal(true)}
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
            className="bg-card p-6 rounded-2xl border border-border shadow-xs hover:border-blue-500 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold rounded-lg">
                  {sub.code}
                </span>
                <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{sub.studentCount} Students</span>
                </span>
              </div>

              <h3 className="text-base font-bold text-foreground">{sub.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{sub.description}</p>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Faculty: <strong className="text-foreground">{sub.teacherName}</strong></span>
                <span>{sub.materialCount} Materials</span>
              </div>

              {(currentUser?.role === "teacher" || currentUser?.role === "admin") && (
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => handleDeleteSubject(sub.id)}
                    className="p-2 text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4">
            <h3 className="text-lg font-bold text-foreground">Add New Course Subject</h3>
            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs">
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
                <label className="block font-semibold text-foreground mb-1">Course Overview & Syllabus</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of learning objectives..."
                  className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
