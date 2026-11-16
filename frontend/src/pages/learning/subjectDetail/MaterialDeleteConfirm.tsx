import type { LearningMaterial } from "../../../types";

interface MaterialDeleteConfirmProps {
  material: LearningMaterial;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MaterialDeleteConfirm({ material, onCancel, onConfirm }: MaterialDeleteConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-foreground">Delete this material?</h3>
        <p className="text-xs text-muted-foreground">
          "{material.title}" will be permanently removed from this subject.
        </p>
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
