import React from "react";
import { Search } from "lucide-react";
import { actionLabel, ACTION_GROUPS, MODERATION_FILTER } from "./adminDashboardUtils";

interface LogFiltersBarProps {
  searchLog: string;
  setSearchLog: (value: string) => void;
  selectedActionFilter: string;
  setSelectedActionFilter: (value: string) => void;
  selectedLogRoleFilter: string;
  setSelectedLogRoleFilter: (value: string) => void;
}

export const LogFiltersBar: React.FC<LogFiltersBarProps> = ({
  searchLog,
  setSearchLog,
  selectedActionFilter,
  setSelectedActionFilter,
  selectedLogRoleFilter,
  setSelectedLogRoleFilter,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-2xl border border-border">
    <div className="relative">
      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
      <input
        type="text"
        value={searchLog}
        onChange={(e) => setSearchLog(e.target.value)}
        placeholder="Search action, user, IP, or keyword..."
        className="w-full pl-9 pr-3 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
      />
    </div>

    <div>
      <select
        value={selectedActionFilter}
        onChange={(e) => setSelectedActionFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
      >
        <option value="all">All Action Categories</option>
        {ACTION_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.codes.map((code) => (
              <option key={code} value={code}>
                {actionLabel(code)}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Content Moderation">
          <option value={MODERATION_FILTER}>Learning Materials Moderation</option>
        </optgroup>
      </select>
    </div>

    <div>
      <select
        value={selectedLogRoleFilter}
        onChange={(e) => setSelectedLogRoleFilter(e.target.value)}
        className="w-full p-2 bg-card border border-border rounded-xl text-xs text-foreground font-semibold focus:outline-none"
      >
        <option value="all">All Roles (Students, Teachers, Admins)</option>
        <option value="student">Student Role</option>
        <option value="teacher">Faculty / Teacher Role</option>
        <option value="admin">Administrator Role</option>
      </select>
    </div>
  </div>
);
