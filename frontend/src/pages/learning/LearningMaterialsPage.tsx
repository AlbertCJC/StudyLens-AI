import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import type { LearningMaterial, Subject } from "../../types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { AssignSubjectModal } from "./materials/AssignSubjectModal";
import { MaterialDeleteDialog } from "./materials/MaterialDeleteDialog";
import { MaterialPreviewModal } from "./materials/MaterialPreviewModal";
import { MaterialsCatalog } from "./materials/MaterialsCatalog";
import { UploadMaterialModal } from "./materials/UploadMaterialModal";
import { downloadMaterial, downloadMaterialAsPdf } from "./materials/materialPdf";
import { useMaterialUpload } from "./materials/useMaterialUpload";

interface LearningMaterialsPageProps {
  onGenerateResource?: (material: LearningMaterial) => void;
  onNavigate?: (
    tab: string,
    options?: { mode?: "quiz" | "flashcards" | "summary" | "reviewer" }
  ) => void;
}

export const LearningMaterialsPage: React.FC<LearningMaterialsPageProps> = ({
  onNavigate,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [materialPage, setMaterialPage] = useState(1);

  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);
  const [assignSubjectMat, setAssignSubjectMat] = useState<LearningMaterial | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [isAssigningSubject, setIsAssigningSubject] = useState(false);
  const [deleteConfirmMat, setDeleteConfirmMat] = useState<LearningMaterial | null>(null);

  const upload = useMaterialUpload({
    currentUser,
    showToast,
    onUploaded: (newMaterial) => setMaterials((prev) => [newMaterial, ...prev]),
  });

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      try {
        const [matRes, subRes] = await Promise.all([
          authFetch(`/api/materials?userId=${currentUser?.id || ""}&userRole=${currentUser?.role || ""}`),
          authFetch("/api/subjects"),
        ]);
        if (matRes.ok) {
          const matData = await matRes.json();
          if (isSubscribed) setMaterials(matData);
        }
        if (subRes.ok) {
          const subData = await subRes.json();
          if (isSubscribed) setSubjects(subData);
        }
      } catch (err) {
        console.error("Fetch materials error:", err);
      }
    };

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id, currentUser?.role]);

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/materials/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        setMaterialPage(1);
        setDeleteConfirmMat(null);
        showToast("Material deleted.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson?.error || "Could not delete the material.", "error");
      }
    } catch (err) {
      console.error("Delete material error:", err);
      showToast("Could not delete the material. Please try again.", "error");
    }
  };

  const openAssignSubject = (mat: LearningMaterial) => {
    setAssignSubjectMat(mat);
    setAssignSubjectId(mat.subjectId ? mat.subjectId : "");
  };

  const handleAssignSubject = async () => {
    if (!assignSubjectMat || !assignSubjectId) {
      showToast("Please select an assigned subject.", "info");
      return;
    }
    setIsAssigningSubject(true);

    try {
      const res = await authFetch(`/api/materials/${assignSubjectMat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: assignSubjectId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setAssignSubjectMat(null);
        showToast("Subject assigned to material.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson?.error || "Could not assign the subject. Please try again.", "error");
      }
    } catch {
      showToast("Could not assign the subject. Please try again.", "error");
    } finally {
      setIsAssigningSubject(false);
    }
  };

  const filteredMaterials = materials
    .filter((m) => {
      const matchesSubject =
        selectedSubject === "all" ||
        m.subjectId === selectedSubject ||
        (m.subjectId == null && m.materialType === "personal");

      if (m.materialType === "personal") {
        const isOwner =
          (m.uploaderId && currentUser?.id && m.uploaderId === currentUser.id) ||
          (currentUser?.name && m.uploadedBy === currentUser.name) ||
          (!m.uploaderId && currentUser?.id === "usr-student-1");
        if (!isOwner && currentUser?.role !== "admin") return false;
      }

      return matchesSubject;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const previewIsAi = !!previewMaterial && (previewMaterial.fileType || "").toLowerCase().startsWith("ai-");
  const previewTimestamp = previewMaterial?.createdAt
    ? new Date(previewMaterial.createdAt).toLocaleString()
    : "";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {currentUser?.role === "teacher" && upload.showUpload && (
        <UploadMaterialModal
          subjects={subjects}
          title={upload.title}
          description={upload.description}
          subjectId={upload.subjectId}
          rawText={upload.rawText}
          file={upload.file}
          isUploading={upload.isUploading}
          onTitleChange={upload.setTitle}
          onDescriptionChange={upload.setDescription}
          onSubjectIdChange={upload.setSubjectId}
          onRawTextChange={upload.setRawText}
          onFileChange={upload.handleFileChange}
          onSubmit={upload.handleUpload}
          onClose={upload.requestCloseUpload}
        />
      )}

      <MaterialsCatalog
        materials={filteredMaterials}
        subjects={subjects}
        selectedSubject={selectedSubject}
        currentUser={currentUser}
        materialPage={materialPage}
        onSubjectChange={setSelectedSubject}
        onPageChange={setMaterialPage}
        onPreview={setPreviewMaterial}
        onDelete={setDeleteConfirmMat}
        onDownload={downloadMaterial}
        onDownloadAsPdf={(mat) => downloadMaterialAsPdf(mat, showToast)}
        onAssignSubject={openAssignSubject}
        onUpload={upload.openUpload}
        onAiNotes={() => onNavigate?.("ai-assistant", { mode: "reviewer" })}
      />

      {previewMaterial && (
        <MaterialPreviewModal
          material={previewMaterial}
          currentUser={currentUser}
          previewIsAi={previewIsAi}
          previewTimestamp={previewTimestamp}
          onClose={() => setPreviewMaterial(null)}
          onDownload={downloadMaterial}
          onDownloadAsPdf={(mat) => downloadMaterialAsPdf(mat, showToast)}
          onDelete={(mat) => {
            setDeleteConfirmMat(mat);
            setPreviewMaterial(null);
          }}
        />
      )}

      {assignSubjectMat && (
        <AssignSubjectModal
          material={assignSubjectMat}
          subjects={subjects}
          selectedSubjectId={assignSubjectId}
          assigning={isAssigningSubject}
          onSubjectIdChange={setAssignSubjectId}
          onConfirm={handleAssignSubject}
          onClose={() => setAssignSubjectMat(null)}
        />
      )}

      {deleteConfirmMat && (
        <MaterialDeleteDialog
          material={deleteConfirmMat}
          onCancel={() => setDeleteConfirmMat(null)}
          onConfirm={handleDelete}
        />
      )}

      {upload.discardOpen && (
        <ConfirmDialog
          open={upload.discardOpen}
          title="Discard this upload?"
          message={
            "You have entered material details or attached a file that have not been uploaded. " +
            "If you leave now, your inputs will be lost."
          }
          confirmLabel="Discard & Close"
          cancelLabel="Keep Editing"
          destructive
          onConfirm={upload.confirmUploadDiscard}
          onCancel={upload.cancelUploadDiscard}
        />
      )}
    </div>
  );
};
