import type { QuizQuestion } from "../types";

export type AIMode = "quiz" | "flashcards" | "summary" | "reviewer";

export interface AIGeneratedResult {
  id?: string;
  title?: string;
  subjectId?: string;
  subjectName?: string;
  materialId?: string | null;
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
  quizType?: string;
  isPublished?: boolean;
  difficulty?: string;
  source?: string;
  titleExists?: boolean;
  questions?: QuizQuestion[];
  cards?: Array<{ question: string; answer: string; topicTag?: string }>;
  executiveSummary?: string;
  keyTakeaways?: string[];
  bulletPoints?: string[];
  overview?: string;
  topics?: Array<{
    topic: string;
    overview: string;
    keyConcepts?: string[];
    sampleQuestions?: Array<{ question: string; answer?: string }>;
  }>;
  practiceQuestions?: Array<{ question: string; sampleAnswer: string }>;
}

export interface AIWorkspace {
  mode: AIMode;
  prompt: string;
  sourceText: string;
  selectedMaterialId: string;
  uploadedFileName?: string;
  quizCount: string;
  flashcardCount: string;
  quizRevealAnswers: boolean;
  drafts: Partial<Record<AIMode, AIGeneratedResult | null>>;
  draftTitles: Partial<Record<AIMode, string>>;
  savedDrafts: Partial<Record<AIMode, boolean>>;
  generatedOutput: AIGeneratedResult | null;
  editTitle: string;
  offlineNotice: boolean;
  titleExists: boolean;
  pending?: boolean;
  completedAt?: number;
}

interface ActiveJob {
  controller: AbortController | null;
  mode: AIMode;
}

const memoryCache = new Map<string, AIWorkspace>();
const activeJobs = new Map<string, ActiveJob>();
const listeners = new Map<string, Set<(ws: AIWorkspace) => void>>();

const storageKey = (userId: string) => `studylens_ai_workspace_${userId}`;

const EMPTY_WORKSPACE: AIWorkspace = {
  mode: "quiz",
  prompt: "",
  sourceText: "",
  selectedMaterialId: "",
  quizCount: "5",
  flashcardCount: "5",
  quizRevealAnswers: true,
  drafts: {},
  draftTitles: {},
  savedDrafts: {},
  generatedOutput: null,
  editTitle: "",
  offlineNotice: false,
  titleExists: false,
  pending: false,
};

export function getWorkspace(userId: string): AIWorkspace | null {
  if (!userId) return null;
  if (memoryCache.has(userId)) return memoryCache.get(userId) as AIWorkspace;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AIWorkspace;
    memoryCache.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspace(userId: string, workspace: AIWorkspace): void {
  if (!userId) return;
  const previous = memoryCache.get(userId);
  // Preserve a prior completion timestamp across ordinary state saves so the
  // completion-notification guard stays meaningful.
  const persisted: AIWorkspace = {
    ...workspace,
    completedAt: workspace.completedAt ?? previous?.completedAt,
    pending: activeJobs.has(userId),
  };
  memoryCache.set(userId, persisted);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(persisted));
  } catch {
    // localStorage unavailable (private mode) - the in-memory cache still works
  }
  notify(userId, persisted);
}

function notify(userId: string, workspace: AIWorkspace): void {
  const set = listeners.get(userId);
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb(workspace);
    } catch {
      // a misbehaving listener must never break persistence
    }
  });
}

export function subscribe(userId: string, cb: (ws: AIWorkspace) => void): () => void {
  if (!userId) return () => undefined;
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(userId);
  };
}

export function clearWorkspace(userId: string): void {
  if (!userId) return;
  memoryCache.delete(userId);
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

export function registerJob(userId: string, mode: AIMode, controller?: AbortController | null): void {
  if (!userId) return;
  activeJobs.set(userId, { controller: controller ?? null, mode });
}

export function clearJob(userId: string): void {
  if (!userId) return;
  activeJobs.delete(userId);
  const ws = memoryCache.get(userId);
  if (ws) {
    ws.pending = false;
    saveWorkspace(userId, ws);
  }
}

export function isJobRunning(userId: string): boolean {
  return activeJobs.has(userId);
}

export function getActiveJob(userId: string): ActiveJob | null {
  return activeJobs.get(userId) ?? null;
}

export function emptyWorkspace(): AIWorkspace {
  return { ...EMPTY_WORKSPACE };
}
