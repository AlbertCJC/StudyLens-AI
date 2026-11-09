import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchMaterialFileBase64, type Material } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FilePreviewWebView } from './FilePreviewWebView';

export type ViewableExt = 'pptx' | 'docx';

export function materialViewerExt(material: Material | null | undefined): ViewableExt | null {
  const ext = (material?.fileType || '').toLowerCase().replace(/^\./, '');
  if (ext === 'pptx') return 'pptx';
  if (ext === 'docx') return 'docx';
  return null;
}

interface MaterialFileViewerProps {
  material: Material;
  height?: number;
}

// Renders the actual .pptx/.docx file inside an in-app WebView. Falls back to
// the extracted text when the file can't be loaded or rendered.
export function MaterialFileViewer({ material, height = 340 }: MaterialFileViewerProps) {
  const { colors } = useTheme();
  const ext = materialViewerExt(material);
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!ext);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ext) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setBase64(null);

    fetchMaterialFileBase64(material.id)
      .then((value) => {
        if (!cancelled) setBase64(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [material.id, ext]);

  if (!ext) return null;

  if (loading) {
    return (
      <View style={[styles.loading, { height }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>Loading preview…</Text>
      </View>
    );
  }

  if (failed || !base64) {
    return (
      <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22 }}>
        {material.extractedText || material.description || material.title}
      </Text>
    );
  }

  return <FilePreviewWebView base64={base64} ext={ext} height={height} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  loading: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});
