import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { AnnouncementsProvider } from './src/context/AnnouncementsContext';
import { ToastProvider } from './src/context/ToastContext';
import AppNavigator from './src/navigation/AppNavigator';
import SessionWatchdog from './src/components/SessionWatchdog';
import { initApiBaseUrl } from './src/services/api';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function CrashFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.crashWrap, { backgroundColor: colors.background }]}>
      <Text style={[styles.crashEmoji, { color: colors.foreground }]}>⚠️</Text>
      <Text style={[styles.crashTitle, { color: colors.foreground }]}>Something went wrong</Text>
      <Text style={[styles.crashMessage, { color: colors.mutedForeground }]}>{error.message || 'An unexpected error occurred.'}</Text>
      <TouchableOpacity
        onPress={onRetry}
        style={[styles.crashButton, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.crashButtonText}>Try again</Text>
      </TouchableOpacity>
      <Text style={[styles.crashHint, { color: colors.mutedForeground }]}>
        Theme: {isDark ? 'dark' : 'light'}
      </Text>
    </View>
  );
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[CrashBoundary]', error);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <CrashFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default function App() {
  const [apiReady, setApiReady] = React.useState(false);

  React.useEffect(() => {
    initApiBaseUrl().then(() => setApiReady(true));
  }, []);

  if (!apiReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <SessionWatchdog>
              <AnnouncementsProvider>
                <ToastProvider>
                  <AppNavigator />
                </ToastProvider>
              </AnnouncementsProvider>
            </SessionWatchdog>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  crashWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  crashEmoji: { fontSize: 44, marginBottom: 12 },
  crashTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  crashMessage: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  crashButton: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  crashButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  crashHint: { fontSize: 11, marginTop: 18 },
});