import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  FileText,
  Sparkles,
  TrendingUp,
  FolderKanban,
  Layers,
  Bell,
  User,
  ShieldCheck,
  Users,
  Activity,
  Settings,
} from 'lucide-react-native';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth, UserRole } from './src/context/AuthContext';
import { AnnouncementsProvider } from './src/context/AnnouncementsContext';
import { ToastProvider } from './src/context/ToastContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TeacherDashboardScreen from './src/screens/TeacherDashboardScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import SubjectDetailScreen from './src/screens/SubjectDetailScreen';
import MaterialsScreen from './src/screens/MaterialsScreen';
import AIStudyAssistantScreen from './src/screens/AIStudyAssistantScreen';
import AssessmentsScreen from './src/screens/AssessmentsScreen';
import FlashcardsScreen from './src/screens/FlashcardsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import TeacherAnalyticsScreen from './src/screens/TeacherAnalyticsScreen';
import AnnouncementsScreen from './src/screens/AnnouncementsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import DashboardLayout, { MenuItem } from './src/components/DashboardLayout';
import { useAnnouncements } from './src/context/AnnouncementsContext';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import { initApiBaseUrl, Subject, Quiz, Material } from './src/services/api';

type PageKey =
  | 'dashboard'
  | 'subjects'
  | 'subjectDetail'
  | 'materials'
  | 'ai-assistant'
  | 'quiz'
  | 'flashcards'
  | 'analytics'
  | 'reports'
  | 'announcements'
  | 'notifications'
  | 'profile'
  | 'admin'
  | 'admin-users'
  | 'admin-logs'
  | 'admin-settings';

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  subjects: 'Subjects',
  subjectDetail: 'Subject',
  materials: 'Learning Materials',
  'ai-assistant': 'AI Study Assistant',
  quiz: 'Assessments & Quizzes',
  flashcards: 'Flashcard Decks',
  analytics: 'Progress Analytics',
  reports: 'Reports & Analytics',
  announcements: 'Announcements',
  notifications: 'Notifications',
  profile: 'Profile',
  admin: 'Admin Dashboard',
  'admin-users': 'Admin Dashboard',
  'admin-logs': 'Admin Dashboard',
  'admin-settings': 'Admin Dashboard',
};

function MainApp() {
  const { currentUser } = useAuth();
  const { unreadNotifications, unreadAnnouncements } = useAnnouncements();
  const [page, setPage] = React.useState<PageKey>('dashboard');
  const [selectedSubject, setSelectedSubject] = React.useState<Subject | null>(null);
  const [pendingQuizId, setPendingQuizId] = React.useState<string | null>(null);
  const [aiSeedTopic, setAiSeedTopic] = React.useState<string | null>(null);
  const [aiSeedMaterial, setAiSeedMaterial] = React.useState<{ title: string; content: string } | null>(null);
  const [quizReturnTab, setQuizReturnTab] = React.useState<string | null>(null);
  const [subjectInitialTab, setSubjectInitialTab] = React.useState<string | null>(null);

  // Reset all app-level navigation/selection state whenever the signed-in user
  // changes (login/logout/account switch) so the next session always starts at
  // the Dashboard with no leaked selections from the previous user.
  const lastUserId = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = currentUser?.id ?? null;
    if (lastUserId.current !== null && lastUserId.current !== id) {
      setPage('dashboard');
      setSelectedSubject(null);
      setPendingQuizId(null);
      setAiSeedTopic(null);
      setQuizReturnTab(null);
      setSubjectInitialTab(null);
    }
    lastUserId.current = id;
  }, [currentUser?.id]);

  if (!currentUser) {
    return <LoginScreen />;
  }

  const role = (currentUser.role === 'teacher' ? 'teacher' : currentUser.role === 'admin' ? 'admin' : 'student') as UserRole;
  const notifyBadge = unreadNotifications;
  const announceBadge = unreadAnnouncements;

  const studentMenuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'subjects', label: 'My Subjects', Icon: FolderKanban },
    { key: 'materials', label: 'Learning Materials', Icon: BookOpen },
    { key: 'ai-assistant', label: 'AI Study Assistant', Icon: Sparkles },
    { key: 'quiz', label: 'Quizzes & Tests', Icon: CheckSquare },
    { key: 'flashcards', label: 'Flashcards', Icon: Layers },
    { key: 'analytics', label: 'My Progress', Icon: TrendingUp },
    { key: 'reports', label: 'My Report', Icon: FileText },
    { key: 'announcements', label: 'Announcements', Icon: Bell, badge: announceBadge > 0 ? String(announceBadge) : undefined },
    { key: 'profile', label: 'My Profile', Icon: User },
  ];

  const teacherMenuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Teacher Dashboard', Icon: LayoutDashboard },
    { key: 'subjects', label: 'Manage Subjects', Icon: FolderKanban },
    { key: 'materials', label: 'Upload Materials', Icon: BookOpen },
    { key: 'ai-assistant', label: 'AI Study Assistant', Icon: Sparkles },
    { key: 'quiz', label: 'Assessments', Icon: CheckSquare },
    { key: 'flashcards', label: 'Flashcards', Icon: Layers },
    { key: 'analytics', label: 'Student Progress', Icon: TrendingUp },
    { key: 'reports', label: 'Reports & Analytics', Icon: FileText },
    { key: 'announcements', label: 'Class Announcements', Icon: Bell, badge: announceBadge > 0 ? String(announceBadge) : undefined },
    { key: 'profile', label: 'My Profile', Icon: User },
  ];

  const adminMenuItems: MenuItem[] = [
    { key: 'admin', label: 'Admin Dashboard', Icon: ShieldCheck },
    { key: 'admin-users', label: 'User Management', Icon: Users },
    { key: 'subjects', label: 'Subject Catalog', Icon: FolderKanban },
    { key: 'quiz', label: 'Manage Assessments', Icon: CheckSquare },
    { key: 'materials', label: 'Upload Materials', Icon: BookOpen },
    { key: 'reports', label: 'Reports & Analytics', Icon: FileText },
    { key: 'admin-logs', label: 'Audit Activity Logs', Icon: Activity },
    { key: 'announcements', label: 'System Announcements', Icon: Bell, badge: announceBadge > 0 ? String(announceBadge) : undefined },
    { key: 'admin-settings', label: 'System Settings', Icon: Settings },
    { key: 'profile', label: 'My Profile', Icon: User },
  ];

  const menuItems = role === 'teacher' ? teacherMenuItems : role === 'admin' ? adminMenuItems : studentMenuItems;

  const navigate = (key: string) => {
    const normalized = key.toLowerCase();
    if ((PAGE_TITLES as Record<string, string>)[normalized]) setPage(normalized as PageKey);
    else if (normalized.includes('admin')) setPage('admin');
    else if (normalized.includes('assess') || normalized.includes('quiz')) setPage('quiz');
    else if (normalized.includes('flash')) setPage('flashcards');
    else if (normalized.includes('material')) setPage('materials');
    else if (normalized.includes('ai')) setPage('ai-assistant');
    else if (normalized.includes('analytics') || normalized.includes('progress')) setPage('analytics');
    else if (normalized.includes('report')) setPage('reports');
    else if (normalized.includes('notif')) setPage('notifications');
    else if (normalized.includes('announce')) setPage('announcements');
    else if (normalized.includes('profile')) setPage('profile');
    else setPage('dashboard');
  };

  const openSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setSubjectInitialTab(null);
    setPage('subjectDetail');
  };

  const openQuiz = (quiz: Quiz) => {
    // Remember origin: if launched from a subject's Quizzes tab, return there after completion.
    if (page === 'subjectDetail' && selectedSubject) {
      setQuizReturnTab('quizzes');
      setSubjectInitialTab('quizzes');
    } else {
      setQuizReturnTab(null);
    }
    setPendingQuizId(quiz.id);
    setPage('quiz');
  };

  const openQuizById = (quizId: string) => {
    setQuizReturnTab(null);
    setPendingQuizId(quizId);
    setPage('quiz');
  };

  const handleQuizExit = () => {
    if (quizReturnTab && selectedSubject) {
      setQuizReturnTab(null);
      setPendingQuizId(null);
      setSubjectInitialTab(quizReturnTab);
      setPage('subjectDetail');
      return;
    }
    setQuizReturnTab(null);
    setPendingQuizId(null);
    // Stay on quiz page (catalog) — AssessmentsScreen will clear its activeQuiz.
  };

  const openWeakTopic = (topic: string) => {
    setAiSeedTopic(topic);
    setPage('ai-assistant');
  };

  const openCreateNotes = (material: Material) => {
    setAiSeedTopic(null);
    setAiSeedMaterial({
      title: material.title,
      content: material.extractedText || material.description || material.title,
    });
    setPage('ai-assistant');
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        if (role === 'admin') return <TeacherDashboardScreen onNavigate={navigate} />;
        return role === 'teacher' ? (
          <TeacherDashboardScreen onNavigate={navigate} />
        ) : (
          <DashboardScreen onNavigate={navigate} onOpenWeakTopic={openWeakTopic} onOpenSubject={openSubject} />
        );
      case 'admin':
        return <AdminDashboardScreen onNavigate={navigate} />;
      case 'admin-users':
        return <AdminDashboardScreen onNavigate={navigate} initialTab="users" />;
      case 'admin-logs':
        return <AdminDashboardScreen onNavigate={navigate} initialTab="logs" />;
      case 'admin-settings':
        return <AdminDashboardScreen onNavigate={navigate} initialTab="settings" />;
      case 'subjects':
        return <SubjectsScreen onNavigate={navigate} onOpenSubject={openSubject} />;
      case 'subjectDetail':
        return selectedSubject ? (
          <SubjectDetailScreen
            subject={selectedSubject}
            onBack={() => {
              setSubjectInitialTab(null);
              setPage('subjects');
            }}
            onNavigate={navigate}
            onOpenQuiz={openQuiz}
            initialTab={subjectInitialTab as any}
          />
        ) : (
          <SubjectsScreen onNavigate={navigate} onOpenSubject={openSubject} />
        );
      case 'materials':
        return <MaterialsScreen onNavigate={navigate} onCreateNotes={openCreateNotes} />;
      case 'ai-assistant':
        return (
          <AIStudyAssistantScreen
            onNavigate={navigate}
            initialTopic={aiSeedTopic}
            initialMaterial={aiSeedMaterial}
            onSeedConsumed={() => {
              setAiSeedTopic(null);
              setAiSeedMaterial(null);
            }}
          />
        );
      case 'quiz':
        return (
          <AssessmentsScreen
            onNavigate={navigate}
            autoOpenQuizId={pendingQuizId}
            onAutoOpenHandled={() => {
              setPendingQuizId(null);
            }}
            hasReturnOrigin={!!quizReturnTab && !!selectedSubject}
            onReturnToOrigin={handleQuizExit}
          />
        );
      case 'flashcards':
        return <FlashcardsScreen onNavigate={navigate} />;
      case 'analytics':
        return role === 'student' ? (
          <AnalyticsScreen onNavigate={navigate} onOpenWeakTopic={openWeakTopic} />
        ) : (
          <TeacherAnalyticsScreen onNavigate={navigate} />
        );
      case 'reports':
        return <ReportsScreen onNavigate={navigate} />;
      case 'announcements':
        return <AnnouncementsScreen onNavigate={navigate} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onOpenQuiz={openQuizById} />;
      case 'profile':
        return <ProfileScreen onNavigate={navigate} />;
      default:
        return <PlaceholderPage title={PAGE_TITLES[page]} />;
    }
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeKey={page}
      onNavigate={navigate}
      onQuickNavigate={navigate}
      title={page === 'subjectDetail' && selectedSubject ? selectedSubject.name : PAGE_TITLES[page]}
    >
      {/* Keyed by user+role: switching roles remounts the active screen so
          per-user state (AI seeds, drafts, selections) never leaks across roles. */}
      <React.Fragment key={`${currentUser.id}:${role}`}>{renderPage()}</React.Fragment>
    </DashboardLayout>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
      <View style={[styles.placeholderIcon, { backgroundColor: colors.indigoSoft }]}>
        <Sparkles size={26} color={colors.primary} />
      </View>
      <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
        This page is coming soon. Use the navigation drawer to explore other screens.
      </Text>
    </View>
  );
}

export default function App() {
  const [apiReady, setApiReady] = React.useState(false);

  React.useEffect(() => {
    initApiBaseUrl().then(() => setApiReady(true));
  }, []);

  if (!apiReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AnnouncementsProvider>
            <ToastProvider>
              <MainApp />
            </ToastProvider>
          </AnnouncementsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  placeholderIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  placeholderTitle: { fontSize: 20, fontWeight: '800' },
});