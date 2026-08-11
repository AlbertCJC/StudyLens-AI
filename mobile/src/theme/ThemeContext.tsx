import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS, getItem, setItem } from '../utils/storage';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  card: string;
  surface: string;
  surfaceAlt: string;
  inputBg: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  indigoSoft: string;
  navBg: string;
  navActiveBg: string;
  navActiveText: string;
  navText: string;
  topbarBg: string;
  flame: string;
  loginBg: string;
  loginCard: string;
}

const lightColors: ThemeColors = {
  isDark: false,
  background: '#f8fafc',
  card: '#ffffff',
  surface: '#f1f5f9',
  surfaceAlt: '#e0e3f8',
  inputBg: '#ffffff',
  border: '#e2e8f0',
  foreground: '#0f172a',
  mutedForeground: '#64748b',
  primary: '#5b51d8',
  primaryForeground: '#ffffff',
  primarySoft: 'rgba(91, 81, 216, 0.10)',
  accent: '#10b981',
  accentSoft: 'rgba(16, 185, 129, 0.12)',
  success: '#16a34a',
  successSoft: 'rgba(34, 197, 94, 0.15)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  warning: '#d97706',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  indigoSoft: 'rgba(91, 81, 216, 0.10)',
  navBg: '#ffffff',
  navActiveBg: '#5b51d8',
  navActiveText: '#ffffff',
  navText: '#475569',
  topbarBg: 'rgba(255, 255, 255, 0.92)',
  flame: '#f97316',
  loginBg: '#f5f6fc',
  loginCard: '#ffffff',
};

const darkColors: ThemeColors = {
  isDark: true,
  background: '#0f172a',
  card: '#1e293b',
  surface: '#334155',
  surfaceAlt: '#131b30',
  inputBg: '#182238',
  border: '#334155',
  foreground: '#f8fafc',
  mutedForeground: '#94a3b8',
  primary: '#6366f1',
  primaryForeground: '#ffffff',
  primarySoft: 'rgba(99, 102, 241, 0.18)',
  accent: '#10b981',
  accentSoft: 'rgba(16, 185, 129, 0.15)',
  success: '#4ade80',
  successSoft: 'rgba(34, 197, 94, 0.15)',
  danger: '#f87171',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  warning: '#fbbf24',
  warningSoft: 'rgba(245, 158, 11, 0.18)',
  indigoSoft: 'rgba(129, 140, 248, 0.15)',
  navBg: '#0f172a',
  navActiveBg: '#5b51d8',
  navActiveText: '#ffffff',
  navText: '#cbd5e1',
  topbarBg: 'rgba(15, 23, 42, 0.92)',
  flame: '#f97316',
  loginBg: '#0b132b',
  loginCard: '#131b30',
};

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getItem(STORAGE_KEYS.theme).then((stored) => {
      if (stored !== null) {
        setIsDark(stored === 'dark');
      }
      setLoaded(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      setItem(STORAGE_KEYS.theme, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};