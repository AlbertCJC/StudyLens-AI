import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatExactTime, formatRelativeTime } from '../src/utils/time';

describe('time formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatRelativeTime(undefined)).toBe('');
    expect(formatRelativeTime('not a date')).toBe('');
    expect(formatExactTime(undefined)).toBe('');
  });

  it('formats recent and past timestamps', () => {
    expect(formatRelativeTime('2026-01-15T11:59:30Z')).toBe('just now');
    expect(formatRelativeTime('2026-01-15T11:30:00Z')).toBe('30m ago');
    expect(formatRelativeTime('2026-01-15T09:00:00Z')).toBe('3h ago');
  });

  it('formats future timestamps', () => {
    expect(formatRelativeTime('2026-01-15T12:30:00Z')).toBe('in 30m');
    expect(formatRelativeTime('2026-01-16T12:00:00Z')).toBe('in 1d');
  });

  it('formats an exact timestamp', () => {
    expect(formatExactTime('2026-01-15T12:00:00Z')).toMatch(/2026/);
  });
});
