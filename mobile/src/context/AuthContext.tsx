import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, setAuthToken, User } from '../services/api';
import { STORAGE_KEYS, getJSON, setJSON, removeItem } from '../utils/storage';

export type UserRole = 'student' | 'teacher';

export interface AuthUser extends User {}

interface AuthContextType {
  currentUser: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  isOnline: boolean;
  login: (email: string, role?: UserRole) => Promise<AuthUser>;
  quickLogin: (profile: Partial<AuthUser>) => Promise<AuthUser>;
  register: (name: string, email: string, role: UserRole, department?: string) => Promise<AuthUser>;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<UserRole, AuthUser> = {
  student: {
    id: 'usr-student-1',
    name: 'John Wendyl S. Sanchez',
    firstName: 'John Wendyl',
    lastName: 'Sanchez',
    email: 'student@studylens.edu',
    role: 'student',
    department: 'Computer Science',
    studentId: '2024-STU-0841',
    status: 'active',
    createdAt: '2024-01-15T08:00:00.000Z',
  },
  teacher: {
    id: 'usr-teacher-1',
    name: 'Christian C. Barral, MIT',
    firstName: 'Christian C.',
    lastName: 'Barral, MIT',
    email: 'teacher@studylens.edu',
    role: 'teacher',
    department: 'College of Computer Studies',
    status: 'active',
    createdAt: '2023-09-01T08:00:00.000Z',
  },
};

const normalizeRole = (role?: string): UserRole => {
  if (role === 'teacher' || role === 'admin') return 'teacher';
  return 'student';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getJSON<{ token: string; user: AuthUser }>(STORAGE_KEYS.session).then((session) => {
      if (session?.token && session?.user) {
        const user = { ...session.user, role: normalizeRole(session.user.role) };
        setToken(session.token);
        setAuthToken(session.token);
        setCurrentUser(user);
      }
      setHydrated(true);
    });
  }, []);

  const persistSession = useCallback((user: AuthUser, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    setAuthToken(userToken);
    setJSON(STORAGE_KEYS.session, { token: userToken, user });
  }, []);

  const login = useCallback(
    async (email: string, role?: UserRole): Promise<AuthUser> => {
      try {
        const data = await apiLogin(email, role);
        const user = { ...data.user, role: normalizeRole(data.user.role) };
        persistSession(user, data.token);
        return user;
      } catch (err) {
        const user = { ...DEMO_USERS[role || 'student'] };
        persistSession(user, `jwt-token-${user.id}-${Date.now()}`);
        return user;
      }
    },
    [persistSession]
  );

  const quickLogin = useCallback(
    async (profile: Partial<AuthUser>): Promise<AuthUser> => {
      const role = normalizeRole(profile.role) as UserRole;
      try {
        const data = await apiLogin(profile.email || '', role, {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role,
          department: profile.department,
          studentId: profile.studentId,
        });
        const user = { ...data.user, role: normalizeRole(data.user.role) };
        persistSession(user, data.token);
        return user;
      } catch {
        const demo = DEMO_USERS[role];
        const user = { ...demo, ...profile, role } as AuthUser;
        persistSession(user, `jwt-token-${user.id}-${Date.now()}`);
        return user;
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (name: string, email: string, role: UserRole, department?: string): Promise<AuthUser> => {
      try {
        const data = await apiRegister(name, email, role, department);
        const user = { ...data.user, role: normalizeRole(data.user.role) };
        persistSession(user, data.token);
        return user;
      } catch {
        const user: AuthUser = {
          id: `usr-${role}-${Date.now()}`,
          name,
          email: email || `user${Date.now()}@studylens.edu`,
          role,
          department: department || (role === 'student' ? 'Computer Science' : 'Computer Science & IT'),
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        persistSession(user, `jwt-token-${user.id}-${Date.now()}`);
        return user;
      }
    },
    [persistSession]
  );

  const switchRole = useCallback(
    (role: UserRole) => {
      const user = DEMO_USERS[role];
      persistSession(user, `jwt-token-${user.id}-${Date.now()}`);
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    setAuthToken(null);
    removeItem(STORAGE_KEYS.session);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>): Promise<AuthUser> => {
      if (!currentUser) throw new Error('No active session');
      const updated = { ...currentUser, ...patch, name: patch.name || currentUser.name };
      await setJSON(STORAGE_KEYS.profileEdits(currentUser.id), updated);
      setCurrentUser(updated);
      return updated;
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{ currentUser, token, hydrated, isOnline: !!token, login, quickLogin, register, switchRole, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};