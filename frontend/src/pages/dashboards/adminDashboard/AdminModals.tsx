import React from "react";

import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";
import { SubjectModal } from "./SubjectModal";
import { ClassRosterModal } from "./ClassRosterModal";
import { BroadcastAnnouncementModal } from "./BroadcastAnnouncementModal";
import { EditAnnouncementModal } from "./EditAnnouncementModal";
import { LogInspectionModal } from "./LogInspectionModal";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

export type AdminModalsPage = Pick<
  ReturnType<typeof import("./useAdminDashboard").useAdminDashboard>,
  | "showAddUserModal"
  | "setShowAddUserModal"
  | "newUserName"
  | "setNewUserName"
  | "newUserEmail"
  | "setNewUserEmail"
  | "newUserRole"
  | "setNewUserRole"
  | "newUserDept"
  | "setNewUserDept"
  | "editingUser"
  | "setEditingUser"
  | "editUserName"
  | "setEditUserName"
  | "editUserRole"
  | "setEditUserRole"
  | "editUserDept"
  | "setEditUserDept"
  | "editUserStatus"
  | "setEditUserStatus"
  | "showSubjectModal"
  | "setShowSubjectModal"
  | "editingSubject"
  | "subCode"
  | "setSubCode"
  | "subName"
  | "setSubName"
  | "subDesc"
  | "setSubDesc"
  | "subTeacherId"
  | "setSubTeacherId"
  | "subSemester"
  | "setSubSemester"
  | "subCourse"
  | "setSubCourse"
  | "subYear"
  | "setSubYear"
  | "teachers"
  | "subMsg"
  | "rosterSubject"
  | "setRosterSubject"
  | "rosterStudents"
  | "users"
  | "assignStudentIds"
  | "setAssignStudentIds"
  | "assignFilter"
  | "setAssignFilter"
  | "assignSearch"
  | "setAssignSearch"
  | "rosterLoading"
  | "rosterMsg"
  | "showAnnounceModal"
  | "setShowAnnounceModal"
  | "subjects"
  | "annTitle"
  | "setAnnTitle"
  | "annContent"
  | "setAnnContent"
  | "annAudience"
  | "setAnnAudience"
  | "annPriority"
  | "setAnnPriority"
  | "annSubjectId"
  | "setAnnSubjectId"
  | "editingAnn"
  | "setEditingAnn"
  | "editAnnTitle"
  | "setEditAnnTitle"
  | "editAnnContent"
  | "setEditAnnContent"
  | "editAnnAudience"
  | "setEditAnnAudience"
  | "editAnnPriority"
  | "setEditAnnPriority"
  | "selectedLogModal"
  | "setSelectedLogModal"
  | "showToast"
  | "annToDelete"
  | "setAnnToDelete"
>;

interface AdminModalsProps {
  page: AdminModalsPage;
  handleCreateUser: (e: React.FormEvent) => void;
  handleSaveUserEdit: (e: React.FormEvent) => void;
  handleSaveSubject: (e: React.FormEvent) => void;
  handleAssignStudents: () => void;
  handleRemoveRosterStudent: (id: string) => void;
  handlePostAnnouncement: (e: React.FormEvent) => void;
  handleSaveAnnEdit: (e: React.FormEvent) => void;
  confirmDeleteAnnouncement: () => void;
}

export const AdminModals: React.FC<AdminModalsProps> = ({
  page,
  handleCreateUser,
  handleSaveUserEdit,
  handleSaveSubject,
  handleAssignStudents,
  handleRemoveRosterStudent,
  handlePostAnnouncement,
  handleSaveAnnEdit,
  confirmDeleteAnnouncement,
}) => {
  const {
    showAddUserModal,
    setShowAddUserModal,
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
    editingUser,
    setEditingUser,
    editUserName,
    setEditUserName,
    editUserRole,
    setEditUserRole,
    editUserDept,
    setEditUserDept,
    editUserStatus,
    setEditUserStatus,
    showSubjectModal,
    setShowSubjectModal,
    editingSubject,
    subCode,
    setSubCode,
    subName,
    setSubName,
    subDesc,
    setSubDesc,
    subTeacherId,
    setSubTeacherId,
    subSemester,
    setSubSemester,
    subCourse,
    setSubCourse,
    subYear,
    setSubYear,
    teachers,
    subMsg,
    rosterSubject,
    setRosterSubject,
    rosterStudents,
    users,
    assignStudentIds,
    setAssignStudentIds,
    assignFilter,
    setAssignFilter,
    assignSearch,
    setAssignSearch,
    rosterLoading,
    rosterMsg,
    showAnnounceModal,
    setShowAnnounceModal,
    subjects,
    annTitle,
    setAnnTitle,
    annContent,
    setAnnContent,
    annAudience,
    setAnnAudience,
    annPriority,
    setAnnPriority,
    annSubjectId,
    setAnnSubjectId,
    editingAnn,
    setEditingAnn,
    editAnnTitle,
    setEditAnnTitle,
    editAnnContent,
    setEditAnnContent,
    editAnnAudience,
    setEditAnnAudience,
    editAnnPriority,
    setEditAnnPriority,
    selectedLogModal,
    setSelectedLogModal,
    showToast,
    annToDelete,
    setAnnToDelete,
  } = page;

  return (
    <>
      {showAddUserModal && (
        <AddUserModal
          open={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          newUserName={newUserName}
          setNewUserName={setNewUserName}
          newUserEmail={newUserEmail}
          setNewUserEmail={setNewUserEmail}
          newUserRole={newUserRole}
          setNewUserRole={setNewUserRole}
          newUserDept={newUserDept}
          setNewUserDept={setNewUserDept}
          newUserPassword={newUserPassword}
          setNewUserPassword={setNewUserPassword}
          newUserConfirmPassword={newUserConfirmPassword}
          setNewUserConfirmPassword={setNewUserConfirmPassword}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          onSubmit={handleCreateUser}
        />
      )}

      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          editingUser={editingUser}
          editUserName={editUserName}
          setEditUserName={setEditUserName}
          editUserRole={editUserRole}
          setEditUserRole={setEditUserRole}
          editUserDept={editUserDept}
          setEditUserDept={setEditUserDept}
          editUserStatus={editUserStatus}
          setEditUserStatus={setEditUserStatus}
          onSubmit={handleSaveUserEdit}
        />
      )}

      {showSubjectModal && (
        <SubjectModal
          open={showSubjectModal}
          onClose={() => setShowSubjectModal(false)}
          editingSubject={editingSubject}
          subCode={subCode}
          setSubCode={setSubCode}
          subName={subName}
          setSubName={setSubName}
          subDesc={subDesc}
          setSubDesc={setSubDesc}
          subTeacherId={subTeacherId}
          setSubTeacherId={setSubTeacherId}
          subSemester={subSemester}
          setSubSemester={setSubSemester}
          subCourse={subCourse}
          setSubCourse={setSubCourse}
          subYear={subYear}
          setSubYear={setSubYear}
          teachers={teachers}
          subMsg={subMsg}
          onSubmit={handleSaveSubject}
        />
      )}

      {rosterSubject && (
        <ClassRosterModal
          open={!!rosterSubject}
          onClose={() => setRosterSubject(null)}
          rosterSubject={rosterSubject}
          rosterStudents={rosterStudents}
          users={users}
          assignStudentIds={assignStudentIds}
          setAssignStudentIds={setAssignStudentIds}
          assignFilter={assignFilter}
          setAssignFilter={setAssignFilter}
          assignSearch={assignSearch}
          setAssignSearch={setAssignSearch}
          rosterLoading={rosterLoading}
          rosterMsg={rosterMsg}
          handleAssignStudents={handleAssignStudents}
          handleRemoveRosterStudent={handleRemoveRosterStudent}
        />
      )}

      {showAnnounceModal && (
        <BroadcastAnnouncementModal
          open={showAnnounceModal}
          onClose={() => setShowAnnounceModal(false)}
          subjects={subjects}
          annTitle={annTitle}
          setAnnTitle={setAnnTitle}
          annContent={annContent}
          setAnnContent={setAnnContent}
          annAudience={annAudience}
          setAnnAudience={setAnnAudience}
          annPriority={annPriority}
          setAnnPriority={setAnnPriority}
          annSubjectId={annSubjectId}
          setAnnSubjectId={setAnnSubjectId}
          onSubmit={handlePostAnnouncement}
        />
      )}

      {editingAnn && (
        <EditAnnouncementModal
          open={!!editingAnn}
          onClose={() => setEditingAnn(null)}
          editingAnn={editingAnn}
          editAnnTitle={editAnnTitle}
          setEditAnnTitle={setEditAnnTitle}
          editAnnContent={editAnnContent}
          setEditAnnContent={setEditAnnContent}
          editAnnAudience={editAnnAudience}
          setEditAnnAudience={setEditAnnAudience}
          editAnnPriority={editAnnPriority}
          setEditAnnPriority={setEditAnnPriority}
          onSubmit={handleSaveAnnEdit}
        />
      )}

      {selectedLogModal && (
        <LogInspectionModal
          open={!!selectedLogModal}
          onClose={() => setSelectedLogModal(null)}
          log={selectedLogModal}
          showToast={showToast}
        />
      )}

      <ConfirmDialog
        open={annToDelete !== null}
        title="Delete Bulletin"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmLabel="Yes, Delete"
        destructive
        onConfirm={confirmDeleteAnnouncement}
        onCancel={() => setAnnToDelete(null)}
      />
    </>
  );
};
