import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} color="#10b981" />,
  error: <XCircle size={18} color="#ef4444" />,
  info: <Info size={18} color="#6366f1" />,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) {
        Animated.parallel([
          Animated.timing(target.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(target.translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
        ]).start(() => {
          setToasts((cur) => cur.filter((t) => t.id !== id));
        });
      }
      return prev;
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', durationMs = 3200) => {
      const id = ++idRef.current;
      const opacity = new Animated.Value(0);
      const translateY = new Animated.Value(16);
      setToasts((prev) => [...prev.slice(-2), { id, type, message, opacity, translateY }]);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 260 }),
      ]).start();
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            style={[
              styles.toast,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: t.opacity, transform: [{ translateY: t.translateY }] },
            ]}
          >
            {TOAST_ICONS[t.type]}
            <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={3}>
              {t.message}
            </Text>
            <TouchableOpacity onPress={() => dismiss(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    gap: 8,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '94%',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.18)',
    elevation: 6,
  },
  message: { flex: 1, fontSize: 12.5, fontWeight: '600' },
});
