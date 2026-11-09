import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Subject, Material } from '../services/api';

export type SubjectDetailTabKey =
  | 'people'
  | 'materials'
  | 'quizzes'
  | 'announcements'
  | 'grades';

export type AdminTabKey = 'overview' | 'users' | 'logs' | 'settings';

export interface AISeedParams {
  initialTopic?: string | null;
  initialMaterial?: { title: string; content: string } | null;
  initialMode?: 'quiz' | 'flashcards' | 'summary' | 'reviewer' | null;
}

export interface QuizOpenParams {
  autoOpenQuizId?: string;
  hasReturnOrigin?: boolean;
}

export type RoleTabsParamList = {
  Home: undefined;
  Subjects: undefined;
  AI: AISeedParams | undefined;
  Quizzes: undefined;
  Admin: { initialTab?: AdminTabKey } | undefined;
  Users: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<RoleTabsParamList> | undefined;
  SubjectDetail: { subject: Subject; initialTab?: SubjectDetailTabKey | null };
  Quiz: QuizOpenParams | undefined;
  Materials: undefined;
  Flashcards: undefined;
  Analytics: undefined;
  Reports: undefined;
  Notifications: undefined;
  Announcements: undefined;
  Profile: undefined;
  AdminDetail: { initialTab?: AdminTabKey };
};