import React from "react";
import type { UserRole, User } from "../../../types";
import { CardDetailModal, DetailRow } from "../../../components/CardDetailModal";

interface AdminUserDetailCardProps {
  open: boolean;
  users: User[];
  onClose: () => void;
  onRoleClick: (role: string) => void;
  onSuspendedClick: () => void;
}

export const AdminUserDetailCard: React.FC<AdminUserDetailCardProps> = ({
  open,
  users,
  onClose,
  onRoleClick,
  onSuspendedClick,
}) => (
  <CardDetailModal
    open={open}
    title="User Accounts"
    subtitle={`${users.length} registered account${users.length === 1 ? "" : "s"} in the system.`}
    onClose={onClose}
  >
    <ul className="space-y-2">
      {(["student", "teacher", "admin"] as UserRole[]).map((role) => {
        const count = users.filter((u) => u.role === role).length;
        const label = role === "student" ? "Students" : role === "teacher" ? "Teachers" : "Administrators";
        return (
          <li key={role}>
            <DetailRow
              label={label}
              trailing={
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-structure text-primary dark:text-indigo-300">
                  {count}
                </span>
              }
              onClick={() => onRoleClick(role)}
            />
          </li>
        );
      })}
      <li>
        <DetailRow
          label="Suspended Accounts"
          trailing={
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
              {users.filter((u) => u.status === "suspended").length}
            </span>
          }
          onClick={onSuspendedClick}
        />
      </li>
    </ul>
  </CardDetailModal>
);
