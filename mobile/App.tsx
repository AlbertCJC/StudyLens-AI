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
} from 'lucide-react-native';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth, UserRole } from './src/context/AuthContext';
import { AnnouncementsProvider } from './src/context/AnnouncementsContext';
import LandingScreen from './src/screens/LandingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TeacherDashboardScreen from './src/screens/TeacherDashboardScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import MaterialsScreen from './src/screens/MaterialsScreen';
import AIStudyAssistantScreen from './src/screens/AIStudyAssistantScreen';
import AssessmentsScreen from './src/screens/AssessmentsScreen';
import FlashcardsScreen from './src/screens/FlashcardsScreen';
import SummariesScreen from './src/screens/SummariesScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DashboardLayout, { MenuItem } from './src/components/DashboardLayout';
import { useAnnouncements } from './src/context/AnnouncementsContext';

type PageKey =
  | 'dashboard'
  | 'subjects'
  | 'materials'
  | 'ai-assistant'
  | 'quiz'
  | 'flashcards'
  | 'summary'
  | 'analytics'
  | 'notifications'
  | 'profile';

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  subjects: 'Subjects',
  materials: 'Learning Materials',
  'ai-assistant': 'AI Study Assistant',
  quiz: 'Assessments & Quizzes',
  flashcards: 'Flashcard Decks',
  summary: 'Summaries & Reviewers',
  analytics: 'Progress Analytics',
  notifications: 'Notifications',
  profile: 'Profile',
};

function MainApp() {
  const { currentUser } = useAuth();
  const { unreadNotifications, unreadAnnouncements } = useAnnouncements();
  const [page, setPage] = React.useState<PageKey>('dashboard');

  if (!currentUser) {
    return <LandingScreen />;
  }

  const role = (currentUser.role === 'teacher' ? 'teacher' : 'student') as UserRole;
  const notifyBadge = unreadNotifications + unreadAnnouncements;

  const studentMenuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'subjects', label: 'My Subjects', Icon: FolderKanban },
    { key: 'materials', label: 'Learning Materials', Icon: BookOpen },
    { key: 'ai-assistant', label: 'AI Resource Generator', Icon: Sparkles, badge: 'AI' },
    { key: 'quiz', label: 'Quizzes & Tests', Icon: CheckSquare },
    { key: 'flashcards', label: 'Flashcards', Icon: Layers },
    { key: 'summary', label: 'Summaries & Reviewers', Icon: FileText },
    { key: 'analytics', label: 'Adaptive Progress', Icon: TrendingUp },
    { key: 'notifications', label: 'Notifications', Icon: Bell, badge: notifyBadge > 0 ? String(notifyBadge) : undefined },
    { key: 'profile', label: 'My Profile', Icon: User },
  ];

  const teacherMenuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Teacher Dashboard', Icon: LayoutDashboard },
    { key: 'subjects', label: 'Manage Subjects', Icon: FolderKanban },
    { key: 'materials', label: 'Upload Materials', Icon: BookOpen },
    { key: 'ai-assistant', label: 'AI Resource Creator', Icon: Sparkles, badge: 'AI' },
    { key: 'quiz', label: 'Assessments', Icon: CheckSquare },
    { key: 'flashcards', label: 'Flashcards', Icon: Layers },
    { key: 'summary', label: 'Summaries & Reviewers', Icon: FileText },
    { key: 'analytics', label: 'Student Progress', Icon: TrendingUp },
    { key: 'notifications', label: 'Notifications', Icon: Bell, badge: notifyBadge > 0 ? String(notifyBadge) : undefined },
    { key: 'profile', label: 'My Profile', Icon: User },
  ];

  const menuItems = role === 'teacher' ? teacherMenuItems : studentMenuItems;

  const navigate = (key: string) => {
    const normalized = key.toLowerCase();
    if ((PAGE_TITLES as Record<string, string>)[normalized]) setPage(normalized as PageKey);
    else if (normalized.includes('assess') || normalized.includes('quiz')) setPage('quiz');
    else if (normalized.includes('flash')) setPage('flashcards');
    else if (normalized.includes('summ')) setPage('summary');
    else if (normalized.includes('material')) setPage('materials');
    else if (normalized.includes('ai')) setPage('ai-assistant');
    else if (normalized.includes('analytics') || normalized.includes('progress')) setPage('analytics');
    else if (normalized.includes('notif')) setPage('notifications');
    else if (normalized.includes('profile')) setPage('profile');
    else setPage('dashboard');
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return role === 'teacher' ? (
          <TeacherDashboardScreen onNavigate={navigate} />
        ) : (
          <DashboardScreen onNavigate={navigate} />
        );
      case 'subjects':
        return <SubjectsScreen onNavigate={navigate} />;
      case 'materials':
        return <MaterialsScreen onNavigate={navigate} />;
      case 'ai-assistant':
        return <AIStudyAssistantScreen onNavigate={navigate} />;
      case 'quiz':
        return <AssessmentsScreen onNavigate={navigate} />;
      case 'flashcards':
        return <FlashcardsScreen onNavigate={navigate} />;
      case 'summary':
        return <SummariesScreen onNavigate={navigate} />;
      case 'analytics':
        return <AnalyticsScreen onNavigate={navigate} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} />;
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
      title={PAGE_TITLES[page]}
    >
      {renderPage()}
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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AnnouncementsProvider>
            <MainApp />
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