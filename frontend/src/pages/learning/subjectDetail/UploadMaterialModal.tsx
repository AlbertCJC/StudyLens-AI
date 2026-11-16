import { X } from "lucide-react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

interface UploadMaterialModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setFile: (file: File | null) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  rawText: string;
  setRawText: (value: string) => void;
  uploading: boolean;
  discardOpen: boolean;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
}

export function UploadMaterialModal({
  open,
  onClose,
  onSubmit,
  setFile,
  title,
  setTitle,
  description,
  setDescription,
  rawText,
  setRawText,
  uploading,
  discardOpen,
  onConfirmDiscard,
  onCancelDiscard,
}: UploadMaterialModalProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-foreground">Upload Material</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-foreground mb-1">File (PDF, DOCX, PPTX, TXT)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const selected = e.target.files[0];
                    setFile(selected);
                    setRawText("");
                    setTitle(selected.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
                className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Graph Algorithms Lecture Notes"
                className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the material..."
                className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Or paste lecture text</label>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste text content to create a text-based study material..."
                className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {discardOpen && (
        <ConfirmDialog
          open={discardOpen}
          title="Discard changes?"
          message="You have unsaved changes to this material upload. Are you sure you want to discard them?"
          confirmLabel="Discard"
          onConfirm={onConfirmDiscard}
          onCancel={onCancelDiscard}
        />
      )}
    </>
  );
}
