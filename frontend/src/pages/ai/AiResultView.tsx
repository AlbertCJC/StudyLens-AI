import type { AIGeneratedResult, AIMode } from "../../utils/aiWorkspaceCache";

export function AiResultView({
  mode,
  output,
}: {
  mode: AIMode;
  output: AIGeneratedResult;
}) {
  if (mode === "quiz" && output.questions) {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Generated Quiz Questions ({output.questions.length})
        </h4>
        {output.questions.map((q, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">Question {idx + 1}</span>
            </div>
            <p className="font-bold text-foreground">{q.question}</p>
            {q.options && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {q.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`p-2 rounded-lg border text-[11px] ${
                      oIdx === q.correctAnswer
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + oIdx)}. {opt}
                  </div>
                ))}
              </div>
            )}
            {q.type === "identification" && q.correctAnswer && (
              <p className="text-[11px] pt-1">
                <strong className="text-emerald-600 dark:text-emerald-400">Answer:</strong>{" "}
                <span className="text-foreground">{String(q.correctAnswer)}</span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground pt-1">
              <strong className="text-foreground">Explanation:</strong> {q.explanation}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "flashcards" && output.cards) {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Generated Flashcards ({output.cards.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {output.cards.map((card, cIdx) => (
            <div key={cIdx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-primary uppercase">{cIdx + 1}.</span>
              <p className="font-bold text-foreground">{card.question}</p>
              <p className="text-muted-foreground pt-1 border-t border-border">{card.answer}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "summary") {
    return (
      <div className="space-y-4 text-xs leading-relaxed text-foreground">
        <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
          <h4 className="font-bold text-primary uppercase tracking-wider text-[11px]">Executive Summary</h4>
          <p>{output.executiveSummary}</p>
        </div>

        {output.keyTakeaways && (
          <div className="space-y-2">
            <h4 className="font-bold text-foreground text-xs">Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {output.keyTakeaways.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (mode === "reviewer") {
    return (
      <div className="space-y-4 text-xs leading-relaxed text-foreground">
        <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
          <h4 className="font-bold text-primary uppercase tracking-wider text-[11px]">Overview</h4>
          <p>{output.overview}</p>
        </div>

        {output.topics?.map((topic, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-border space-y-2">
            <h4 className="font-bold text-sm text-foreground">{topic.topic}</h4>
            <p className="text-muted-foreground">{topic.overview}</p>
            {topic.keyConcepts && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {topic.keyConcepts.map((kc, kIdx) => (
                  <span key={kIdx} className="px-2 py-0.5 bg-primary/10 text-primary rounded font-semibold text-[10px]">
                    {kc}
                  </span>
                ))}
              </div>
            )}

            {topic.sampleQuestions && topic.sampleQuestions.length > 0 && (
              <div className="pt-2 space-y-2">
                <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                  Sample Self-Check Questions
                </h5>
                {topic.sampleQuestions.map((sq, sIdx) => {
                  const questionText = typeof sq === "string" ? sq : sq?.question || "";
                  const answerText = typeof sq === "object" && sq ? sq.answer : "";
                  return (
                    <div key={sIdx} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
                      <p className="font-semibold text-foreground flex items-start space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px] mt-0.5 shrink-0">Q</span>
                        <span>{questionText}</span>
                      </p>
                      {answerText && (
                        <p className="text-muted-foreground pl-7 flex items-start space-x-1.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">A:</span>
                          <span>{answerText}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
