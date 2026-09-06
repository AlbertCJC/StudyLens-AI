import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, apiChangePassword, apiVerifyTwoFactor, apiVerifyEmail, apiResendEmailCode, setAuthToken, invalidateApiCache, updateUser, User, EmailVerificationPending } from '../services/api';
import { STORAGE_KEYS, getJSON, setJSON, removeItem } from '../utils/storage';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface AuthUser extends User {}

export interface TwoFactorPending {
  userId: string;
  email: string;
}

export class TwoFactorRequiredError extends Error {
  constructor(public readonly pending: TwoFactorPending) {
    super('Two-factor authentication is required.');
    this.name = 'TwoFactorRequiredError';
  }
}

export class EmailVerificationRequiredError extends Error {
  constructor(public readonly pending: EmailVerificationPending) {
    super('Email verification is required.');
    this.name = 'EmailVerificationRequiredError';
  }
}

interface AuthContextType {
  currentUser: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  isOnline: boolean;
  pendingTwoFactor: TwoFactorPending | null;
  pendingEmailVerification: EmailVerificationPending | null;
  login: (email: string, role?: UserRole, password?: string) => Promise<AuthUser>;
  register: (name: string, email: string, role: UserRole, department?: string, password?: string) => Promise<AuthUser>;
  verifyTwoFactor: (code: string) => Promise<AuthUser>;
  cancelTwoFactor: () => void;
  verifyEmail: (code: string) => Promise<AuthUser>;
  resendEmailCode: () => Promise<void>;
  cancelEmailVerification: () => void;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeRole = (role?: string): UserRole => {
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'teacher';
  return 'student';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<TwoFactorPending | null>(null);
  const [pendingEmailVerification, setPendingEmailVerification] = useState<EmailVerificationPending | null>(null);

  const persistSession = useCallback((user: AuthUser, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    setAuthToken(userToken);
    setJSON(STORAGE_KEYS.session, { token: userToken, user });
  }, []);

  useEffect(() => {
    getJSON<{ token: string; user: AuthUser }>(STORAGE_KEYS.session).then(async (session) => {
      if (session?.token && session?.user) {
        // Guard against corrupted avatar placeholders ("None"/"null"/"undefined").
        const rawAvatar = session.user.avatar as unknown;
        const badAvatar =
          !rawAvatar ||
          ['none', 'null', 'undefined'].includes(String(rawAvatar).trim().toLowerCase());
        const user = {
          ...session.user,
          role: normalizeRole(session.user.role),
          ...(badAvatar ? { avatar: undefined } : {}),
        };
        setToken(session.token);
        setAuthToken(session.token);
        setCurrentUser(user);
      }
      setHydrated(true);
    });
  }, [persistSession]);

  const login = useCallback(
    async (email: string, role?: UserRole, password?: string): Promise<AuthUser> => {
      const data = await apiLogin(email, role, undefined, password);
      if ('requiresEmailVerification' in data) {
        setPendingEmailVerification(data);
        throw new EmailVerificationRequiredError(data);
      }
      if ('twoFactorRequired' in data) {
        setPendingTwoFactor({ userId: data.userId, email: data.email });
        throw new TwoFactorRequiredError({ userId: data.userId, email: data.email });
      }
      const user = { ...data.user, role: normalizeRole(data.user.role) };
      setPendingTwoFactor(null);
      setPendingEmailVerification(null);
      persistSession(user, data.token);
      return user;
    },
    [persistSession]
  );

  const verifyTwoFactor = useCallback(
    async (code: string): Promise<AuthUser> => {
      if (!pendingTwoFactor) throw new Error('No pending two-factor verification.');
      const data = await apiVerifyTwoFactor(pendingTwoFactor.userId, code);
      const user = { ...data.user, role: normalizeRole(data.user.role) };
      setPendingTwoFactor(null);
      persistSession(user, data.token);
      return user;
    },
    [pendingTwoFactor, persistSession]
  );

  const verifyEmail = useCallback(
    async (code: string): Promise<AuthUser> => {
      if (!pendingEmailVerification) throw new Error('No pending email verification.');
      const data = await apiVerifyEmail(pendingEmailVerification.userId, code);
      if ('requiresEmailVerification' in data) {
        setPendingEmailVerification(data);
        throw new EmailVerificationRequiredError(data);
      }
      const user = { ...data.user, role: normalizeRole(data.user.role) };
      setPendingEmailVerification(null);
      persistSession(user, data.token);
      return user;
    },
    [pendingEmailVerification, persistSession]
  );

  const resendEmailCode = useCallback(async (): Promise<void> => {
    if (!pendingEmailVerification) throw new Error('No pending email verification.');
    const pending = await apiResendEmailCode(pendingEmailVerification.userId);
    setPendingEmailVerification((prev) => ({ ...(prev || {}), ...pending, userId: pending.userId }));
  }, [pendingEmailVerification]);

  const cancelEmailVerification = useCallback(() => {
    setPendingEmailVerification(null);
  }, []);

  const cancelTwoFactor = useCallback(() => {
    setPendingTwoFactor(null);
  }, []);

  const register = useCallback(
    async (name: string, email: string, role: UserRole, department?: string, password?: string): Promise<AuthUser> => {
      const data = await apiRegister(name, email, role, department, password);
      if ('requiresEmailVerification' in data) {
        setPendingEmailVerification(data);
        throw new EmailVerificationRequiredError(data);
      }
      const user = { ...data.user, role: normalizeRole(data.user.role) };
      persistSession(user, data.token);
      return user;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    setAuthToken(null);
    setPendingEmailVerification(null);
    setPendingTwoFactor(null);
    invalidateApiCache();
    removeItem(STORAGE_KEYS.session);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      if (!currentUser) throw new Error('No active session');
      const data = await apiChangePassword(currentPassword, newPassword);
      // The backend bumped token_version when the password changed, so the old
      // JWT is invalid; swap in the freshly issued token to stay signed in.
      if (data.token && data.user) {
        persistSession({ ...data.user, role: normalizeRole(data.user.role) }, data.token);
      }
    },
    [currentUser, persistSession]
  );

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>): Promise<AuthUser> => {
      if (!currentUser) throw new Error('No active session');
      const updated = { ...currentUser, ...patch, name: patch.name || currentUser.name };
      await setJSON(STORAGE_KEYS.profileEdits(currentUser.id), updated);
      setCurrentUser(updated);
      // Persist into the session payload too: hydration reads the session key,
      // so profile-only edits (e.g. avatar removal) survive an app restart.
      try {
        const session = await getJSON<{ token: string; user: AuthUser }>(STORAGE_KEYS.session);
        if (session?.token) {
          await setJSON(STORAGE_KEYS.session, { token: session.token, user: updated });
        }
      } catch {
        // Non-fatal: the profileEdits copy still holds the change.
      }
      updateUser(currentUser.id, {
        name: updated.name,
        role: updated.role as 'student' | 'teacher' | 'admin',
        avatar: updated.avatar ?? null,
        department: updated.department,
        status: updated.status,
      }).catch(() => {});
      return updated;
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{ currentUser, token, hydrated, isOnline: !!token, pendingTwoFactor, pendingEmailVerification, login, register, verifyTwoFactor, cancelTwoFactor, verifyEmail, resendEmailCode, cancelEmailVerification, logout, updateProfile, changePassword }}
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