import { AlertCircle, AlertTriangle, Check, Download, Save, Sparkles, X } from "lucide-react";
import { AiResultView } from "./AiResultView";
import type { AIStudyAssistantController } from "./useAIStudyAssistant";

export function AiOutputPanel({ assistant }: { assistant: AIStudyAssistantController }) {
  const {
    mode,
    generatedOutput,
    isGenerating,
    isSavingResource,
    errorMsg,
    savedSuccess,
    savedDrafts,
    saveSuccessMsg,
    titleExists,
    editTitle,
    setEditTitle,
    handleDownloadResource,
    saveDestinationLabel,
    handleSaveResource,
    handleDiscardResource,
  } = assistant;

  const isSaved = savedSuccess || savedDrafts[mode];

  return (
    <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-xs flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-foreground whitespace-nowrap">Generated Output</h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {generatedOutput && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(mode === "reviewer" || mode === "summary" || mode === "quiz") && (
                <button
                  onClick={() => handleDownloadResource()}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cta-gradient hover:brightness-110 text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  title={`Download ${mode === "reviewer" ? "Reviewer" : mode === "quiz" ? "Quiz" : "Summary"} as a PDF document`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download {mode === "reviewer" ? "Reviewer" : mode === "quiz" ? "Quiz" : "Summary"} (PDF)</span>
                </button>
              )}

              <button
                onClick={handleSaveResource}
                disabled={isSaved || isSavingResource}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer ${
                  isSaved
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{isSavingResource ? "Saving..." : isSaved ? "Saved ✓" : saveDestinationLabel}</span>
              </button>

              {!isSaved && (
                <button
                  onClick={handleDiscardResource}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Discard this draft. Nothing is saved until you press Save."
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>
              )}
            </div>
          )}

          {saveSuccessMsg && savedSuccess && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{saveSuccessMsg}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 p-5 space-y-4 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto">
        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!generatedOutput && !isGenerating && !errorMsg && (
          <div className="py-20 text-center text-muted-foreground space-y-2">
            <Sparkles className="w-10 h-10 text-primary mx-auto opacity-50" />
            <p className="text-sm font-bold text-foreground">No output generated yet</p>
            <p className="text-xs">Enter a prompt and click "Generate Resource" to build quizzes or summaries.</p>
          </div>
        )}

        {isGenerating && (
          <div className="py-20 text-center text-primary space-y-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-bold text-foreground">
              Generating your study resource... This may take a few minutes.
            </p>
          </div>
        )}

        {generatedOutput && (
          <div className="space-y-6">
            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-foreground">Resource Title (Editable)</label>
              </div>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {titleExists && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    A quiz with this title already exists in your library — consider renaming it before saving.
                  </span>
                </div>
              )}
            </div>

            <AiResultView mode={mode} output={generatedOutput} />
          </div>
        )}
      </div>
    </div>
  );
}
