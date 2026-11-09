import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildFilePreviewHtml } from './filePreviewHtml';

interface FilePreviewWebViewProps {
  base64: string;
  ext: string;
  height?: number;
  onError?: () => void;
}

export function FilePreviewWebView({ base64, ext, height = 380, onError }: FilePreviewWebViewProps) {
  const html = useMemo(() => buildFilePreviewHtml(base64, ext), [base64, ext]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (data.type === 'error') onError?.();
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#2563eb" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  web: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
