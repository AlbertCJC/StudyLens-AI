import React from "react";
import { Search } from "lucide-react";

interface UserFiltersBarProps {
  searchUser: string;
  setSearchUser: (value: string) => void;
  selectedUserRoleFilter: string;
  setSelectedUserRoleFilter: (value: string) => void;
  selectedUserStatusFilter: string;
  setSelectedUserStatusFilter: (value: string) => void;
}

export const UserFiltersBar: React.FC<UserFiltersBarProps> = ({
  searchUser,
  setSearchUser,
  selectedUserRoleFilter,
  setSelectedUserRoleFilter,
  selectedUserStatusFilter,
  setSelectedUserStatusFilter,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
    <div className="relative">
      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
      <input
        type="text"
        value={searchUser}
        onChange={(e) => setSearchUser(e.target.value)}
        placeholder="Search name, email, or department..."
        className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring font-medium"
      />
    </div>

    <div>
      <select
        value={selectedUserRoleFilter}
        onChange={(e) => setSelectedUserRoleFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs font-semibold focus:outline-none"
      >
        <option value="all">All Roles</option>
        <option value="student">Students</option>
        <option value="teacher">Faculty / Teachers</option>
        <option value="admin">Administrators</option>
      </select>
    </div>

    <div>
      <select
        value={selectedUserStatusFilter}
        onChange={(e) => setSelectedUserStatusFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs font-semibold focus:outline-none"
      >
        <option value="all">All Account Statuses</option>
        <option value="active">Active Only</option>
        <option value="suspended">Suspended Only</option>
      </select>
    </div>
  </div>
);
