import React from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { UserRole } from "../../../types";
import { PasswordRequirements } from "../../../components/PasswordRequirements";

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  newUserName: string;
  setNewUserName: (value: string) => void;
  newUserEmail: string;
  setNewUserEmail: (value: string) => void;
  newUserRole: UserRole;
  setNewUserRole: (value: UserRole) => void;
  newUserDept: string;
  setNewUserDept: (value: string) => void;
  newUserPassword: string;
  setNewUserPassword: (value: string) => void;
  newUserConfirmPassword: string;
  setNewUserConfirmPassword: (value: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const passwordInput = ({
  value,
  onChange,
  showPassword,
  setShowPassword,
  label,
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  label: string;
  placeholder: string;
}) => (
  <div className="space-y-1.5">
    <label className="block font-bold mb-1">{label}</label>
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pr-10 p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    <PasswordRequirements password={value} />
  </div>
);

export const AddUserModal: React.FC<AddUserModalProps> = ({
  open,
  onClose,
  newUserName,
  setNewUserName,
  newUserEmail,
  setNewUserEmail,
  newUserRole,
  setNewUserRole,
  newUserDept,
  setNewUserDept,
  newUserPassword,
  setNewUserPassword,
  newUserConfirmPassword,
  setNewUserConfirmPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Add New User Account</h3>
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
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="e.g. Dr. Jane Doe"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Email Address</label>
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="j.doe@studylens.edu"
              className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Role Designation</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground font-semibold focus:outline-none"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher / Faculty</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1">Department</label>
              <input
                type="text"
                value={newUserDept}
                onChange={(e) => setNewUserDept(e.target.value)}
                placeholder="College of Computer Studies"
                className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>
          </div>

          {passwordInput({
            value: newUserPassword,
            onChange: (e) => setNewUserPassword(e.target.value),
            showPassword: showNewPassword,
            setShowPassword: setShowNewPassword,
            label: "Password",
            placeholder: "••••••••",
          })}

          {passwordInput({
            value: newUserConfirmPassword,
            onChange: (e) => setNewUserConfirmPassword(e.target.value),
            showPassword: showConfirmPassword,
            setShowPassword: setShowConfirmPassword,
            label: "Confirm Password",
            placeholder: "••••••••",
          })}

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
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
