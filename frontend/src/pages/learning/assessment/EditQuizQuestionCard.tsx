import { CheckCircle2, CheckSquare, Trash2 } from "lucide-react";
import type { QuestionType, QuizQuestion } from "../../../types";
import { CORRECT_ANSWER_CARD_CLASS, CORRECT_ANSWER_CHIP_CLASS, resolveMCIndex } from "./assessmentUtils";

interface EditQuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  promptRef: (el: HTMLInputElement | null) => void;
  onUpdate: (updated: QuizQuestion) => void;
  onDelete: () => void;
}

export function EditQuizQuestionCard({ question: q, index, promptRef, onUpdate, onDelete }: EditQuizQuestionCardProps) {
  const idx = index;
  return (
    <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-foreground text-xs">Question {idx + 1}</span>
        <div className="flex items-center space-x-2">
          <select
            value={q.type || "multiple_choice"}
            onChange={(e) => {
              const newType = e.target.value as QuestionType;
              onUpdate({
                ...q,
                type: newType,
                options: newType === "multiple_choice" ? (q.options?.length ? q.options : ["Option A", "Option B", "Option C", "Option D"]) : newType === "true_false" ? ["True", "False"] : [],
                correctAnswer:
                  newType === "identification"
                    ? (typeof q.correctAnswer === "string" ? q.correctAnswer : "")
                    : 0,
              });
            }}
            className="p-1 bg-card border border-border rounded text-[11px] font-semibold"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="identification">Identification</option>
            <option value="true_false">True / False</option>
          </select>
          <button
            type="button"
            onClick={onDelete}
            className="text-rose-600 hover:text-rose-700 text-xs cursor-pointer p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        ref={promptRef}
        type="text"
        value={q.question}
        onChange={(e) => onUpdate({ ...q, question: e.target.value })}
        placeholder="Enter question prompt..."
        className="w-full text-xs font-bold text-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:outline-none pb-1"
      />

      {q.type === "identification" ? (
        <div>
          <label className="text-[10px] font-bold text-primary">Exact Identification Answer:</label>
          <input
            type="text"
            value={String(q.correctAnswer || "")}
            onChange={(e) => onUpdate({ ...q, correctAnswer: e.target.value })}
            placeholder="Type exact key term..."
            className="w-full p-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      ) : q.type === "true_false" ? (
        <div>
          <label className="text-[10px] font-bold text-muted-foreground">Correct Answer:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {["True", "False"].map((tf, tfIdx) => {
              const tfCorrect = Number(q.correctAnswer) === tfIdx;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onUpdate({ ...q, correctAnswer: tfIdx })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    tfCorrect
                      ? CORRECT_ANSWER_CARD_CLASS
                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <span>
                    <span className="font-bold mr-2">{tfIdx === 0 ? "A." : "B."}</span>
                    {tf}
                  </span>
                  {tfCorrect && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center space-x-2 text-[10px] font-bold text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={Array.isArray(q.correctAnswer)}
              onChange={(e) => onUpdate({ ...q, correctAnswer: e.target.checked ? [0] : 0 })}
              className="accent-primary"
            />
            <span>Multiple correct answers (select all that apply)</span>
          </label>
          <p className="text-[10px] text-muted-foreground">Click an option to set it as the correct answer. Click its text to edit it.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(q.options || ["Option 1", "Option 2", "Option 3", "Option 4"]).map((opt, optIdx) => {
              const isMulti = Array.isArray(q.correctAnswer);
              const isCorrect = isMulti
                ? (q.correctAnswer as number[]).includes(optIdx)
                : resolveMCIndex(q) === optIdx;
              return (
                <div
                  key={optIdx}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isMulti) {
                      const cur = Array.isArray(q.correctAnswer)
                        ? (q.correctAnswer as number[])
                        : [];
                      onUpdate({
                        ...q,
                        correctAnswer: cur.includes(optIdx)
                          ? cur.filter((i) => i !== optIdx)
                          : [...cur, optIdx],
                      });
                    } else {
                      onUpdate({ ...q, correctAnswer: optIdx });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    isCorrect
                      ? CORRECT_ANSWER_CARD_CLASS
                      : "bg-muted/40 border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${CORRECT_ANSWER_CHIP_CLASS} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const opts = [...(q.options || [])];
                      opts[optIdx] = e.target.value;
                      onUpdate({ ...q, options: opts });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                    className="flex-1 min-w-0 bg-transparent focus:outline-none text-foreground"
                  />
                  {isCorrect &&
                    (isMulti ? (
                      <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-bold text-muted-foreground">Explanation / Solution Notes</label>
        <input
          type="text"
          value={String(q.explanation || "")}
          onChange={(e) => onUpdate({ ...q, explanation: e.target.value })}
          placeholder="Brief explanation for why this answer is correct..."
          className="w-full p-1.5 bg-card border border-border rounded text-[11px]"
        />
      </div>
    </div>
  );
}
