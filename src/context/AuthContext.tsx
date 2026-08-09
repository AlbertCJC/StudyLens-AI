import React, { createContext, useContext, useState } from "react";
import type { User, UserRole } from "../types";

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  login: (emailOrUser: string | Partial<User>, role?: UserRole) => Promise<void>;
  register: (name: string, email: string, role: UserRole, department?: string) => Promise<void>;
  updateUser: (updated: User) => Promise<void>;
  switchRole: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("studylens_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("studylens_token") || null;
  });

  const saveUserSession = (user: User, userToken?: string) => {
    setCurrentUser(user);
    const tok = userToken || `jwt-token-${user.id}-${Date.now()}`;
    setToken(tok);
    try {
      localStorage.setItem("studylens_user", JSON.stringify(user));
      localStorage.setItem("studylens_token", tok);
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }
  };

  const login = async (emailOrUser: string | Partial<User>, role?: UserRole) => {
    try {
      let emailStr = "";
      let userRole = role;
      let customUser: Partial<User> | null = null;

      if (typeof emailOrUser === "string") {
        emailStr = emailOrUser;
      } else if (emailOrUser && typeof emailOrUser === "object") {
        customUser = emailOrUser;
        emailStr = emailOrUser.email || "";
        userRole = emailOrUser.role || role;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailStr, role: userRole, user: customUser }),
      });

      if (res.ok) {
        const data = await res.json();
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

  const register = async (name: string, email: string, role: UserRole, department?: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, department }),
      });
      if (res.ok) {
        const data = await res.json();
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

  const switchRole = (role: UserRole) => {
    let targetUser: User;
    if (role === "student") {
      targetUser = {
        id: "usr-student-1",
        name: "Alex Rivera",
        email: "student@studylens.edu",
        role: "student",
        studentId: "2024-STU-0841",
        department: "Computer Science",
        createdAt: "2024-01-15T08:00:00.000Z",
      };
    } else if (role === "teacher") {
      targetUser = {
        id: "usr-teacher-1",
        name: "Prof. Maria Santos",
        email: "teacher@studylens.edu",
        role: "teacher",
        department: "Computer Science & IT",
        createdAt: "2023-09-01T08:00:00.000Z",
      };
    } else {
      targetUser = {
        id: "usr-admin-1",
        name: "Dr. Arthur Vance",
        email: "admin@studylens.edu",
        role: "admin",
        department: "Academic Affairs",
        createdAt: "2023-08-01T08:00:00.000Z",
      };
    }
    saveUserSession(targetUser);
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUser.id,
        userName: targetUser.name,
        userRole: targetUser.role,
        action: "ROLE_SWITCH",
        details: `Switched view mode to ${role.toUpperCase()} perspective`,
      }),
    }).catch(() => {});
  };

  const updateUser = async (updated: User) => {
    saveUserSession(updated, token || undefined);
    try {
      await fetch(`/api/users/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error("Failed to sync updated user with backend:", err);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    try {
      localStorage.removeItem("studylens_user");
      localStorage.removeItem("studylens_token");
    } catch (e) {
      console.error("Failed to clear localStorage session", e);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, login, register, updateUser, switchRole, logout }}>
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
