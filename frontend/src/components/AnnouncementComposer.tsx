import React, { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAnnouncements, type AnnouncementItem } from "../context/AnnouncementsContext";
import { useToast } from "../context/ToastContext";
import { authFetch } from "../utils/authFetch";

interface AnnouncementComposerProps {
  open: boolean;
  onClose: () => void;
  editingAnn?: AnnouncementItem | null;
  presetSubjectId?: string;
  presetSubjectName?: string;
  onPosted?: () => void;
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

export const AnnouncementComposer: React.FC<AnnouncementComposerProps> = ({
  open,
  onClose,
  editingAnn = null,
  presetSubjectId,
  presetSubjectName,
  onPosted,
}) => {
  const { currentUser } = useAuth();
  const { addAnnouncement, updateAnnouncement } = useAnnouncements();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all" | "students" | "teachers">("students");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  const isTeacher = currentUser?.role === "teacher";
  const isAdmin = currentUser?.role === "admin";
  const hasPreset = !!presetSubjectId;

  // Fetch subjects if no preset
  useEffect(() => {
    if (hasPreset || !open) return;
    let active = true;
    authFetch("/api/subjects")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        setSubjects(data.map((s: Record<string, string>) => ({ id: s.id || s.subject_id || "", code: s.code || s.subject_code || "", name: s.name || s.subject_name || "" })));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [hasPreset, open]);

  // Reset form on open / editingAnn change
  useEffect(() => {
    if (!open) return;
    if (editingAnn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(editingAnn.title);
      setContent(editingAnn.content);
      setPriority((editingAnn.priority as "high" | "medium" | "low") || "medium");
      setSubjectId(editingAnn.subjectId || presetSubjectId || "");
      setTargetAudience(editingAnn.targetAudience || "students");
    } else {
      setTitle("");
      setContent("");
      setPriority("medium");
      setSubjectId(presetSubjectId || "");
      setTargetAudience(isTeacher ? "students" : "all");
    }
    setError("");
  }, [open, editingAnn, presetSubjectId, isTeacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) {
      setError("Please provide both a title and message.");
      return;
    }

    const resolvedSubjectId = presetSubjectId || subjectId;
    if (!editingAnn && !resolvedSubjectId && isTeacher) {
      setError("Select a subject so enrolled students receive this announcement.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const selectedSub = subjects.find((s) => s.id === resolvedSubjectId);
      const subName = presetSubjectName || (selectedSub ? `${selectedSub.code} - ${selectedSub.name}` : editingAnn?.subjectName || "");
      const tag = selectedSub?.code || (priority === "high" ? "Urgent" : "Notice");
      const audience = isTeacher ? "students" : targetAudience;

      if (editingAnn) {
        await updateAnnouncement(editingAnn.id, { title: t, content: c, priority });
        showToast("Announcement updated.");
      } else {
        await addAnnouncement({
          title: t,
          content: c,
          authorName: currentUser?.name || "Faculty Instructor",
          targetAudience: audience,
          priority,
          subjectId: resolvedSubjectId || undefined,
          subjectName: subName || undefined,
          tag,
        });
        showToast("Announcement posted.");
      }
      onClose();
      onPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {editingAnn ? "Edit Announcement" : "Post Announcement"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {editingAnn ? "Update the notice for enrolled students" : hasPreset ? `Announcement for ${presetSubjectName || "this subject"}` : "Broadcast updates to enrolled students and staff"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer">
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

          {!hasPreset && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Associated Course Subject</label>
              {subjects.length === 0 && isTeacher ? (
                <p className="p-2.5 text-xs text-muted-foreground bg-muted/30 border border-border rounded-xl">
                  You have no subjects assigned yet. Once a subject is assigned to you, announcements posted here will reach its enrolled students.
                </p>
              ) : editingAnn && editingAnn.subjectId ? (
                <>
                  <select disabled className="w-full p-2.5 bg-muted/40 border border-border rounded-xl text-muted-foreground font-semibold cursor-not-allowed">
                    <option value={editingAnn.subjectId}>{editingAnn.subjectName || "Original subject"}</option>
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground">The subject cannot be changed: it defines which class received this notice.</p>
                </>
              ) : (
                <>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required={isTeacher}
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {isAdmin && <option value="">General Announcement (All Subjects)</option>}
                    {!isAdmin && <option value="">Choose a subject to send this announcement to...</option>}
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                  {isTeacher && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Only subjects assigned to you will appear here. Students enrolled in the selected subject will receive this announcement.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {hasPreset && (
            <p className="text-[10px] text-muted-foreground bg-muted/30 border border-border rounded-xl px-3 py-2">
              Delivered to the students enrolled in <strong>{presetSubjectName || "this subject"}</strong>.
            </p>
          )}

          {isAdmin && !hasPreset ? (
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
          ) : (
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
          )}

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

        {error && (
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{submitting ? "Saving..." : editingAnn ? "Save Changes" : "Publish Announcement"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
