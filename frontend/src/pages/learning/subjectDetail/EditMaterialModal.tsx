import { X } from "lucide-react";

interface EditMaterialModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  rawText: string;
  setRawText: (value: string) => void;
  saving: boolean;
}

export function EditMaterialModal({
  open,
  onClose,
  onSubmit,
  title,
  setTitle,
  description,
  setDescription,
  rawText,
  setRawText,
  saving,
}: EditMaterialModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl border border-border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-foreground">Edit Material</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Graph Algorithms Lecture Notes"
              className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of the material..."
              className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
            ></textarea>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">Text content</label>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste or edit the text content used for study..."
              className="w-full px-3 py-2 border border-border bg-muted/40 text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
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
              disabled={saving}
              className="px-4 py-2 bg-cta-gradient hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs cursor-pointer"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
