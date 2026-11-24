import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  CheckSquare,
  FileText,
  Layers,
  Plus,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import type { AIMode } from "../../utils/aiWorkspaceCache";
import { MAX_AI_FLASHCARDS, MAX_AI_QUESTIONS } from "./aiLimits";
import { offlineBannerMessage } from "./aiUtils";
import type { AIStudyAssistantController } from "./useAIStudyAssistant";

const modes: Array<{ value: AIMode; label: string; icon: typeof CheckSquare }> = [
  { value: "quiz", label: "Quiz", icon: CheckSquare },
  { value: "flashcards", label: "Flashcards", icon: Layers },
  { value: "summary", label: "Summary", icon: FileText },
  { value: "reviewer", label: "Reviewer", icon: BookOpen },
];

export function AiInputsPanel({ assistant }: { assistant: AIStudyAssistantController }) {
  const {
    promptInputRef,
    sourceText,
    setSourceText,
    prompt,
    setPrompt,
    mode,
    uploadedFile,
    setUploadedFile,
    uploadedFileName,
    setUploadedFileName,
    isUploadingFile,
    uploadSuccessMsg,
    setUploadSuccessMsg,
    flashcardCount,
    setFlashcardCount,
    quizCounts,
    setQuizCounts,
    isGenerating,
    offlineNotice,
    offlineReason,
    showAttachMenu,
    setShowAttachMenu,
    setSelectedMaterialId,
    handleModeSelect,
    handleCancelGenerate,
    handleDirectFileUpload,
    handleGenerate,
  } = assistant;

  const quizCountFields: {
    key: "multiple_choice" | "identification" | "true_false";
    label: string;
    shortLabel: string;
  }[] = [
    { key: "multiple_choice", label: "Multiple Choice", shortLabel: "MCQ" },
    { key: "identification", label: "Identification", shortLabel: "ID" },
    { key: "true_false", label: "True / False", shortLabel: "T/F" },
  ];

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-xs space-y-5">
      <h3 className="text-sm font-bold text-foreground border-b border-border pb-2">Inputs</h3>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-foreground">Format</label>
        <div className="grid grid-cols-2 gap-2">
          {modes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleModeSelect(value)}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                mode === value
                  ? "bg-primary/10 border-primary text-primary shadow-2xs"
                  : "bg-muted/40 border-border text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 text-primary" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="space-y-2">
          {isUploadingFile ? (
            <div className="border-2 border-dashed border-primary bg-structure/50  rounded-xl p-4 text-center transition-all relative">
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="p-2.5 bg-structure-strong text-primary dark:text-indigo-300 rounded-full animate-bounce">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-bold text-foreground text-xs">Extracting & Processing Material...</p>
              </div>
            </div>
          ) : uploadedFile || uploadSuccessMsg ? (
            <div className="flex items-center justify-between gap-2 border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-3 transition-all relative">
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-xs truncate">{uploadedFile?.name || uploadedFileName || "Uploaded Document"}</p>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                    <Check className="w-3 h-3" /> Extracted & Ready {sourceText ? `(${sourceText.length} chars)` : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                <label className="px-2.5 py-1.5 bg-card hover:bg-muted border border-border text-foreground text-[11px] font-semibold rounded-lg cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center space-x-1">
                  <span>Change</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                    onChange={handleDirectFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFile(null);
                    setUploadedFileName(null);
                    setUploadSuccessMsg(null);
                    setSourceText("");
                    setSelectedMaterialId("");
                  }}
                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {mode === "flashcards" && (
          <div>
            <label className="block font-semibold text-foreground mb-1">Number of Flashcards</label>
            <input
              type="number"
              min={1}
              max={MAX_AI_FLASHCARDS}
              value={flashcardCount}
              onChange={(e) => setFlashcardCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isGenerating) handleGenerate();
              }}
              className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Maximum {MAX_AI_FLASHCARDS} flashcards per request.
            </p>
          </div>
        )}

        {mode === "quiz" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block font-semibold text-foreground">Questions by Type</label>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Optional</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {quizCountFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 flex items-center justify-between gap-1 text-[10px] font-bold text-muted-foreground">
                    <span className="truncate">{field.label}</span>
                    <span className="text-primary">{field.shortLabel}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={MAX_AI_QUESTIONS}
                    inputMode="numeric"
                    value={quizCounts[field.key]}
                    onChange={(e) =>
                      setQuizCounts((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isGenerating) handleGenerate();
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl font-bold text-foreground"
                  />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave these blank to use the prompt, or default to 5 multiple-choice questions. Maximum {MAX_AI_QUESTIONS} total.
            </p>
          </div>
        )}

        <div>
          <label className="block font-semibold text-foreground mb-1">Prompt</label>
          <div className="flex items-stretch gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu((v) => !v)}
                className="w-10 h-full min-h-[36px] flex items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted hover:border-primary/50 transition-all cursor-pointer"
                title="Attach a file"
              >
                <Plus className="w-5 h-5" />
              </button>
              {showAttachMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-[180px] space-y-0.5 animate-in fade-in zoom-in-95">
                  <label className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-all font-semibold text-foreground">
                    <UploadCloud className="w-4 h-4 text-primary" />
                    <span>Attach File</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        setShowAttachMenu(false);
                        handleDirectFileUpload(e);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
            <input
              type="text"
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isGenerating) handleGenerate();
              }}
              placeholder="Describe the topic or add instructions..."
              className="flex-1 min-w-0 px-3 py-2 border border-border bg-muted/40 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!sourceText?.trim() && !prompt.trim())}
          className="w-full py-3 bg-cta-gradient hover:brightness-110 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{isGenerating ? "Generating your study resource..." : "Generate Resource"}</span>
        </button>
        {isGenerating && (
          <button
            type="button"
            onClick={handleCancelGenerate}
            className="w-full py-2 bg-muted/60 border border-border text-foreground font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Cancel Generation (Press Esc)</span>
          </button>
        )}
        {offlineNotice && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-[11px] font-semibold flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{offlineBannerMessage(offlineReason)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
