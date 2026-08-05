import React, { createContext, useContext, useState } from "react";
import type { User, UserRole } from "../types";

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  login: (emailOrUser: string | Partial<User>, role?: UserRole) => Promise<void>;
  register: (name: string, email: string, role: UserRole, department?: string) => Promise<void>;
  switchRole: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
        setCurrentUser(data.user);
        setToken(data.token);
      } else if (customUser && customUser.name && customUser.role) {
        setCurrentUser({
          id: customUser.id || `usr-${Date.now()}`,
          name: customUser.name,
          email: customUser.email || "user@studylens.edu",
          role: customUser.role,
          department: customUser.department || "General",
        } as User);
        setToken("mock-jwt-token");
      }
    } catch (err) {
      console.error("Login failed:", err);
      if (typeof emailOrUser === "object" && emailOrUser !== null) {
        setCurrentUser({
          id: emailOrUser.id || `usr-${Date.now()}`,
          name: emailOrUser.name || "User",
          email: emailOrUser.email || "user@studylens.edu",
          role: emailOrUser.role || "student",
          department: emailOrUser.department || "General",
        } as User);
        setToken("mock-jwt-token");
      }
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
        setCurrentUser(data.user);
        setToken(data.token);
      }
    } catch (err) {
      console.error("Registration failed:", err);
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
    setCurrentUser(targetUser);
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

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, login, register, switchRole, logout }}>
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
