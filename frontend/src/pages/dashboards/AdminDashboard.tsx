import React from "react";
import { useAdminDashboard } from "./adminDashboard/useAdminDashboard";
import { AdminHeaderToolbar } from "./adminDashboard/AdminHeaderToolbar";
import { AdminOverviewTab } from "./adminDashboard/AdminOverviewTab";
import { AdminLogsTab } from "./adminDashboard/AdminLogsTab";
import { UserDirectoryTable } from "./adminDashboard/UserDirectoryTable";
import { SubjectCatalog } from "./adminDashboard/SubjectCatalog";
import { AnnouncementsList } from "./adminDashboard/AnnouncementsList";
import { SystemSettings } from "./adminDashboard/SystemSettings";
import { AdminModals } from "./adminDashboard/AdminModals";
import { AdminUserDetailCard } from "./adminDashboard/AdminUserDetailCard";
import { AdminSubjectDetailCard } from "./adminDashboard/AdminSubjectDetailCard";

interface AdminDashboardProps {
  defaultTab?: "overview" | "logs" | "users" | "announcements" | "settings" | "subjects";
  hideTabs?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = "overview", hideTabs = false }) => {
  const page = useAdminDashboard(defaultTab);

  const {
    currentUser,
    navigate,
    setEditingUser,
    setShowAddUserModal,
    setShowAnnounceModal,
    setSelectedLogModal,
    setLogPage,
    setSearchLog,
    setSelectedActionFilter,
    setSelectedLogRoleFilter,
    detailCard,
    setDetailCard,
    handleCreateUser,
    handleOpenEditUser,
    handleSaveUserEdit,
    handleToggleUserStatus,
    handleDeleteUser,
    handleResetPassword,
    handlePostAnnouncement,
    handleOpenEditAnn,
    handleSaveAnnEdit,
    handleDeleteAnnouncement,
    confirmDeleteAnnouncement,
    handleOpenAddSubject,
    handleOpenEditSubject,
    handleSaveSubject,
    handleDeleteSubject,
    handleOpenRoster,
    handleAssignStudents,
    handleRemoveRosterStudent,
    handleClearAuditLogs,
    handleExportLogsCSV,
    handleSaveSettings,
    handleResetSettings,
    handleExportSystemBackup,
  } = page;

  const onAddUser = () => {
    setEditingUser(null);
    page.setNewUserName("");
    page.setNewUserEmail("");
    page.setNewUserRole("student");
    page.setNewUserDept("Computer Science");
    setShowAddUserModal(true);
  };

  const onBroadcast = () => {
    page.setAnnTitle("");
    page.setAnnContent("");
    page.setAnnSubjectId("");
    setShowAnnounceModal(true);
  };

  return (
    <div className="space-y-6">
      <AdminHeaderToolbar
        currentUser={currentUser}
        hideTabs={hideTabs}
        activeTab={page.activeTab}
        onAddUser={onAddUser}
        onBroadcast={onBroadcast}
      />

      {page.activeTab === "overview" && (
        <AdminOverviewTab
          users={page.users}
          subjects={page.subjects}
          logsTotal={page.logsTotal}
          logs={page.logs}
          onDetailUsers={() => setDetailCard("users")}
          onDetailSubjects={() => setDetailCard("subjects")}
          onActivityLogs={() => navigate("/activity-logs")}
          onLogClick={setSelectedLogModal}
          announcements={page.globalAnnouncements}
          onBroadcast={onBroadcast}
          onManage={() => page.setActiveTab("announcements")}
        />
      )}

      {page.activeTab === "logs" && (
        <AdminLogsTab
          loadingLogs={page.loadingLogs}
          exportingLogs={page.exportingLogs}
          lastRefreshed={page.lastRefreshed}
          logs={page.logs}
          logsTotal={page.logsTotal}
          logPage={page.logPage}
          onRefresh={() => page.fetchLogs(page.logPage, 10)}
          onExport={handleExportLogsCSV}
          onClear={handleClearAuditLogs}
          searchLog={page.searchLog}
          setSearchLog={setSearchLog}
          selectedActionFilter={page.selectedActionFilter}
          setSelectedActionFilter={setSelectedActionFilter}
          selectedLogRoleFilter={page.selectedLogRoleFilter}
          setSelectedLogRoleFilter={setSelectedLogRoleFilter}
          onLogClick={setSelectedLogModal}
          setLogPage={setLogPage}
        />
      )}

      {page.activeTab === "users" && (
        <UserDirectoryTable
          pagedUsers={page.pagedUsers}
          filteredUsers={page.filteredUsers}
          userPage={page.userPage}
          setUserPage={page.setUserPage}
          searchUser={page.searchUser}
          setSearchUser={page.setSearchUser}
          selectedUserRoleFilter={page.selectedUserRoleFilter}
          setSelectedUserRoleFilter={page.setSelectedUserRoleFilter}
          selectedUserStatusFilter={page.selectedUserStatusFilter}
          setSelectedUserStatusFilter={page.setSelectedUserStatusFilter}
          handleToggleUserStatus={handleToggleUserStatus}
          handleOpenEditUser={handleOpenEditUser}
          handleResetPassword={handleResetPassword}
          handleDeleteUser={handleDeleteUser}
        />
      )}

      {page.activeTab === "subjects" && (
        <SubjectCatalog
          subjects={page.subjects}
          teachers={page.teachers}
          onAddSubject={handleOpenAddSubject}
          onEditSubject={handleOpenEditSubject}
          onOpenRoster={handleOpenRoster}
          onDeleteSubject={handleDeleteSubject}
        />
      )}

      {page.activeTab === "announcements" && (
        <AnnouncementsList
          announcements={page.globalAnnouncements}
          onEditAnn={handleOpenEditAnn}
          onDeleteAnnouncement={handleDeleteAnnouncement}
        />
      )}

      {page.activeTab === "settings" && (
        <SystemSettings
          systemSettings={page.systemSettings}
          setSystemSettings={page.setSystemSettings}
          settingsSavedMessage={page.settingsSavedMessage}
          settingsSavedAt={page.settingsSavedAt}
          savingSettings={page.savingSettings}
          backupLoading={page.backupLoading}
          handleSaveSettings={handleSaveSettings}
          handleResetSettings={handleResetSettings}
          handleExportSystemBackup={handleExportSystemBackup}
        />
      )}

      <AdminModals
        page={page}
        handleCreateUser={handleCreateUser}
        handleSaveUserEdit={handleSaveUserEdit}
        handleSaveSubject={handleSaveSubject}
        handleAssignStudents={handleAssignStudents}
        handleRemoveRosterStudent={handleRemoveRosterStudent}
        handlePostAnnouncement={handlePostAnnouncement}
        handleSaveAnnEdit={handleSaveAnnEdit}
        confirmDeleteAnnouncement={confirmDeleteAnnouncement}
      />

      <AdminUserDetailCard
        open={detailCard === "users"}
        users={page.users}
        onClose={() => setDetailCard(null)}
        onRoleClick={(role) => {
          setDetailCard(null);
          navigate(`/users?role=${role}`);
        }}
        onSuspendedClick={() => {
          setDetailCard(null);
          navigate("/users?status=suspended");
        }}
      />

      <AdminSubjectDetailCard
        open={detailCard === "subjects"}
        subjects={page.subjects}
        onClose={() => setDetailCard(null)}
        onSubjectClick={(id) => {
          setDetailCard(null);
          navigate(`/subjects/${id}`);
        }}
      />
    </div>
  );
};
