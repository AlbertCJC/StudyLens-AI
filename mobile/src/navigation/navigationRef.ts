import React from 'react';
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';
import type { RootStackParamList, AISeedParams } from './types';
import type { Subject, Quiz, Material } from '../services/api';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Kept in sync by the AppNavigator so the standalone nav helpers can make
 * role-aware decisions (e.g. admin has no AI bottom tab, but none have a
 * Profile tab — profile is the shared pushed screen).
 */
export const currentRoleRef: { current: 'student' | 'teacher' | 'admin' } = { current: 'student' };

function isReady(): boolean {
  return navigationRef.isReady();
}

/**
 * Resolve the old "page key" vocabulary used throughout the app's screens
 * (dashboard, ai-assistant, quiz, analytics, admin-*, ...) into an actual
 * react-navigation action: switch a bottom tab, or push a detail screen.
 */
/**
 * Re-clicking the drawer item for the screen you are already on re-dispatches
 * the same tab/stack navigation, which react-navigation ignores -- so the
 * screen keeps its stale data and in-progress state. Each screen is keyed on
 * its own counter (see useRefreshKey) and bumping it remounts that screen.
 * Scoped per key so refreshing Materials leaves Flashcards untouched.
 */
const refreshKeys: Record<string, number> = {};
const refreshListeners = new Set<() => void>();

export function bumpRefresh(key: string): void {
  refreshKeys[key] = (refreshKeys[key] ?? 0) + 1;
  refreshListeners.forEach((fn) => fn());
}

export function getRefreshKey(key: string): number {
  return refreshKeys[key] ?? 0;
}

/** Subscribe to remount counter for a screen key. */
export function useRefreshKey(key: string): number {
  return React.useSyncExternalStore(
    React.useCallback((onChange: () => void) => {
      refreshListeners.add(onChange);
      return () => {
        refreshListeners.delete(onChange);
      };
    }, []),
    React.useCallback(() => getRefreshKey(key), [key])
  );
}

export function navTo(key: string, params?: AISeedParams): void {
  if (!isReady()) return;
  const nk = key.toLowerCase().trim();
  const safe = (action: () => void) => {
    try {
      action();
    } catch {
      /* ignore navigation errors */
    }
  };

  switch (nk) {
    case 'dashboard':
    case 'home':
      // Admin has no "Home" tab — its landing is the Admin tab.
      if (currentRoleRef.current === 'admin') {
        safe(() =>
          navigationRef.navigate('Main', { screen: 'Admin', params: { initialTab: 'overview' } } as never)
        );
      } else {
        safe(() => navigationRef.navigate('Main', { screen: 'Home' } as never));
      }
      return;
    case 'subjects':
      safe(() => navigationRef.navigate('Main', { screen: 'Subjects' } as never));
      return;
    case 'ai-assistant':
    case 'ai':
      // Admin has no AI tab; fall back to the Subjects tab.
      if (currentRoleRef.current === 'admin') {
        safe(() => navigationRef.navigate('Main', { screen: 'Subjects' } as never));
      } else {
        safe(() => navigationRef.navigate('Main', { screen: 'AI', params } as never));
      }
      return;
    case 'quiz':
    case 'assessments':
    case 'assessments & quizzes':
      safe(() => navigationRef.navigate('Main', { screen: 'Quizzes' } as never));
      return;
    case 'profile':
      // No role has a Profile bottom tab — push the shared Profile screen.
      safe(() => navigationRef.navigate('Profile' as never));
      return;
    case 'admin':
      safe(() =>
        navigationRef.navigate('Main', { screen: 'Admin', params: { initialTab: 'overview' } } as never)
      );
      return;
    case 'admin-users':
      safe(() => navigationRef.navigate('Main', { screen: 'Users' } as never));
      return;
    case 'admin-settings':
      safe(() => navigationRef.navigate('Main', { screen: 'Settings' } as never));
      return;
    case 'admin-logs':
      safe(() =>
        navigationRef.navigate('Main', { screen: 'Admin', params: { initialTab: 'logs' } } as never)
      );
      return;
    case 'materials':
      safe(() => navigationRef.navigate('Materials' as never));
      return;
    case 'flashcards':
      safe(() => navigationRef.navigate('Flashcards' as never));
      return;
    case 'analytics':
    case 'progress':
      safe(() => navigationRef.navigate('Analytics' as never));
      return;
    case 'reports':
      safe(() => navigationRef.navigate('Reports' as never));
      return;
    case 'announcements':
      safe(() => navigationRef.navigate('Announcements' as never));
      return;
    case 'notifications':
      safe(() => navigationRef.navigate('Notifications' as never));
      return;
    default:
      navigateFuzzy(nk);
  }
}

function navigateFuzzy(nk: string): void {
  if (!isReady()) return;
  const isAdmin = currentRoleRef.current === 'admin';
  const toHome = () =>
    navigationRef.navigate(
      'Main',
      isAdmin
        ? ({ screen: 'Admin', params: { initialTab: 'overview' } } as never)
        : ({ screen: 'Home' } as never)
    );
  try {
    if (nk.includes('admin')) {
      navigationRef.navigate('Main', { screen: 'Admin' } as never);
    } else if (nk.includes('assess') || nk.includes('quiz')) {
      navigationRef.navigate('Main', { screen: 'Quizzes' } as never);
    } else if (nk.includes('flash')) {
      navigationRef.navigate('Flashcards' as never);
    } else if (nk.includes('material')) {
      navigationRef.navigate('Materials' as never);
    } else if (nk.includes('ai')) {
      if (!isAdmin) navigationRef.navigate('Main', { screen: 'AI' } as never);
      else toHome();
    } else if (nk.includes('analytics') || nk.includes('progress')) {
      navigationRef.navigate('Analytics' as never);
    } else if (nk.includes('report')) {
      navigationRef.navigate('Reports' as never);
    } else if (nk.includes('notif')) {
      navigationRef.navigate('Notifications' as never);
    } else if (nk.includes('announce')) {
      navigationRef.navigate('Announcements' as never);
    } else if (nk.includes('subject')) {
      navigationRef.navigate('Main', { screen: 'Subjects' } as never);
    } else if (nk.includes('profile')) {
      navigationRef.navigate('Profile' as never);
    } else {
      toHome();
    }
  } catch {
    /* ignore */
  }
}

export function openSubject(subject: Subject, initialTab?: string | null): void {
  if (!isReady()) return;
  try {
    navigationRef.dispatch(
      StackActions.push('SubjectDetail', { subject, initialTab: initialTab ?? null } as never)
    );
  } catch {
    /* ignore */
  }
}

/** Open a quiz and (optionally) return to where it was launched from. */
export function openQuiz(quiz: Quiz, hasReturnOrigin = false): void {
  if (!isReady()) return;
  try {
    navigationRef.dispatch(
      StackActions.push('Quiz', {
        autoOpenQuizId: quiz.id,
        hasReturnOrigin,
      } as never)
    );
  } catch {
    /* ignore */
  }
}

export function openQuizById(quizId: string): void {
  if (!isReady()) return;
  try {
    navigationRef.dispatch(
      StackActions.push('Quiz', { autoOpenQuizId: quizId, hasReturnOrigin: false } as never)
    );
  } catch {
    /* ignore */
  }
}

export function openWeakTopic(topic: string): void {
  if (!isReady()) return;
  try {
    navigationRef.navigate('Main', {
      screen: 'AI',
      params: { initialTopic: topic },
    } as never);
  } catch {
    /* ignore */
  }
}

export function openCreateNotes(material: Material): void {
  if (!isReady()) return;
  try {
    navigationRef.navigate('Main', {
      screen: 'AI',
      params: {
        initialMaterial: {
          title: material.title,
          content: material.extractedText || material.description || material.title,
        },
      },
    } as never);
  } catch {
    /* ignore */
  }
}

export function goBack(): void {
  if (isReady() && navigationRef.canGoBack()) {
    try {
      navigationRef.goBack();
    } catch {
      /* ignore */
    }
  }
}