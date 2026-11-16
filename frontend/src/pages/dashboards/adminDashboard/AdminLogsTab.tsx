import React from "react";
import { AdminLogsToolbar } from "./AdminLogsToolbar";
import { LogFiltersBar } from "./LogFiltersBar";
import { ActivityLogsTable } from "./ActivityLogsTable";
import type { ActivityLog } from "../../../types";

interface AdminLogsTabProps {
  loadingLogs: boolean;
  exportingLogs: boolean;
  lastRefreshed: string;
  logs: ActivityLog[];
  logsTotal: number;
  logPage: number;
  onRefresh: () => void;
  onExport: () => void;
  onClear: () => void;
  searchLog: string;
  setSearchLog: (value: string) => void;
  selectedActionFilter: string;
  setSelectedActionFilter: (value: string) => void;
  selectedLogRoleFilter: string;
  setSelectedLogRoleFilter: (value: string) => void;
  onLogClick: (log: ActivityLog) => void;
  setLogPage: (page: number) => void;
}

export const AdminLogsTab: React.FC<AdminLogsTabProps> = ({
  loadingLogs,
  exportingLogs,
  lastRefreshed,
  logs,
  logsTotal,
  logPage,
  onRefresh,
  onExport,
  onClear,
  searchLog,
  setSearchLog,
  selectedActionFilter,
  setSelectedActionFilter,
  selectedLogRoleFilter,
  setSelectedLogRoleFilter,
  onLogClick,
  setLogPage,
}) => (
  <>
    <AdminLogsToolbar
      loadingLogs={loadingLogs}
      exportingLogs={exportingLogs}
      lastRefreshed={lastRefreshed}
      onRefresh={onRefresh}
      onExport={onExport}
      onClear={onClear}
    />
    <LogFiltersBar
      searchLog={searchLog}
      setSearchLog={setSearchLog}
      selectedActionFilter={selectedActionFilter}
      setSelectedActionFilter={setSelectedActionFilter}
      selectedLogRoleFilter={selectedLogRoleFilter}
      setSelectedLogRoleFilter={setSelectedLogRoleFilter}
    />
    <ActivityLogsTable
      logs={logs}
      loadingLogs={loadingLogs}
      logsTotal={logsTotal}
      logPage={logPage}
      setLogPage={setLogPage}
      onLogClick={onLogClick}
    />
  </>
);
