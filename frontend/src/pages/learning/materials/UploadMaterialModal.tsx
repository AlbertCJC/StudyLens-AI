import { FileText, Upload, X } from "lucide-react";
import type { Subject } from "../../../types";

interface UploadMaterialModalProps {
  subjects: Subject[];
  title: string;
  description: string;
  subjectId: string;
  rawText: string;
  file: File | null;
  isUploading: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubjectIdChange: (value: string) => void;
  onRawTextChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function UploadMaterialModal({
  subjects,
  title,
  description,
  subjectId,
  rawText,
  file,
  isUploading,
  onTitleChange,
  onDescriptionChange,
  onSubjectIdChange,
  onRawTextChange,
  onFileChange,
  onSubmit,
  onClose,
}: UploadMaterialModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-3xl w-full shadow-xl my-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground truncate">Upload Course Material</h3>
              <p className="text-xs text-muted-foreground truncate">Publish lecture files (PDF, DOCX, PPTX, TXT) for student access.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs p-6">
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="e.g., Module 4: Relational Algebra & Normalization"
                className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-foreground mb-1">Assigned Course Subject</label>
              <select
                value={subjectId}
                onChange={(e) => onSubjectIdChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card text-foreground"
              >
                <option value="">No Subject Assigned</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Leave as "No Subject Assigned" for personal/self-study notes.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Description / Topic Notes</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Brief summary of lecture topics covered in this file..."
                className="w-full px-3 py-2 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <label className="block font-semibold text-foreground mb-1">Select File (PDF, DOCX, PPTX, TXT)</label>
              <div className="border-2 border-dashed border-border hover:border-blue-500 p-4 rounded-xl text-center bg-muted/30 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    onFileChange(selected);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileText className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-foreground">
                  {file ? file.name : "Click or drag & drop lecture file here"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF, DOCX, PPTX, TXT format supported"}
                </p>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">OR Paste Lecture Text directly</label>
              <textarea
                rows={2}
                value={rawText}
                onChange={(e) => onRawTextChange(e.target.value)}
                placeholder="Paste raw lecture content or textbook notes here..."
                className="w-full px-3 py-1.5 border border-border bg-muted/40 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>
                {isUploading
                  ? "Extracting Text & Processing..."
                  : "Publish Course Material to Students"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
