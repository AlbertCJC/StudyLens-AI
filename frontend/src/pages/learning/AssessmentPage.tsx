import React from "react";
/* eslint-disable react-refresh/only-export-components */
import { QuizCreateModal } from "../../components/QuizCreateModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ActiveQuizView } from "./assessment/ActiveQuizView";
import { AssessmentCatalog } from "./assessment/AssessmentCatalog";
import { AssignQuizSubjectModal } from "./assessment/AssignQuizSubjectModal";
import { CompletedAttemptView } from "./assessment/CompletedAttemptView";
import { DeleteQuizModal } from "./assessment/DeleteQuizModal";
import { EditQuizModal } from "./assessment/EditQuizModal";
import { QuizPreviewModal } from "./assessment/QuizPreviewModal";
import { useAssessmentPage } from "./assessment/useAssessmentPage";

export { isQuizOverdue } from "./assessment/assessmentUtils";
export type { SavedQuizProgress } from "./assessment/assessmentUtils";

interface AssessmentPageProps {
  onNavigate: (tab: string) => void;
}

export const AssessmentPage: React.FC<AssessmentPageProps> = ({ onNavigate }) => {
  const assessment = useAssessmentPage();
  const {
    currentUser,
    canManageCourseQuizzes,
    navigate,
    returnTo,
    quizzes,
    subjects,
    activeQuiz,
    setActiveQuiz,
    selectedSubjectFilter,
    setSelectedSubjectFilter,
    quizPage,
    setQuizPage,
    showCreateModal,
    setShowCreateModal,
    quizToDelete,
    setQuizToDelete,
    previewQuiz,
    setPreviewQuiz,
    assignQuiz,
    setAssignQuiz,
    assignQuizSubjectId,
    setAssignQuizSubjectId,
    isAssigningQuizSubject,
    assignQuizMsg,
    editingQuiz,
    editDiscardOpen,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editSubjectId,
    setEditSubjectId,
    editQuizType,
    setEditQuizType,
    editTimeLimit,
    setEditTimeLimit,
    editLimitAttempts,
    setEditLimitAttempts,
    editAttempts,
    setEditAttempts,
    editRevealAnswers,
    setEditRevealAnswers,
    editDeadline,
    setEditDeadline,
    editQuestions,
    setEditQuestions,
    editQuestionListRef,
    editPromptRefs,
    setEditScrollTick,
    markEditDirty,
    currentQIndex,
    setCurrentQIndex,
    userAnswers,
    timeLeft,
    hintsByQuestion,
    hintErrorsByQuestion,
    hintLoadingFor,
    savedProgresses,
    completedAttempt,
    setCompletedAttempt,
    isSubmitting,
    submitError,
    setSubmitError,
    handleSubmitQuiz,
    handleStartQuiz,
    handleDiscardProgress,
    clearHintFor,
    handleSelectAnswer,
    handleToggleMultiAnswer,
    handleFetchHint,
    handleOpenEditModal,
    handleSaveEditQuiz,
    confirmEditDiscard,
    cancelEditDiscard,
    requestCloseEdit,
    handleTogglePublish,
    openAssignQuizSubject,
    handleAssignQuizSubject,
    handleConfirmDeleteQuiz,
    handleQuizCreated,
    visibleQuizzes,
  } = assessment;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* 1. ACTIVE QUIZ TAKING INTERFACE */}
      {activeQuiz && !completedAttempt && (
        <ActiveQuizView
          activeQuiz={activeQuiz}
          currentQIndex={currentQIndex}
          userAnswers={userAnswers}
          timeLeft={timeLeft}
          hintsByQuestion={hintsByQuestion}
          hintErrorsByQuestion={hintErrorsByQuestion}
          hintLoadingFor={hintLoadingFor}
          submitError={submitError}
          isSubmitting={isSubmitting}
          onPrevious={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setCurrentQIndex((prev) => prev + 1)}
          onSubmit={handleSubmitQuiz}
          onSelectAnswer={handleSelectAnswer}
          onToggleMultiAnswer={handleToggleMultiAnswer}
          onClearHint={clearHintFor}
          onFetchHint={handleFetchHint}
        />
      )}

      {/* 2. COMPLETED ATTEMPT RESULTS VIEW */}
      {completedAttempt && (
        <CompletedAttemptView
          completedAttempt={completedAttempt}
          activeQuiz={activeQuiz!}
          returnTo={returnTo}
          onBack={() => {
            if (returnTo) {
              navigate(decodeURIComponent(returnTo));
              return;
            }
            setActiveQuiz(null);
            setCompletedAttempt(null);
            setSubmitError(null);
          }}
        />
      )}

      {/* 3. CATALOG OF QUIZZES & ASSESSMENT TYPES */}
      {!activeQuiz && (
        <AssessmentCatalog
          quizzes={quizzes}
          subjects={subjects}
          selectedSubjectFilter={selectedSubjectFilter}
          onSubjectFilterChange={setSelectedSubjectFilter}
          quizPage={quizPage}
          onPageChange={setQuizPage}
          visibleQuizzes={visibleQuizzes}
          savedProgresses={savedProgresses}
          currentUser={currentUser}
          onShowCreate={() => setShowCreateModal(true)}
          onNavigateAi={() => onNavigate("ai-assistant")}
          onPreview={setPreviewQuiz}
          onStartQuiz={handleStartQuiz}
          onDiscardProgress={handleDiscardProgress}
          onTogglePublish={handleTogglePublish}
          onOpenAssignSubject={openAssignQuizSubject}
          onOpenEdit={handleOpenEditModal}
          onRequestDelete={setQuizToDelete}
        />
      )}

      {/* QUIZ PREVIEW MODAL (read-only view of a quiz's contents) */}
      {previewQuiz && (
        <QuizPreviewModal
          previewQuiz={previewQuiz}
          canManageCourseQuizzes={canManageCourseQuizzes}
          currentUser={currentUser}
          savedProgresses={savedProgresses}
          onClose={() => setPreviewQuiz(null)}
          onStartQuiz={handleStartQuiz}
          onTogglePublish={handleTogglePublish}
          onOpenAssignSubject={openAssignQuizSubject}
          onOpenEdit={handleOpenEditModal}
          onRequestDelete={setQuizToDelete}
        />
      )}

      {/* ASSIGN SUBJECT MODAL */}
      {assignQuiz && (
        <AssignQuizSubjectModal
          assignQuiz={assignQuiz}
          assignQuizSubjectId={assignQuizSubjectId}
          isAssigningQuizSubject={isAssigningQuizSubject}
          assignQuizMsg={assignQuizMsg}
          subjects={subjects}
          currentUser={currentUser}
          onSubjectChange={setAssignQuizSubjectId}
          onConfirm={handleAssignQuizSubject}
          onClose={() => setAssignQuiz(null)}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {quizToDelete && (
        <DeleteQuizModal
          quizToDelete={quizToDelete}
          onClose={() => setQuizToDelete(null)}
          onConfirm={handleConfirmDeleteQuiz}
        />
      )}

      {/* EDIT QUIZ MODAL */}
      {editingQuiz && (
        <EditQuizModal
          editingQuiz={editingQuiz}
          subjects={subjects}
          currentUser={currentUser}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editSubjectId={editSubjectId}
          setEditSubjectId={setEditSubjectId}
          editQuizType={editQuizType}
          setEditQuizType={setEditQuizType}
          editTimeLimit={editTimeLimit}
          setEditTimeLimit={setEditTimeLimit}
          editLimitAttempts={editLimitAttempts}
          setEditLimitAttempts={setEditLimitAttempts}
          editAttempts={editAttempts}
          setEditAttempts={setEditAttempts}
          editRevealAnswers={editRevealAnswers}
          setEditRevealAnswers={setEditRevealAnswers}
          editDeadline={editDeadline}
          setEditDeadline={setEditDeadline}
          editQuestions={editQuestions}
          setEditQuestions={setEditQuestions}
          editQuestionListRef={editQuestionListRef}
          editPromptRefs={editPromptRefs}
          setEditScrollTick={setEditScrollTick}
          markEditDirty={markEditDirty}
          requestCloseEdit={requestCloseEdit}
          handleSaveEditQuiz={handleSaveEditQuiz}
        />
      )}
      {showCreateModal && (
        <QuizCreateModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleQuizCreated}
          subjects={subjects.filter(
            (sub) => currentUser?.role !== 'teacher' || sub.teacherId === currentUser.id
          )}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.name}
          canManageCourseQuizzes={canManageCourseQuizzes}
          defaultScope={canManageCourseQuizzes ? 'teacher' : 'student'}
        />
      )}

      <ConfirmDialog
        open={editDiscardOpen}
        title="Discard quiz changes?"
        message="You have modified this quiz and the changes have not been saved. If you leave now, your edits will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Keep Editing"
        destructive
        onConfirm={confirmEditDiscard}
        onCancel={cancelEditDiscard}
      />
    </div>
  );
};
