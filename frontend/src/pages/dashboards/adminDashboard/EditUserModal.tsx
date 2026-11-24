import React from "react";
import { X } from "lucide-react";
import type { UserRole } from "../../../types";

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  editUserName: string;
  setEditUserName: (value: string) => void;
  editUserRole: UserRole;
  setEditUserRole: (value: UserRole) => void;
  editUserDept: string;
  setEditUserDept: (value: string) => void;
  editUserStatus: "active" | "suspended";
  setEditUserStatus: (value: "active" | "suspended") => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  open,
  onClose,
  editUserName,
  setEditUserName,
  editUserRole,
  setEditUserRole,
  editUserDept,
  setEditUserDept,
  editUserStatus,
  setEditUserStatus,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Edit User Account</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editUserName}
              onChange={(e) => setEditUserName(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Role Designation</label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Account Status</label>
              <select
                value={editUserStatus}
                onChange={(e) => setEditUserStatus(e.target.value as "active" | "suspended")}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Department</label>
            <input
              type="text"
              value={editUserDept}
              onChange={(e) => setEditUserDept(e.target.value)}
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-medium"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
