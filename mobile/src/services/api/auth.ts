import {
  getApiBaseUrl,
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
// AUTH
// ----------------------------------------------------------------
export interface EmailVerificationPending {
  requiresEmailVerification: true;
  userId: string;
  email: string;
  devCode?: string;
  expiresInMinutes: number;
}

export type LoginResult =
  | { token: string; user: User }
  | { twoFactorRequired: true; userId: string; email: string; expiresInMinutes: number }
  | EmailVerificationPending;

export async function apiLogin(email: string, role?: string, user?: Partial<User>, password?: string): Promise<LoginResult> {
  const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, role, user, password }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Login failed');
  }
  const data = await res.json();
  if (data.twoFactorRequired) return data;
  if (data.requiresEmailVerification) return data as EmailVerificationPending;
  setAuthToken(data.token);
  return data;
}

export async function apiVerifyTwoFactor(userId: string, code: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/verify-2fa`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ userId, code }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Verification failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiRegister(
  name: string,
  email: string,
  role: UserRole,
  department?: string,
  password?: string
): Promise<{ token: string; user: User } | EmailVerificationPending> {
  const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ name, email, role, department, password }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Registration failed');
  }
  const data = await res.json();
  if (data.requiresEmailVerification) return data as EmailVerificationPending;
  setAuthToken(data.token);
  return data;
}

export async function apiVerifyEmail(userId: string, code: string): Promise<{ token: string; user: User } | EmailVerificationPending> {
  const res = await fetch(`${getApiBaseUrl()}/auth/verify-email`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ userId, code }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Email verification failed');
  }
  const data = await res.json();
  if (data.requiresEmailVerification) return data as EmailVerificationPending;
  setAuthToken(data.token);
  return data;
}

export async function apiResendEmailCode(userId: string): Promise<EmailVerificationPending> {
  const res = await fetch(`${getApiBaseUrl()}/auth/resend-email-code`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ userId }),
  });
  const errBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errBody.error || 'Could not resend the verification code.');
  }
  return {
    requiresEmailVerification: true,
    userId: errBody.userId || userId,
    email: errBody.email,
    devCode: errBody.devCode,
    expiresInMinutes: errBody.expiresInMinutes,
  };
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<{ token?: string; user?: User }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Could not update the password.');
  }
  const body = await res.json().catch(() => ({}));
  return { token: body.token, user: body.user };
}

export async function apiRequestResetOtp(email: string): Promise<{ devCode?: string; expiresInMinutes?: number }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/reset-otp`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email }),
  });
  const errBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errBody.error || 'Could not issue a reset code.');
  }
  return { devCode: errBody.devCode, expiresInMinutes: errBody.expiresInMinutes };
}

export async function apiVerifyResetOtp(email: string, otp: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/auth/verify-reset-otp`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, otp }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'That verification code is incorrect.');
  }
}

export async function apiResetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email, otp, newPassword }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Could not reset the password.');
  }
}
