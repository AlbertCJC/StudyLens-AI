import React from "react";
import { Pagination } from "../../../components/Pagination";
import { Pencil, Key, Trash2 } from "lucide-react";
import { UserFiltersBar } from "./UserFiltersBar";
import type { User } from "../../../types";
import { avatarUrl } from "../../learning/subjectDetail/subjectDetailUtils";

interface UserDirectoryTableProps {
  pagedUsers: User[];
  filteredUsers: User[];
  userPage: number;
  setUserPage: (page: number) => void;
  handleToggleUserStatus: (user: User) => void;
  handleOpenEditUser: (user: User) => void;
  handleResetPassword: (user: User) => void;
  handleDeleteUser: (id: string) => void;
  searchUser: string;
  setSearchUser: (value: string) => void;
  selectedUserRoleFilter: string;
  setSelectedUserRoleFilter: (value: string) => void;
  selectedUserStatusFilter: string;
  setSelectedUserStatusFilter: (value: string) => void;
}

export const UserDirectoryTable: React.FC<UserDirectoryTableProps> = ({
  pagedUsers,
  filteredUsers,
  userPage,
  setUserPage,
  handleToggleUserStatus,
  handleOpenEditUser,
  handleResetPassword,
  handleDeleteUser,
  searchUser,
  setSearchUser,
  selectedUserRoleFilter,
  setSelectedUserRoleFilter,
  selectedUserStatusFilter,
  setSelectedUserStatusFilter,
}) => (
  <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-foreground">Institutional User Directory</h3>
      </div>
    </div>

    <UserFiltersBar
      searchUser={searchUser}
      setSearchUser={setSearchUser}
      selectedUserRoleFilter={selectedUserRoleFilter}
      setSelectedUserRoleFilter={setSelectedUserRoleFilter}
      selectedUserStatusFilter={selectedUserStatusFilter}
      setSelectedUserStatusFilter={setSelectedUserStatusFilter}
    />

    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="uppercase text-muted-foreground border-b border-border bg-muted/50 font-bold">
          <tr>
            <th className="p-3">User & Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Department</th>
            <th className="p-3">Account Status</th>
            <th className="p-3">Created</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {pagedUsers.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                No users match the current filters.
              </td>
            </tr>
          ) : (
            pagedUsers.map((u, index) => (
              <tr key={`${u.id}-${index}`} className="hover:bg-muted/20">
                <td className="p-3">
                  <span className="flex items-center gap-2.5">
                    {avatarUrl(u.avatar) ? (
                      <img
                        src={avatarUrl(u.avatar)!}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <p className="font-bold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{u.email}</p>
                      {u.studentId && (
                        <span className="text-[10px] text-slate-500 font-semibold">ID: {u.studentId}</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                      u.role === "admin"
                        ? "bg-structure text-primary dark:text-indigo-300"
                        : u.role === "teacher"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        : "bg-structure text-primary dark:text-indigo-300"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground font-semibold">{u.department || "General Studies"}</td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggleUserStatus(u)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                      u.status === "suspended"
                        ? "bg-structure text-primary border border-structure-strong"
                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                    }`}
                    title="Click to toggle account active/suspended state"
                  >
                    {u.status === "suspended" ? "● Suspended" : "● Active"}
                  </button>
                </td>
                <td className="p-3 font-mono text-[11px] text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-right space-x-1.5">
                  <button
                    onClick={() => handleOpenEditUser(u)}
                    className="p-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors cursor-pointer"
                    title="Edit User Profile"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleResetPassword(u)}
                    className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg transition-colors cursor-pointer"
                    title="Reset Password"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="p-1.5 bg-structure hover:bg-structure-strong text-primary rounded-lg transition-colors cursor-pointer"
                    title="Delete User Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <Pagination page={userPage} total={filteredUsers.length} onPageChange={setUserPage} />
  </div>
);
