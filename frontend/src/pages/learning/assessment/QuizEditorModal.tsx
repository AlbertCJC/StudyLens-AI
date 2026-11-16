import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../../utils/authFetch";
import { useToast } from "../../../context/ToastContext";
import type { Quiz, QuizQuestion, Subject, User } from "../../../types";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EditQuizModal } from "./EditQuizModal";
import {
  FIXED_DIFFICULTY,
  FIXED_PASS_PERCENTAGE,
  normalizeQuestionForEdit,
  toLocalInputValue,
  validateQuizQuestion,
} from "./assessmentUtils";

interface QuizEditorModalProps {
  quiz: Quiz;
  subjects: Subject[];
  currentUser: User | null;
  lockSubject?: boolean;
  onClose: () => void;
  onSaved: (quiz: Quiz) => void;
}

export function QuizEditorModal({
  quiz,
  subjects,
  currentUser,
  lockSubject = false,
  onClose,
  onSaved,
}: QuizEditorModalProps) {
  const { showToast } = useToast();
  const [editTitle, setEditTitle] = useState(quiz.title);
  const [editDescription, setEditDescription] = useState(quiz.description || "");
  const [editSubjectId, setEditSubjectId] = useState(
    quiz.quizType === "student" ? quiz.subjectId || "" : quiz.subjectId || subjects[0]?.id || ""
  );
  const [editQuizType, setEditQuizType] = useState<"teacher" | "student">(
    quiz.quizType || "teacher"
  );
  const [editTimeLimit, setEditTimeLimit] = useState(quiz.timeLimitMinutes || 15);
  const [editLimitAttempts, setEditLimitAttempts] = useState((quiz.attemptsAllowed || 0) > 0);
  const [editAttempts, setEditAttempts] = useState(quiz.attemptsAllowed || 3);
  const [editRevealAnswers, setEditRevealAnswers] = useState(quiz.revealAnswers !== false);
  const [editDeadline, setEditDeadline] = useState(toLocalInputValue(quiz.deadline));
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>(
    (quiz.questions || []).map(normalizeQuestionForEdit)
  );

  const editQuestionListRef = useRef<HTMLDivElement>(null);
  const editPromptRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [editScrollTick, setEditScrollTick] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const markEditDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (editScrollTick === 0) return;
    const el = editQuestionListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    const prompts = editPromptRefs.current;
    prompts[prompts.length - 1]?.focus();
  }, [editScrollTick]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => {
    setDiscardOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (discardOpen) {
        cancelDiscard();
        return;
      }
      requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelDiscard, discardOpen, requestClose]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSave = async () => {
    for (let i = 0; i < editQuestions.length; i++) {
      const error = validateQuizQuestion(editQuestions[i], { requireAllOptions: true });
      if (error) {
        showToast(`Question ${i + 1}: ${error}`, "error");
        return;
      }
    }

    try {
      const isPractice = quiz.quizType === "student";
      const selectedSubject = subjects.find((s) => s.id === editSubjectId);
      const res = await authFetch(`/api/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          ...(isPractice
            ? {}
            : {
                subjectId: editSubjectId,
                subjectName: selectedSubject
                  ? `${selectedSubject.code} - ${selectedSubject.name}`
                  : quiz.subjectName,
                quizType: editQuizType,
              }),
          timeLimitMinutes: editTimeLimit,
          passPercentage: FIXED_PASS_PERCENTAGE,
          difficulty: FIXED_DIFFICULTY,
          attemptsAllowed: editLimitAttempts ? editAttempts : 0,
          revealAnswers: editRevealAnswers,
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
          questions: editQuestions,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setDirty(false);
        onSaved(updated);
        onClose();
      } else {
        const body = await res.json().catch(() => null);
        showToast(
          typeof body?.error === "string"
            ? body.error
            : "Could not save the quiz changes. Please try again.",
          "error"
        );
      }
    } catch (err) {
      console.error("Save edit quiz error:", err);
      showToast("Could not save the quiz changes. Please try again.", "error");
    }
  };

  return (
    <>
      <EditQuizModal
        editingQuiz={quiz}
        subjects={subjects}
        currentUser={currentUser}
        lockSubject={lockSubject}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        editSubjectId={editSubjectId}
        setEditSubjectId={setEditSubjectId}
        editQuizType={editQuizType}
        setEditQuizType={setEditQuizType}
        editTimeLimit={editTimeLimit}
        setEditTimeLimit={setEditTimeLimit}
        editLimitAttempts={editLimitAttempts}
        setEditLimitAttempts={setEditLimitAttempts}
        editAttempts={editAttempts}
        setEditAttempts={setEditAttempts}
        editRevealAnswers={editRevealAnswers}
        setEditRevealAnswers={setEditRevealAnswers}
        editDeadline={editDeadline}
        setEditDeadline={setEditDeadline}
        editQuestions={editQuestions}
        setEditQuestions={setEditQuestions}
        editQuestionListRef={editQuestionListRef}
        editPromptRefs={editPromptRefs}
        setEditScrollTick={setEditScrollTick}
        markEditDirty={markEditDirty}
        requestCloseEdit={requestClose}
        handleSaveEditQuiz={handleSave}
      />
      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        message="You have unsaved quiz changes. Discard them and close the editor?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </>
  );
}
