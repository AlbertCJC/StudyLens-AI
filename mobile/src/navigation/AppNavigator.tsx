import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  CheckSquare,
  ShieldCheck,
  Users,
  Settings as SettingsIcon,
  BookOpen,
  Layers,
  TrendingUp,
  FileText,
  Bell,
} from 'lucide-react-native';
import { useAuth, UserRole } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import DashboardLayout, { MenuItem } from '../components/DashboardLayout';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TeacherDashboardScreen from '../screens/TeacherDashboardScreen';
import SubjectsScreen from '../screens/SubjectsScreen';
import SubjectDetailScreen from '../screens/SubjectDetailScreen';
import MaterialsScreen from '../screens/MaterialsScreen';
import AIStudyAssistantScreen from '../screens/AIStudyAssistantScreen';
import AssessmentsScreen from '../screens/AssessmentsScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import TeacherAnalyticsScreen from '../screens/TeacherAnalyticsScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import type { RootStackParamList, RoleTabsParamList, AdminTabKey } from './types';
import { navigationRef, navTo, openSubject, openQuiz, openQuizById, openWeakTopic, openCreateNotes, goBack, currentRoleRef, useRefreshKey, bumpRefresh } from './navigationRef';
import { selectionAsync } from 'expo-haptics';
import { Platform } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RoleTabsParamList>();

const PAGE_TITLES: Record<string, string> = {
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

function useMenuItems(role: UserRole): MenuItem[] {
  const { unreadAnnouncements } = useAnnouncements();
  const announceBadge = unreadAnnouncements;

  const studentMenuItems: MenuItem[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'subjects', label: 'My Subjects', Icon: FolderKanban },
    { key: 'materials', label: 'Learning Materials', Icon: BookOpen },
    { key: 'ai-assistant', label: 'AI Study Assistant', Icon: Sparkles },
    { key: 'quiz', label: 'Quizzes & Tests', Icon: CheckSquare },
    { key: 'flashcards', label: 'Flashcards', Icon: Layers },
    { key: 'analytics', label: 'My Progress', Icon: TrendingUp },
    { key: 'announcements', label: 'Announcements', Icon: Bell, badge: announceBadge > 0 ? String(announceBadge) : undefined },
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
  ];

  const adminMenuItems: MenuItem[] = [
    { key: 'admin', label: 'Admin Dashboard', Icon: ShieldCheck },
    { key: 'admin-users', label: 'User Management', Icon: Users },
    { key: 'subjects', label: 'Subject Catalog', Icon: FolderKanban },
    { key: 'reports', label: 'Reports & Analytics', Icon: FileText },
    { key: 'announcements', label: 'System Announcements', Icon: Bell, badge: announceBadge > 0 ? String(announceBadge) : undefined },
    { key: 'admin-logs', label: 'Audit Activity Logs', Icon: TrendingUp },
    { key: 'admin-settings', label: 'System Settings', Icon: SettingsIcon },
  ];

  if (role === 'teacher') return teacherMenuItems;
  if (role === 'admin') return adminMenuItems;
  return studentMenuItems;
}

function useRole(): UserRole {
  const { currentUser } = useAuth();
  return (currentUser?.role === 'teacher' ? 'teacher' : currentUser?.role === 'admin' ? 'admin' : 'student') as UserRole;
}

const lightTap = () => {
  if (Platform.OS === 'web') return;
  try {
    selectionAsync().catch(() => {});
  } catch {
    /* no-op */
  }
};

interface ShellProps {
  title: string;
  activeKey: string;
  onBack?: () => void;
  children: React.ReactNode;
}

function Shell({ title, activeKey, onBack, children }: ShellProps) {
  const role = useRole();
  const menuItems = useMenuItems(role);
  // Every screen is rendered inside this Shell, so keying the content on the
  // screen's own refresh counter is the single place that gives re-tap-to-refresh
  // behaviour to both the bottom tabs and the pushed stack screens. Scoped per
  // activeKey, so refreshing one screen never resets another.
  const refreshKey = useRefreshKey(activeKey);
  return (
    <DashboardLayout
      menuItems={menuItems}
      activeKey={activeKey}
      onNavigate={navTo}
      onQuickNavigate={navTo}
      title={title}
      onBack={onBack}
    >
      <React.Fragment key={refreshKey}>{children}</React.Fragment>
    </DashboardLayout>
  );
}

/* ------------------------------ TAB SCREENS ------------------------------ */

function HomeTab() {
  const role = useRole();
  if (role === 'teacher') {
    return (
      <Shell title={PAGE_TITLES.dashboard} activeKey="dashboard">
        <TeacherDashboardScreen onNavigate={navTo} />
      </Shell>
    );
  }
  return (
    <Shell title={PAGE_TITLES.dashboard} activeKey="dashboard">
      <DashboardScreen onNavigate={navTo} onOpenWeakTopic={openWeakTopic} onOpenSubject={openSubject} />
    </Shell>
  );
}

function SubjectsTab() {
  return (
    <Shell title={PAGE_TITLES.subjects} activeKey="subjects">
      <SubjectsScreen onNavigate={navTo} onOpenSubject={openSubject} />
    </Shell>
  );
}

function AITab({ route, navigation }: any) {
  const { initialTopic, initialMaterial } = route.params ?? {};
  const consume = React.useCallback(() => {
    navigation.setParams({ initialTopic: null, initialMaterial: null });
  }, [navigation]);
  return (
    <Shell title={PAGE_TITLES['ai-assistant']} activeKey="ai-assistant">
      <AIStudyAssistantScreen
        onNavigate={navTo}
        initialTopic={initialTopic ?? null}
        initialMaterial={initialMaterial ?? null}
        onSeedConsumed={consume}
      />
    </Shell>
  );
}

function QuizzesTab() {
  return (
    <Shell title={PAGE_TITLES.quiz} activeKey="quiz">
      <AssessmentsScreen onNavigate={navTo} />
    </Shell>
  );
}

function AdminTab({ route }: any) {
  const initialTab: AdminTabKey = route.params?.initialTab ?? 'overview';
  return (
    <Shell title={PAGE_TITLES.admin} activeKey="admin">
      {/* Keyed so navigating to a different admin section (e.g. audit logs)
          remounts the screen and applies the requested initial tab. */}
      <AdminDashboardScreen key={initialTab} onNavigate={navTo} initialTab={initialTab} />
    </Shell>
  );
}

function AdminUsersTab() {
  return (
    <Shell title={PAGE_TITLES['admin-users']} activeKey="admin-users">
      <AdminDashboardScreen onNavigate={navTo} initialTab="users" />
    </Shell>
  );
}

function AdminSettingsTab() {
  return (
    <Shell title={PAGE_TITLES['admin-settings']} activeKey="admin-settings">
      <AdminDashboardScreen onNavigate={navTo} initialTab="settings" />
    </Shell>
  );
}

/* ------------------------------ TAB NAVIGATOR ---------------------------- */

/**
 * Tab route name -> the activeKey its Shell registers under. The two vocabularies
 * differ (route "Quizzes" renders a Shell keyed "quiz"), so a bottom-tab re-tap has
 * to translate before bumping, or it would refresh the wrong counter.
 */
const TAB_ACTIVE_KEYS: Record<string, string> = {
  Home: 'dashboard',
  Admin: 'admin',
  Users: 'admin-users',
  Settings: 'admin-settings',
  Subjects: 'subjects',
  Quizzes: 'quiz',
  AI: 'ai-assistant',
};

function tabScreens(role: UserRole) {
  if (role === 'admin') {
    return (
      <>
        <Tab.Screen name="Admin" component={AdminTab} options={{ title: 'Home' }} />
        <Tab.Screen name="Users" component={AdminUsersTab} options={{ title: 'Users' }} />
        <Tab.Screen name="Subjects" component={SubjectsTab} options={{ title: 'Subjects' }} />
        <Tab.Screen name="Settings" component={AdminSettingsTab} options={{ title: 'Settings' }} />
      </>
    );
  }
  return (
    <>
      <Tab.Screen name="Home" component={HomeTab} options={{ title: 'Home' }} />
      <Tab.Screen name="Subjects" component={SubjectsTab} options={{ title: 'Subjects' }} />
      <Tab.Screen name="Quizzes" component={QuizzesTab} options={{ title: 'Quizzes' }} />
      <Tab.Screen name="AI" component={AITab} options={{ title: 'AI Assistant' }} />
    </>
  );
}

function RoleTabs() {
  const role = useRole();
  const { colors, isDark } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: isDark ? colors.card : colors.topbarBg,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIconStyle: { marginTop: 2 },
      }}
      screenListeners={({ route, navigation }) => ({
        tabPress: (e) => {
          lightTap();
          // Re-tapping the already-focused tab does not re-render the screen, so
          // it would keep stale data and in-progress state. navigation.isFocused()
          // is true only for a re-tap, which makes it the signal to refresh.
          if (navigation.isFocused()) {
            e.preventDefault();
            const activeKey = TAB_ACTIVE_KEYS[route.name];
            if (activeKey) bumpRefresh(activeKey);
          }
        },
      })}
    >
      {tabScreens(role)}
    </Tab.Navigator>
  );
}

/* ---------------------------- DETAIL ROUTES ------------------------------ */

function SubjectDetailRoute({ route, navigation }: any) {
  const { subject, initialTab } = route.params ?? {};
  if (!subject) return <SubjectsTab />;
  return (
    <Shell title={subject.name} activeKey="subjectDetail">
      <SubjectDetailScreen
        subject={subject}
        onBack={() => { goBack(); }}
        onNavigate={navTo}
        onOpenQuiz={(quiz) => { lightTap(); openQuiz(quiz, true); }}
        initialTab={initialTab ?? null}
      />
    </Shell>
  );
}

function QuizRoute({ route, navigation }: any) {
  const { autoOpenQuizId, hasReturnOrigin } = route.params ?? {};
  return (
    <Shell title={PAGE_TITLES.quiz} activeKey="quiz" onBack={() => { goBack(); }}>
      <AssessmentsScreen
        onNavigate={navTo}
        autoOpenQuizId={autoOpenQuizId ?? null}
        onAutoOpenHandled={() => navigation.setParams({ autoOpenQuizId: undefined })}
        hasReturnOrigin={!!hasReturnOrigin}
        onReturnToOrigin={() => { goBack(); }}
      />
    </Shell>
  );
}

function MaterialsRoute() {
  return (
    <Shell title={PAGE_TITLES.materials} activeKey="materials" onBack={() => { goBack(); }}>
      <MaterialsScreen onNavigate={navTo} onCreateNotes={openCreateNotes} />
    </Shell>
  );
}

function FlashcardsRoute() {
  return (
    <Shell title={PAGE_TITLES.flashcards} activeKey="flashcards" onBack={() => { goBack(); }}>
      <FlashcardsScreen onNavigate={navTo} />
    </Shell>
  );
}

function AnalyticsRoute() {
  const role = useRole();
  return (
    <Shell title={PAGE_TITLES.analytics} activeKey="analytics" onBack={() => { goBack(); }}>
      {role === 'student' ? (
        <AnalyticsScreen onNavigate={navTo} onOpenWeakTopic={openWeakTopic} />
      ) : (
        <TeacherAnalyticsScreen onNavigate={navTo} />
      )}
    </Shell>
  );
}

function ReportsRoute() {
  return (
    <Shell title={PAGE_TITLES.reports} activeKey="reports" onBack={() => { goBack(); }}>
      <ReportsScreen onNavigate={navTo} />
    </Shell>
  );
}

function AnnouncementsRoute() {
  return (
    <Shell title={PAGE_TITLES.announcements} activeKey="announcements" onBack={() => { goBack(); }}>
      <AnnouncementsScreen onNavigate={navTo} />
    </Shell>
  );
}

function NotificationsRoute() {
  return (
    <Shell title={PAGE_TITLES.notifications} activeKey="notifications" onBack={() => { goBack(); }}>
      <NotificationsScreen onNavigate={navTo} onOpenQuiz={openQuizById} />
    </Shell>
  );
}

function ProfileRoute() {
  return (
    <Shell title={PAGE_TITLES.profile} activeKey="profile" onBack={() => { goBack(); }}>
      <ProfileScreen onNavigate={navTo} />
    </Shell>
  );
}

/* ------------------------------- ROOT STACK ------------------------------ */

function RootNavigator() {
  const { currentUser } = useAuth();
  const role = useRole();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!currentUser ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Group key={`${currentUser.id}:${role}`}>
          <Stack.Screen name="Main" component={RoleTabs} />
          <Stack.Screen name="SubjectDetail" component={SubjectDetailRoute} />
          <Stack.Screen name="Quiz" component={QuizRoute} />
          <Stack.Screen name="Materials" component={MaterialsRoute} />
          <Stack.Screen name="Flashcards" component={FlashcardsRoute} />
          <Stack.Screen name="Analytics" component={AnalyticsRoute} />
          <Stack.Screen name="Reports" component={ReportsRoute} />
          <Stack.Screen name="Announcements" component={AnnouncementsRoute} />
          <Stack.Screen name="Notifications" component={NotificationsRoute} />
          <Stack.Screen name="Profile" component={ProfileRoute} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const role = useRole();
  currentRoleRef.current = role;
  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}