import React from "react";
import { FileCode } from "lucide-react";
import { useSubjectDetailPage } from "./subjectDetail/useSubjectDetailPage";
import { SubjectHeader } from "./subjectDetail/SubjectHeader";
import { SubjectTabs } from "./subjectDetail/SubjectTabs";
import { PeopleTab } from "./subjectDetail/PeopleTab";
import { MaterialsTab } from "./subjectDetail/MaterialsTab";
import { QuizzesTab } from "./subjectDetail/QuizzesTab";
import { AnnouncementsTab } from "./subjectDetail/AnnouncementsTab";
import { GradesTab } from "./subjectDetail/GradesTab";
import { UploadMaterialModal } from "./subjectDetail/UploadMaterialModal";
import { EditMaterialModal } from "./subjectDetail/EditMaterialModal";
import { AssignStudentsModal } from "./subjectDetail/AssignStudentsModal";
import { MaterialDeleteConfirm } from "./subjectDetail/MaterialDeleteConfirm";
import { QuizDeleteConfirm } from "./subjectDetail/QuizDeleteConfirm";
import { AnnouncementDeleteConfirm } from "./subjectDetail/AnnouncementDeleteConfirm";
import { FlagDialog } from "./subjectDetail/FlagDialog";
import { FlagHistoryModal } from "./subjectDetail/FlagHistoryModal";
import { ResolveFlagModal } from "./subjectDetail/ResolveFlagModal";
import { MaterialPreviewModal } from "./subjectDetail/MaterialPreviewModal";
import { QuizPreviewModal } from "./subjectDetail/QuizPreviewModal";
import { AnnouncementDetailModal } from "./subjectDetail/AnnouncementDetailModal";
import { QuizCreateModal } from "../../components/QuizCreateModal";
import { QuizEditorModal } from "./assessment/QuizEditorModal";
import { AnnouncementComposer } from "../../components/AnnouncementComposer";
import { flagsForMaterial } from "./subjectDetail/subjectDetailUtils";

export const SubjectDetailPage: React.FC = () => {
  const page = useSubjectDetailPage();
  const { currentUser, navigate, subjectId, subject, notFound, activeTab, setActiveTab, tabs, isStaff, canManage, subjectAnnouncements } = page;

  if (notFound) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <div className="bg-card rounded-2xl border border-border p-10">
          <FileCode className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-bold text-foreground mt-4">Subject not found</h2>
          <p className="text-xs text-muted-foreground mt-1">This subject may have been deleted, or you do not have permission to view it.</p>
          <button onClick={() => navigate("/subjects")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer">Back to Subjects</button>
        </div>
      </div>
    );
  }

  if (!subject) {
    return <div className="p-6 max-w-2xl mx-auto text-center"><p className="text-xs text-muted-foreground py-10">Loading subject workspace...</p></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <SubjectHeader subject={subject} isStaff={isStaff} navigate={navigate} />
      <SubjectTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "people" && <PeopleTab students={page.students} studentsLoading={page.studentsLoading} peoplePage={page.peoplePage} setPeoplePage={page.setPeoplePage} currentUser={currentUser} subject={subject} openAssignStudents={page.openAssignStudents} />}

      {activeTab === "materials" && (
        <MaterialsTab
          materials={page.materials}
          materialsLoading={page.materialsLoading}
          materialFlags={page.materialFlags}
          highlightMaterialId={page.highlightMaterialId}
          matPage={page.matPage}
          setMatPage={page.setMatPage}
          currentUser={currentUser}
          canManage={canManage}
          onUpload={() => page.setShowUploadModal(true)}
          onPreview={page.handleOpenMaterialPreview}
          onFlag={(mat) => { page.setFlagTarget(mat); page.setFlagCategory("Wrong file"); page.setFlagNote(""); }}
          onEdit={page.openEditMaterial}
          onDownload={page.handleDownload}
          onDelete={(mat) => page.setMaterialToDelete(mat)}
          onViewHistory={(mat) => page.setViewingFlags(mat)}
          onResolveFlag={(flag) => { page.setResolvingFlag(flag); page.setResolutionNote(""); }}
        />
      )}

      {activeTab === "quizzes" && (
        <QuizzesTab
          quizzes={page.quizzes}
          quizzesLoading={page.quizzesLoading}
          quizPage={page.quizPage}
          setQuizPage={page.setQuizPage}
          canManage={canManage}
          onCreateQuiz={() => { page.setQuizToEdit(null); page.setShowQuizModal(true); }}
          onPreview={page.setPreviewQuiz}
          onTogglePublish={page.handleToggleQuizPublish}
          onEditQuiz={page.openEditQuiz}
          onDownloadQuizPdf={page.downloadQuizPdf}
          onDeleteQuiz={(quiz) => page.setQuizToDelete(quiz)}
          onStartQuiz={(quizId) => navigate(`/assessments?quizId=${quizId}&returnTo=${encodeURIComponent(`/subjects/${subjectId}?tab=quizzes`)}`)}
        />
      )}

      {activeTab === "announcements" && (
        <AnnouncementsTab
          subjectAnnouncements={subjectAnnouncements}
          annPage={page.annPage}
          setAnnPage={page.setAnnPage}
          currentUser={currentUser}
          subject={subject}
          canManage={canManage}
          onPost={() => { page.setEditingAnn(null); page.setShowAnnounceModal(true); }}
          onDetail={page.setDetailAnn}
          onEdit={page.openEditAnnouncement}
          onRequestDelete={page.setAnnouncementToDelete}
        />
      )}

      {activeTab === "grades" && <GradesTab grades={page.grades} gradesLoading={page.gradesLoading} isStaff={isStaff} expandedGradeStudents={page.expandedGradeStudents} setExpandedGradeStudents={page.setExpandedGradeStudents} />}

      <UploadMaterialModal
        open={page.showUploadModal}
        onClose={page.requestCloseUpload}
        onSubmit={page.handleUpload}
        setFile={page.setUploadFile}
        title={page.uploadTitle}
        setTitle={page.setUploadTitle}
        description={page.uploadDescription}
        setDescription={page.setUploadDescription}
        rawText={page.uploadRawText}
        setRawText={page.setUploadRawText}
        uploading={page.uploading}
        discardOpen={page.discardOpen}
        onConfirmDiscard={page.confirmUploadDiscard}
        onCancelDiscard={page.cancelUploadDiscard}
      />

      <EditMaterialModal
        open={!!page.materialToEdit}
        onClose={() => page.setMaterialToEdit(null)}
        onSubmit={page.handleUpdateMaterial}
        title={page.editTitle}
        setTitle={page.setEditTitle}
        description={page.editDescription}
        setDescription={page.setEditDescription}
        rawText={page.editRawText}
        setRawText={page.setEditRawText}
        saving={page.savingEdit}
      />

      {page.showQuizModal && !page.quizToEdit && (
        <QuizCreateModal
          open={page.showQuizModal}
          onClose={() => page.setShowQuizModal(false)}
          onSaved={(saved) => {
            page.setQuizzes((prev) =>
              prev.some((q) => q.id === saved.id)
                ? prev.map((q) => (q.id === saved.id ? saved : q))
                : [saved, ...prev]
            );
            page.setQuizToEdit(null);
          }}
          subjects={subject ? [subject] : []}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
          canManageCourseQuizzes={canManage}
          defaultScope="teacher"
          lockSubject
          initialSubjectId={subject.id}
          initialSubjectName={`${subject.code} - ${subject.name}`}
          onOpenAI={() => navigate("/ai-assistant")}
        />
      )}

      {page.showQuizModal && page.quizToEdit && (
        <QuizEditorModal
          key={page.quizToEdit.id}
          quiz={page.quizToEdit}
          subjects={subject ? [subject] : []}
          currentUser={currentUser}
          lockSubject
          onClose={() => {
            page.setShowQuizModal(false);
            page.setQuizToEdit(null);
          }}
          onSaved={(saved) => {
            page.setQuizzes((prev) =>
              prev.some((q) => q.id === saved.id)
                ? prev.map((q) => (q.id === saved.id ? saved : q))
                : [saved, ...prev]
            );
          }}
        />
      )}

      <AnnouncementComposer
        open={page.showAnnounceModal}
        onClose={() => { page.setShowAnnounceModal(false); page.setEditingAnn(null); }}
        editingAnn={page.editingAnn}
        presetSubjectId={subject.id}
        presetSubjectName={`${subject.code} - ${subject.name}`}
      />

      <AssignStudentsModal
        open={page.showAssignModal}
        onClose={() => page.setShowAssignModal(false)}
        subject={subject}
        allStudents={page.allStudents}
        selectedStudentIds={page.selectedStudentIds}
        setSelectedStudentIds={page.setSelectedStudentIds}
        assigningStudents={page.assigningStudents}
        onConfirm={page.handleSaveAssignment}
      />

      {page.materialToDelete && <MaterialDeleteConfirm material={page.materialToDelete} onCancel={() => page.setMaterialToDelete(null)} onConfirm={() => { const target = page.materialToDelete; if (target) page.handleDeleteMaterial(target); }} />}

      {page.quizToDelete && <QuizDeleteConfirm quiz={page.quizToDelete} onCancel={() => page.setQuizToDelete(null)} onConfirm={() => { const target = page.quizToDelete; if (target) page.handleDeleteQuiz(target); }} />}

      {page.announcementToDelete && (
        <AnnouncementDeleteConfirm announcement={page.announcementToDelete} onCancel={() => page.setAnnouncementToDelete(null)} onConfirm={async () => { const target = page.announcementToDelete; page.setAnnouncementToDelete(null); if (!target) return; const deleted = await page.deleteAnnouncement(target.id); page.showToast(deleted ? "Announcement deleted." : "Could not delete the announcement.", deleted ? "success" : "error"); }} />
      )}

      <MaterialPreviewModal
        open={!!page.viewingMaterial}
        onClose={() => page.setViewingMaterial(null)}
        material={page.viewingMaterial!}
        currentUser={currentUser}
        previewTimestamp={page.previewTimestamp}
        onDownload={page.handleDownload}
        onDownloadAsPdf={page.downloadMaterialAsPdf}
        onDelete={(mat) => { page.setMaterialToDelete(mat); page.setViewingMaterial(null); }}
      />

      <QuizPreviewModal
        open={!!page.previewQuiz}
        onClose={() => page.setPreviewQuiz(null)}
        quiz={page.previewQuiz!}
        isStaff={isStaff}
        canManage={canManage}
        onTogglePublish={(q) => { page.handleToggleQuizPublish(q); page.setPreviewQuiz(null); }}
        onEditQuiz={(q) => { page.openEditQuiz(q); page.setPreviewQuiz(null); }}
        onDeleteQuiz={(q) => { page.setQuizToDelete(q); page.setPreviewQuiz(null); }}
        onTakeQuiz={(quizId) => { page.setPreviewQuiz(null); navigate(`/assessments?quizId=${quizId}&returnTo=${encodeURIComponent(`/subjects/${subjectId}?tab=quizzes`)}`); }}
      />

      <FlagDialog
        open={!!page.flagTarget}
        onClose={() => page.setFlagTarget(null)}
        material={page.flagTarget!}
        category={page.flagCategory}
        setCategory={page.setFlagCategory}
        note={page.flagNote}
        setNote={page.setFlagNote}
        submitting={page.flagSubmitting}
        onSubmit={page.handleFlagMaterial}
      />

      <FlagHistoryModal
        open={!!page.viewingFlags}
        onClose={() => page.setViewingFlags(null)}
        material={page.viewingFlags!}
        flags={page.viewingFlags ? flagsForMaterial(page.viewingFlags.id, page.materialFlags) : []}
      />

      <ResolveFlagModal
        open={!!page.resolvingFlag}
        onClose={() => page.setResolvingFlag(null)}
        flag={page.resolvingFlag!}
        resolutionNote={page.resolutionNote}
        setResolutionNote={page.setResolutionNote}
        resolving={page.resolving}
        onSubmit={page.handleResolveFlag}
      />

      <AnnouncementDetailModal
        open={!!page.detailAnn}
        onClose={() => page.setDetailAnn(null)}
        announcement={page.detailAnn!}
      />
    </div>
  );
};
