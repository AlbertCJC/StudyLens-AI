import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FileText, BookOpen, Download, ChevronLeft, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { fetchSummaries, fetchReviewers, StudySummary, Reviewer } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { Card, Badge, LoadingView, EmptyState, SectionHeader } from '../components/ui';

export default function SummariesScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const [summaries, setSummaries] = useState<StudySummary[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState<StudySummary | null>(null);
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null);

  useEffect(() => {
    Promise.all([fetchSummaries(), fetchReviewers()]).then(([s, r]) => {
      setSummaries(s);
      setReviewers(r);
      setLoading(false);
    });
  }, []);

  const downloadTxt = async (title: string, body: string) => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Download', `${title}.txt`);
        return;
      }
      const path = `${FileSystem.cacheDirectory}${(title || 'summary').replace(/[^\w\s-]/g, '').slice(0, 40)}.txt`;
      await FileSystem.writeAsStringAsync(path, body);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/plain' });
    } catch {
      Alert.alert('Error', 'Could not export the summary.');
    }
  };

  if (loading) return <LoadingView label="Loading summaries..." />;

  // ---------------- READER: SUMMARY ----------------
  if (selectedSummary) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.readerWrap}>
        <TouchableOpacity onPress={() => setSelectedSummary(null)} style={[styles.backChip, { borderColor: colors.border }]}>
          <ChevronLeft size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Back to Summaries</Text>
        </TouchableOpacity>

        <View style={[styles.readerTitleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.readerIcon, { backgroundColor: colors.indigoSoft }]}>
            <FileText size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.readerTitle, { color: colors.foreground }]}>{selectedSummary.title}</Text>
            <Text style={{ color: colors.primary, fontSize: 12 }}>{selectedSummary.subjectName}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              downloadTxt(
                selectedSummary.title,
                `${selectedSummary.title}\n\n${selectedSummary.executiveSummary}\n\nKey Takeaways\n${selectedSummary.keyTakeaways.join('\n')}\n\nBullet Points\n${selectedSummary.bulletPoints.join('\n')}`
              )
            }
            style={[styles.downloadBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Download size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
          <Text style={[styles.panelHeader, { color: colors.foreground }]}>Executive Summary</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 21 }}>{selectedSummary.executiveSummary}</Text>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
          <Text style={[styles.panelHeader, { color: colors.foreground }]}>Key Takeaways</Text>
          {selectedSummary.keyTakeaways.map((item, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
          <Text style={[styles.panelHeader, { color: colors.foreground }]}>Study Bullet Points</Text>
          {selectedSummary.bulletPoints.map((item, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
              <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ---------------- READER: REVIEWER ----------------
  if (selectedReviewer) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.readerWrap}>
        <TouchableOpacity onPress={() => setSelectedReviewer(null)} style={[styles.backChip, { borderColor: colors.border }]}>
          <ChevronLeft size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Back to Reviewers</Text>
        </TouchableOpacity>

        <View style={[styles.readerTitleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.readerIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
            <BookOpen size={20} color="#a855f7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.readerTitle, { color: colors.foreground }]}>{selectedReviewer.title}</Text>
            <Text style={{ color: '#a855f7', fontSize: 12 }}>{selectedReviewer.subjectName}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              downloadTxt(
                selectedReviewer.title,
                `${selectedReviewer.title}\n\n${selectedReviewer.overview}\n\nTopics\n${selectedReviewer.topics
                  .map((t) => `${t.topic}: ${t.overview}\n  - ${t.keyConcepts.join('\n  - ')}`)
                  .join('\n')}`
              )
            }
            style={[styles.downloadBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Download size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 21 }}>{selectedReviewer.overview}</Text>
        {selectedReviewer.topics.map((t, idx) => (
          <View key={idx} style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
            <View style={styles.reviewerTopicHead}>
              <Badge text={`Topic ${idx + 1}`} color="#a855f7" bg="rgba(168,85,247,0.12)" />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800', flex: 1 }}>{t.topic}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{t.overview}</Text>
            {t.keyConcepts.map((c, ci) => (
              <View key={ci} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: '#a855f7' }]} />
                <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{c}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  // ---------------- LIBRARY ----------------
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <FileText size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Summaries & Reviewers</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            AI-generated executive summaries, key takeaways, and topic reviewers.
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={`Executive Summaries (${summaries.length})`} actionLabel="Generate New" onAction={() => onNavigate('ai-assistant')} />
        {summaries.length === 0 ? (
          <EmptyState icon={<FileText size={36} color={colors.mutedForeground} />} title="No summaries yet" subtitle="Generate an AI summary from your materials." />
        ) : (
          summaries.map((s) => (
            <Card key={s.id} onPress={() => setSelectedSummary(s)} style={{ gap: 8 }}>
              <View style={styles.itemTop}>
                <View style={[styles.itemIcon, { backgroundColor: colors.indigoSoft }]}>
                  <FileText size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 11 }}>{s.subjectName}</Text>
                </View>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                {s.executiveSummary}
              </Text>
              <Badge text={`${s.keyTakeaways.length} Takeaways`} color={colors.success} bg={colors.successSoft} />
            </Card>
          ))
        )}
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={`Study Reviewers (${reviewers.length})`} subtitle="Topic-focused review guides" />
        {reviewers.length === 0 ? (
          <EmptyState icon={<BookOpen size={36} color={colors.mutedForeground} />} title="No reviewers yet" subtitle="Reviewers appear here after generation." />
        ) : (
          reviewers.map((r) => (
            <Card key={r.id} onPress={() => setSelectedReviewer(r)} style={{ gap: 8 }}>
              <View style={styles.itemTop}>
                <View style={[styles.itemIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <BookOpen size={16} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={{ color: '#a855f7', fontSize: 11 }}>{r.subjectName}</Text>
                </View>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                {r.overview}
              </Text>
              <Badge text={`${r.topics.length} Topics`} color="#a855f7" bg="rgba(168,85,247,0.12)" />
            </Card>
          ))
        )}
      </View>

      <Card style={[styles.aiCta, { backgroundColor: colors.card }]} onPress={() => onNavigate('ai-assistant')}>
        <Sparkles size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Generate AI Summary or Reviewer</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Turn any material into concise study notes.</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiCta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readerWrap: { padding: 16, paddingBottom: 40, gap: 14 },
  backChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  readerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  readerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  readerTitle: { fontSize: 16, fontWeight: '800' },
  downloadBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  panelHeader: { fontSize: 15, fontWeight: '800' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  reviewerTopicHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});