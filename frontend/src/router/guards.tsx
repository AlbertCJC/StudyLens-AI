/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

// The backend remains the authority; these guards are defense in depth.
export const elementForRole = (role: UserRole): string =>
  role === "admin" ? "/admin/dashboard" : role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

export const AccessDenied: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
    <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
    <p className="text-muted-foreground mb-6">
      You do not have permission to view this page.
    </p>
    <button className="px-4 py-2 bg-cta-gradient text-white rounded hover:brightness-110" onClick={() => window.dispatchEvent(new CustomEvent("auth:logout"))}>
      Sign Out
    </button>
  </div>
);

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const RequireRole: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { currentUser } = useAuth();
  const role = (currentUser?.role || "student") as UserRole;
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  if (!roles.includes(role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
};
