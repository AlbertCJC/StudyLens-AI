import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildFilePreviewHtml } from './filePreviewHtml';

interface FilePreviewWebViewProps {
  base64: string;
  ext: string;
  height?: number;
  onError?: () => void;
}

// Expo web build: render the same document inside an iframe instead of a
// native WebView (react-native-webview has no web implementation).
export function FilePreviewWebView({ base64, ext, height = 380, onError }: FilePreviewWebViewProps) {
  const html = useMemo(() => buildFilePreviewHtml(base64, ext), [base64, ext]);

  return (
    <View style={[styles.wrap, { height }]}>
      {React.createElement('iframe', {
        srcDoc: html,
        title: 'Material preview',
        sandbox: 'allow-scripts allow-same-origin',
        style: { width: '100%', height: '100%', border: '0' },
        onError,
      } as Record<string, unknown>)}
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
});
