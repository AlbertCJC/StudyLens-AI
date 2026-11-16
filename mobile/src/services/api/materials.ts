import {
  getApiBaseUrl,
  getAuthToken,
  setAuthToken,
  buildHeaders,
  handleUnauthorized,
  invalidateApiCache,
  getJSON,
  postJSON,
  postForm,
  mutateJSON,
  offlineError,
} from './client';
import type {
  UserRole,
  AssessmentType,
  DifficultyLevel,
  User,
  Subject,
  Material,
  QuizQuestion,
  Quiz,
  Flashcard,
  FlashcardDeck,
  StudySummary,
  ReviewerTopic,
  Reviewer,
  Announcement,
  ActivityLog,
  SystemInfo,
  SystemSettings,
} from './client';

// ----------------------------------------------------------------
// MATERIALS
// ----------------------------------------------------------------
export const FALLBACK_MATERIALS: Material[] = [
  {
    id: 'mat-1719',
    title: 'Graph Traversal Lecture: BFS & DFS',
    description: 'Lecture notes on Breadth-First and Depth-First search algorithms.',
    subjectId: 'sub-101',
    subjectName: 'CS 301 - Data Structures & Algorithms',
    fileType: 'pdf',
    fileUrl: '/uploads/graphs.pdf',
    fileSize: '1.2 MB',
    extractedText:
      'Uploaded PDF document: Graph Traversal Lecture. BFS traverses level-by-level using a FIFO Queue with O(V + E). DFS traverses deep using a Stack/Recursion with O(V + E).',
    uploadedBy: 'Christian C. Barral, MIT',
    uploaderRole: 'teacher',
    uploaderId: 'usr-teacher-1',
    materialType: 'course',
    createdAt: '2024-01-28T14:00:00.000Z',
  },
];

export const fetchMaterials = (): Promise<Material[]> => getJSON('/materials', FALLBACK_MATERIALS);

export interface UploadMaterialPayload {
  uri: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  subjectId: string;
  uploadedBy: string;
  uploaderRole: string;
  uploaderId: string;
}

export async function uploadMaterial(payload: UploadMaterialPayload, endpoint = '/materials/upload'): Promise<Material> {
  const fallbackMaterial: Material = {
    id: `mat-local-${Date.now()}`,
    title: payload.title || payload.name,
    description: payload.description || 'Uploaded lecture material',
    subjectId: payload.subjectId,
    subjectName: 'Uploaded Material',
    fileType: payload.name.split('.').pop() || 'pdf',
    fileSize: 'Local File',
    extractedText: `Uploaded ${payload.type} document: ${payload.title || payload.name}.`,
    uploadedBy: payload.uploadedBy,
    uploaderRole: payload.uploaderRole,
    uploaderId: payload.uploaderId,
    materialType: 'course',
    createdAt: new Date().toISOString(),
  };

  try {
    const form = new FormData();
    form.append('file', { uri: payload.uri, name: payload.name, type: payload.type } as any);
    form.append('title', payload.title || payload.name);
    form.append('description', payload.description || 'Uploaded lecture material');
    form.append('subjectId', payload.subjectId);
    form.append('uploadedBy', payload.uploadedBy);
    form.append('uploaderRole', payload.uploaderRole);
    form.append('uploaderId', payload.uploaderId);
    const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
      body: form,
    });
    if (handleUnauthorized(res)) return fallbackMaterial;
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
    return endpoint === '/materials/extract' ? ({ text: '', fileName: payload.name } as unknown as Material) : fallbackMaterial;
  } catch (err) {
    console.warn('[Mobile] Material upload failed, using local material record');
    return endpoint === '/materials/extract' ? ({ text: '', fileName: payload.name } as unknown as Material) : fallbackMaterial;
  }
}


// ----------------------------------------------------------------
// SUBJECT MATERIAL / QUIZ MUTATIONS (staff)
// ----------------------------------------------------------------
export const updateMaterial = (materialId: string, patch: { title?: string; description?: string; textInput?: string }): Promise<Material> =>
  mutateJSON(`/materials/${encodeURIComponent(materialId)}`, 'PUT', patch);

export const deleteMaterial = (materialId: string): Promise<{ success: boolean }> =>
  mutateJSON(`/materials/${encodeURIComponent(materialId)}`, 'DELETE');

// ----------------------------------------------------------------
// MATERIAL FLAGGING (admin flags, assigned teacher resolves)
// ----------------------------------------------------------------
export type MaterialFlagCategory = 'Wrong file' | 'Wrong subject' | 'Incomplete content' | 'Other';

export interface MaterialFlag {
  id: string;
  materialId: string;
  materialTitle: string;
  subjectId: string;
  subjectName: string;
  flaggedById: string;
  flaggedByName: string;
  category: MaterialFlagCategory;
  note?: string | null;
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  resolvedByName?: string | null;
  resolutionNote?: string | null;
}

export const FALLBACK_MATERIAL_FLAGS: MaterialFlag[] = [];

export const flagMaterial = (materialId: string, input: { category: MaterialFlagCategory; note?: string }): Promise<MaterialFlag> =>
  postJSON(`/materials/${encodeURIComponent(materialId)}/flag`, input, { success: false } as unknown as MaterialFlag);

export const fetchMaterialFlags = (): Promise<MaterialFlag[]> => getJSON('/material-flags', FALLBACK_MATERIAL_FLAGS);

export const resolveMaterialFlag = (flagId: string, resolutionNote?: string): Promise<MaterialFlag> =>
  mutateJSON(`/material-flags/${encodeURIComponent(flagId)}/resolve`, 'POST', { resolutionNote });

export const saveAiResourceAsMaterial = (payload: Record<string, unknown>): Promise<Material> =>
  mutateJSON('/materials/from-ai', 'POST', payload);

export const updateMaterialSubject = (materialId: string, subjectId: string): Promise<Material> =>
  mutateJSON(`/materials/${encodeURIComponent(materialId)}`, 'PUT', { subjectId });
