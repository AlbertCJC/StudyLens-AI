import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, UserRole } from "../types";
import { authFetch, setStoredToken } from "../utils/authFetch";

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  pendingEmailVerification: { userId: string; email: string; devCode?: string } | null;
  login: (emailOrUser: string | Partial<User>, role?: UserRole, password?: string) => Promise<void>;
  register: (name: string, email: string, role: UserRole, department?: string, password?: string) => Promise<void>;
  verifyEmail: (userId: string, code: string) => Promise<void>;
  resendEmailCode: (userId: string) => Promise<void>;
  clearEmailVerification: () => void;
  updateUser: (updated: User) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Guard against corrupted avatar placeholders ("None"/"null"/"undefined")
  // that must render as the initials fallback instead of a broken image.
  const sanitizeAvatar = (u: User | null): User | null => {
    if (!u) return u;
    const raw = (u as { avatar?: unknown }).avatar;
    if (!raw || ["none", "null", "undefined"].includes(String(raw).trim().toLowerCase())) {
      return { ...u, avatar: undefined } as User;
    }
    return u;
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("studylens_user");
      return saved ? sanitizeAvatar(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("studylens_token") || null;
  });
  const [pendingEmailVerification, setPendingEmailVerification] = useState<{ userId: string; email: string; devCode?: string } | null>(null);

  const saveUserSession = (user: User, userToken?: string) => {
    const cleanUser = sanitizeAvatar(user);
    setCurrentUser(cleanUser);
    const tok = userToken || null;
    setToken(tok);
    setStoredToken(tok);
    try {
      localStorage.setItem("studylens_user", JSON.stringify(cleanUser));
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }
  };

  const login = async (emailOrUser: string | Partial<User>, role?: UserRole, password?: string) => {
    try {
      let emailStr = "";
      let userRole = role;
      let customUser: Partial<User> | null = null;
      let userPassword: string | undefined = password;

      if (typeof emailOrUser === "string") {
        emailStr = emailOrUser;
      } else if (emailOrUser && typeof emailOrUser === "object") {
        customUser = emailOrUser;
        emailStr = emailOrUser.email || "";
        userRole = emailOrUser.role || role;
        userPassword = (emailOrUser as { password?: string }).password || password;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailStr, role: userRole, user: customUser, password: userPassword }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.requiresEmailVerification) {
          setPendingEmailVerification({
            userId: data.userId,
            email: data.email,
            devCode: data.devCode,
          });
          return;
        }
        saveUserSession(data.user, data.token);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      console.warn("Login notice:", err);
      throw err;
    }
  };

  const register = async (name: string, email: string, role: UserRole, department?: string, password?: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, department, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiresEmailVerification) {
          setPendingEmailVerification({
            userId: data.userId,
            email: data.email,
            devCode: data.devCode,
          });
          return;
        }
        saveUserSession(data.user, data.token);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Registration failed.");
      }
    } catch (err) {
      console.warn("Registration notice:", err);
      throw err;
    }
  };

  const verifyEmail = async (userId: string, code: string) => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not verify the email. Please try again.");
      }
      if (data.requiresEmailVerification) {
        setPendingEmailVerification({
          userId: data.userId,
          email: data.email,
          devCode: data.devCode,
        });
        return;
      }
      saveUserSession(data.user, data.token);
      setPendingEmailVerification(null);
    } catch (err) {
      console.warn("Email verification notice:", err);
      throw err;
    }
  };

  const resendEmailCode = async (userId: string) => {
    const res = await fetch("/api/auth/resend-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not resend the verification code.");
    }
    if (data.devCode) {
      setPendingEmailVerification({ userId, email: pendingEmailVerification?.email || data.email, devCode: data.devCode });
    }
  };

  const clearEmailVerification = () => {
    setPendingEmailVerification(null);
  };

  const updateUser = async (updated: User) => {
    saveUserSession(updated, token || undefined);
    try {
      await authFetch(`/api/users/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Failed to sync updated user with backend:", err);
    }
  };

  // Replaces the stored session after a server-side security event (e.g. a
  // password change bumped token_version, so the old JWT is now invalid and a
  // fresh one was issued in the response).
  const refreshSession = (user: User, userToken: string) => {
    saveUserSession(user, userToken);
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setStoredToken(null);
    setPendingEmailVerification(null);
    try {
      localStorage.removeItem("studylens_user");

    } catch (e) {
      console.error("Failed to clear localStorage session", e);
    }
  };

  useEffect(() => {
    const onSessionExpired = () => {
      setCurrentUser(null);
      setToken(null);
      setStoredToken(null);
      setPendingEmailVerification(null);
      try {
        localStorage.removeItem("studylens_user");
      } catch (e) {
        console.error("Failed to clear localStorage session", e);
      }
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => window.removeEventListener("auth:session-expired", onSessionExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{ currentUser, token, pendingEmailVerification, login, register, verifyEmail, resendEmailCode, clearEmailVerification, updateUser, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
