import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal as RNModal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fetchSystemSettings } from '../services/api';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MINUTES_BOUNDS = { min: 5, max: 1440 };
const GRACE_SECONDS = 60;

function decodeBase64UrlToJson(input: string): Record<string, unknown> | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    let out = '';
    for (let i = 0; i < padded.length; i += 4) {
      const a = BASE64_CHARS.indexOf(padded[i]);
      const b = BASE64_CHARS.indexOf(padded[i + 1]);
      const c = padded[i + 2] ? BASE64_CHARS.indexOf(padded[i + 2]) : -1;
      const d = padded[i + 3] ? BASE64_CHARS.indexOf(padded[i + 3]) : -1;
      if (a < 0 || b < 0) break;
      out += String.fromCharCode((a << 2) | (b >> 4));
      if (c >= 0) out += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d >= 0) out += String.fromCharCode(((c & 3) << 6) | d);
    }
    return JSON.parse(out) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jwtExpirySeconds(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = decodeBase64UrlToJson(payload);
    const exp = decoded?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export default function SessionWatchdog({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { currentUser, token, logout } = useAuth();
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(GRACE_SECONDS);

  const timeoutMinsRef = useRef(60);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doForceLogout = useCallback(() => {
    logout();
  }, [logout]);

  const resetIdle = useCallback(() => {
    if (!currentUser) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    idleTimerRef.current = null;
    countdownRef.current = null;
    setWarning(false);
    setCountdown(GRACE_SECONDS);
    const mins = Math.max(MINUTES_BOUNDS.min, timeoutMinsRef.current);
    idleTimerRef.current = setTimeout(() => {
      setWarning(true);
      setCountdown(GRACE_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown((s) => {
          const next = s - 1;
          if (next <= 0) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            doForceLogout();
            return 0;
          }
          return next;
        });
      }, 1000);
    }, mins * 60 * 1000);
  }, [currentUser, doForceLogout]);

  useEffect(() => {
    if (!currentUser) return;
    fetchSystemSettings()
      .then((s) => {
        const v = Number((s as { sessionTimeoutMins?: unknown } | null)?.sessionTimeoutMins);
        if (v >= MINUTES_BOUNDS.min && v <= MINUTES_BOUNDS.max) {
          timeoutMinsRef.current = Math.round(v);
        }
      })
      .catch(() => {});
    resetIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      idleTimerRef.current = null;
      countdownRef.current = null;
    };
  }, [currentUser, resetIdle]);

  useEffect(() => {
    if (!currentUser || !token) return;
    const poll = setInterval(() => {
      const exp = jwtExpirySeconds(token);
      if (exp != null && exp * 1000 <= Date.now()) doForceLogout();
    }, 30000);
    return () => clearInterval(poll);
  }, [currentUser, token, doForceLogout]);

  useEffect(() => {
    if (!currentUser || Platform.OS !== 'web') return;
    let lastMoveReset = 0;
    const discrete = () => resetIdle();
    const onMove = () => {
      const now = Date.now();
      if (now - lastMoveReset > 10000) {
        lastMoveReset = now;
        resetIdle();
      }
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, discrete, { passive: true }));
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      events.forEach((e) => window.removeEventListener(e, discrete));
      window.removeEventListener('pointermove', onMove);
    };
  }, [currentUser, resetIdle]);

  return (
    <View style={styles.wrap} onTouchStart={resetIdle} onTouchMove={resetIdle}>
      {children}
      {warning && (
        <RNModal transparent visible animationType="fade" onRequestClose={() => {}}>
          <View style={styles.overlay}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.foreground }]}>Session About to Expire</Text>
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                For your security, you will be signed out in {countdown}s of inactivity. Tap to stay signed in.
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={resetIdle} style={[styles.stayBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stayBtnText}>Stay Signed In</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doForceLogout} style={[styles.signOutBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '800' },
  message: { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stayBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  stayBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  signOutBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
});