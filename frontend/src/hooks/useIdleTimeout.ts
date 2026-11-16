import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../utils/authFetch";
import { clearWorkspace } from "../utils/aiWorkspaceCache";

export function useIdleTimeout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [timeoutWarn, setTimeoutWarn] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number | null>(null);
  const timeoutMinsRef = useRef(60);
  const idleTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const doForceLogout = useCallback(() => {
    clearWorkspace(currentUser?.id || "");
    logout();
    navigate("/", { replace: true });
  }, [currentUser?.id, logout, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    timeoutMinsRef.current = 60;
    authFetch("/api/system/settings")
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((s: { sessionTimeoutMins?: string | number } | null) => {
        const v = Number(s?.sessionTimeoutMins);
        if (v >= 5 && v <= 1440) timeoutMinsRef.current = v;
      })
      .catch(() => {});
  }, [currentUser]);

  const resetIdle = useCallback(() => {
    if (!currentUser) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    countdownRef.current = null;
    setTimeoutWarn(false);
    setTimeoutSeconds(null);
    const mins = Math.max(5, timeoutMinsRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setTimeoutWarn(true);
      let remaining = 60;
      setTimeoutSeconds(remaining);
      countdownRef.current = window.setInterval(() => {
        remaining -= 1;
        setTimeoutSeconds(Math.max(remaining, 0));
        if (remaining <= 0) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          countdownRef.current = null;
          setTimeoutWarn(false);
          doForceLogout();
        }
      }, 1000);
    }, mins * 60 * 1000);
  }, [currentUser, doForceLogout]);

  useEffect(() => {
    if (!currentUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetIdle();
    const discrete: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];
    const onDiscrete = () => resetIdle();
    let lastMoveReset = 0;
    const onMove = () => {
      const now = Date.now();
      if (now - lastMoveReset > 10000) {
        lastMoveReset = now;
        resetIdle();
      }
    };
    discrete.forEach((e) => window.addEventListener(e, onDiscrete, { passive: true }));
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      discrete.forEach((e) => window.removeEventListener(e, onDiscrete));
      window.removeEventListener("pointermove", onMove);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [currentUser, resetIdle, doForceLogout]);
  return { timeoutWarn, timeoutSeconds, resetIdle, doForceLogout };
}
