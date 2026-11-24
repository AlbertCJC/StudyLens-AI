import { Check, CheckSquare, Pencil, Plus, X } from "lucide-react";
import type { RefObject } from "react";
import type { Quiz, QuizQuestion, Subject, User } from "../../../types";
import { EditQuizQuestionCard } from "./EditQuizQuestionCard";
import { FIXED_DIFFICULTY, FIXED_PASS_PERCENTAGE } from "./assessmentUtils";

interface EditQuizModalProps {
  editingQuiz: Quiz;
  subjects: Subject[];
  currentUser: User | null;
  lockSubject?: boolean;
  editTitle: string;
  setEditTitle: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editSubjectId: string;
  setEditSubjectId: (value: string) => void;
  editQuizType: "teacher" | "student";
  setEditQuizType: (value: "teacher" | "student") => void;
  editTimeLimit: number;
  setEditTimeLimit: (value: number) => void;
  editLimitAttempts: boolean;
  setEditLimitAttempts: (value: boolean) => void;
  editAttempts: number;
  setEditAttempts: (value: number) => void;
  editRevealAnswers: boolean;
  setEditRevealAnswers: (value: boolean) => void;
  editDeadline: string;
  setEditDeadline: (value: string) => void;
  editQuestions: QuizQuestion[];
  setEditQuestions: (questions: QuizQuestion[]) => void;
  editQuestionListRef: RefObject<HTMLDivElement | null>;
  editPromptRefs: RefObject<(HTMLInputElement | null)[]>;
  setEditScrollTick: (updater: (tick: number) => number) => void;
  markEditDirty: () => void;
  requestCloseEdit: (afterClose?: () => void) => void;
  handleSaveEditQuiz: () => void;
}

export function EditQuizModal({
  editingQuiz,
  subjects,
  currentUser,
  lockSubject = false,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  editSubjectId,
  setEditSubjectId,
  editQuizType,
  setEditQuizType,
  editTimeLimit,
  setEditTimeLimit,
  editLimitAttempts,
  setEditLimitAttempts,
  editAttempts,
  setEditAttempts,
  editRevealAnswers,
  setEditRevealAnswers,
  editDeadline,
  setEditDeadline,
  editQuestions,
  setEditQuestions,
  editQuestionListRef,
  editPromptRefs,
  setEditScrollTick,
  markEditDirty,
  requestCloseEdit,
  handleSaveEditQuiz,
}: EditQuizModalProps) {
  const updateQuestion = (idx: number, updatedQuestion: QuizQuestion) => {
    const updated = [...editQuestions];
    updated[idx] = updatedQuestion;
    setEditQuestions(updated);
    markEditDirty();
  };

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestCloseEdit();
      }}
    >
      <div className="bg-card border border-border p-6 rounded-2xl max-w-5xl w-full shadow-xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-structure text-primary dark:text-indigo-300 rounded-xl">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Quiz / Assessment</h3>
              <p className="text-xs text-muted-foreground">Modify title, scope, subject association, and questions</p>
            </div>
          </div>
          <button
            onClick={() => requestCloseEdit()}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-4 lg:space-y-0 text-xs">
          {/* Settings column */}
          <div className="space-y-4 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
          {/* Row 1: Quiz Scope */}
          <div>
            <label className="block font-bold text-foreground mb-1">Quiz Scope</label>
            {editingQuiz.quizType === "student" ? (
              <p className="p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                Personal Practice Drill (Private to Yourself) — scope and subject cannot change.
              </p>
            ) : (
            <select
              value={editQuizType}
              onChange={(e) => {
      setEditQuizType(e.target.value as "teacher" | "student");
      markEditDirty();
    }}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
            >
              <option value="teacher">Course Subject Quiz (For Enrolled Class Students)</option>
              <option value="student">Personal Practice Drill (Private to Yourself)</option>
            </select>
            )}
          </div>

          {/* Row 2: Title and (Conditional) Associated Course Subject */}
          <div className={`grid gap-3 ${editQuizType === "teacher" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block font-bold text-foreground mb-1">Quiz Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => {
      setEditTitle(e.target.value);
      markEditDirty();
    }}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {editQuizType === "teacher" && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="block font-bold text-foreground mb-1">Associated Course Subject</label>
                <select
                  value={editSubjectId}
                  disabled={lockSubject}
                  onChange={(e) => {
        setEditSubjectId(e.target.value);
        markEditDirty();
      }}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <option value="">— Subjectless (no assigned subject) —</option>
                  {subjects
                    .filter((sub) => currentUser?.role !== "teacher" || sub.teacherId === currentUser.id)
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1">Description / Guidelines</label>
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => {
      setEditDescription(e.target.value);
      markEditDirty();
    }}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-foreground mb-1">Time Limit (Mins)</label>
              <input
                type="number"
                min={1}
                value={editTimeLimit}
                onChange={(e) => {
      setEditTimeLimit(Number(e.target.value));
      markEditDirty();
    }}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block font-bold text-foreground mb-1">Assessment Settings</label>
              <p className="p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                Passing score: {FIXED_PASS_PERCENTAGE}% · Difficulty: {FIXED_DIFFICULTY}
              </p>
            </div>
          </div>

          {editQuizType === "teacher" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-limit-attempts"
                checked={editLimitAttempts}
                onChange={(e) => {
      setEditLimitAttempts(e.target.checked);
      markEditDirty();
    }}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <label htmlFor="edit-limit-attempts" className="font-bold text-foreground text-xs cursor-pointer">
                Limit attempts per student
              </label>
            </div>
            {editLimitAttempts && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="block font-bold text-foreground mb-1">Max Attempts</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editAttempts}
                  onChange={(e) => {
      setEditAttempts(Math.max(1, Math.min(99, Number(e.target.value) || 1)));
      markEditDirty();
    }}
                  className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-reveal-answers"
                checked={editRevealAnswers}
                onChange={(e) => {
      setEditRevealAnswers(e.target.checked);
      markEditDirty();
    }}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <label htmlFor="edit-reveal-answers" className="font-bold text-foreground text-xs cursor-pointer">
                Students can see correct answers after submitting
              </label>
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Deadline (Optional)</label>
              <input
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => {
      setEditDeadline(e.target.value);
      markEditDirty();
    }}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                After this date students can no longer submit. Unattempted quizzes are marked Missing (0%) in grades.
              </p>
            </div>
          </div>
          )}

          </div>

          {/* Questions List Editor */}
          <div className="space-y-3 pt-3 lg:pt-0 border-t border-border lg:border-t-0 lg:bg-muted/20 lg:border lg:border-border lg:rounded-2xl lg:p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-primary" />
                <span>Quiz Questions List ({editQuestions.length})</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  const newQ: QuizQuestion = {
                    id: `eq-${Date.now()}`,
                    question: "New Custom Quiz Question",
                    type: "multiple_choice",
                    options: ["Option A", "Option B", "Option C", "Option D"],
                    correctAnswer: 0,
                    explanation: "Explanation of the correct answer.",
                    bloomsLevel: "Understanding",
                    difficulty: "medium",
                    topicTag: "General Topic",
                  };
                  setEditQuestions([...editQuestions, newQ]);
    markEditDirty();
                  setEditScrollTick((t) => t + 1);
                }}
                className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            <div ref={editQuestionListRef} className="space-y-3 max-h-60 lg:max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
              {editQuestions.map((q, idx) => (
                <EditQuizQuestionCard
                  key={q.id || idx}
                  question={q}
                  index={idx}
                  promptRef={(el) => {
                    editPromptRefs.current[idx] = el;
                  }}
                  onUpdate={(updatedQuestion) => updateQuestion(idx, updatedQuestion)}
                  onDelete={() => {
                    setEditQuestions(editQuestions.filter((_, i) => i !== idx));
                    markEditDirty();
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
          <button
            onClick={() => requestCloseEdit()}
            className="px-4 py-2 bg-muted text-foreground rounded-xl text-xs font-bold cursor-pointer hover:bg-muted/80"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveEditQuiz}
            className="px-5 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1"
          >
            <Check className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
