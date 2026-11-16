/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState } from "react";

/**
 * Returns true if the account was created within `thresholdDays` days (default 7).
 * Treats missing/unparseable createdAt as a new account so a first-time visitor
 * gets the "Welcome" greeting instead of "Welcome back".
 */
export function isNewUser(createdAt: string | undefined, thresholdDays = 7): boolean {
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return ageDays <= thresholdDays;
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);

  if (abs < 45_000) return "just now";

  const mins = Math.floor(abs / 60_000);
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return future ? `in ${days}d` : `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatExactTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useTickingClock(intervalMs = 30_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/**
 * Self-ticking relative timestamp. Re-renders on its own interval so labels
 * like "just now" advance to "5m ago" without relying on parent re-renders.
 */
export const RelativeTime: React.FC<{
  iso: string | undefined;
  className?: string;
  intervalMs?: number;
}> = ({ iso, className, intervalMs = 30_000 }) => {
  const [, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  if (!iso) return null;

  return (
    <span className={className} title={formatExactTime(iso)}>
      {formatRelativeTime(iso)}
    </span>
  );
};
