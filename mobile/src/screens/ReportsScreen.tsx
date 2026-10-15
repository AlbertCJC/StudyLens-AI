import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { FileText, BarChart2, Plus, Trash2, Users, GraduationCap, Sparkles, X, Check, Download } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  GeneratedReport,
  ReportType,
  fetchReports,
  generateReport,
  deleteReport,
  fetchAdminUsers,
  fetchQuizzes,
  fetchSubjects,
  convertToPdf,
  Quiz,
  Subject,
} from '../services/api';
import { Card, Badge, Modal, LoadingView, EmptyState, SectionHeader, PrimaryButton, OutlineButton, Field } from '../components/ui';
import { saveTextFile, saveBytesFile } from '../utils/fileExport';

const REPORT_TYPES: { key: ReportType; icon: React.ReactNode }[] = [
  { key: 'Student Performance', icon: <Users size={18} color="#fff" /> },
  { key: 'Quiz Analytics', icon: <BarChart2 size={18} color="#fff" /> },
  { key: 'Subject Summary', icon: <GraduationCap size={18} color="#fff" /> },
  { key: 'AI Usage', icon: <Sparkles size={18} color="#fff" /> },
];

export default function ReportsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('Student Performance');
  const [title, setTitle] = useState('Student Performance Report');
  const [targetId, setTargetId] = useState('');
  const [generating, setGenerating] = useState(false);

  const [viewing, setViewing] = useState<GeneratedReport | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await fetchReports();
      setReports(data);
    } catch {
      // offline fallback handled by api layer
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
    fetchAdminUsers().then((data) => setStudents(data.filter((u) => u.role === 'student').map((u) => ({ id: u.id, name: u.name })))).catch(() => {});
    fetchQuizzes(currentUser?.role, currentUser?.id).then(setQuizzes).catch(() => {});
    fetchSubjects().then(setSubjects).catch(() => {});
  }, [loadReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }, [loadReports]);

  const openGenerate = (type: ReportType) => {
    setReportType(type);
    setTitle(`${type} Report`);
    setTargetId('');
    setGenerateOpen(true);
  };

  const submitGenerate = async () => {
    setGenerating(true);
    try {
      const created = await generateReport({
        reportType,
        title: title.trim() || `${reportType} Report`,
        targetId: targetId || undefined,
        generatedBy: currentUser?.id || 'usr-admin-1',
      });
      if (created && created.id) {
        setReports((prev) => [created, ...prev]);
        setGenerateOpen(false);
      }
    } catch {
      // offline: report not persisted
    } finally {
      setGenerating(false);
    }
  };

const removeReport = async (id: string) => {
    await deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const exportReportCSV = async (report: GeneratedReport) => {
    setExportingId(report.id);
    try {
      const rows = summaryRows(report);
      const content =
        `Report,${report.reportType}\nTitle,${report.title}\nGenerated,${report.generatedAt}\n\n` +
        rows.map((r) => `"${r.label.replace(/"/g, '""')}","${r.value.replace(/"/g, '""')}"`).join('\n');
      await saveTextFile(`${report.title.replace(/[^a-z0-9]+/gi, '_') || 'report'}.csv`, content, 'text/csv', report.title);
      showToast('Report exported as CSV.');
    } catch (err) {
      showToast((err as Error).message || 'Could not export the report.', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const exportReportPDF = async (report: GeneratedReport) => {
    setExportingId(report.id);
    try {
      const rows = summaryRows(report);
      const items = rows.map((r) => ({ question: r.label, answer: r.value }));
      const bytes = await convertToPdf({
        title: report.title,
        metaLine: `${report.reportType} · Generated ${report.generatedAt}`,
        items,
      });
      await saveBytesFile(`${report.title.replace(/[^a-z0-9]+/gi, '_') || 'report'}.pdf`, bytes, 'application/pdf', report.title);
      showToast('Report exported as PDF.');
    } catch (err) {
      showToast((err as Error).message || 'Could not export the report.', 'error');
    } finally {
      setExportingId(null);
    }
  };

  const summaryRows = (report: GeneratedReport): { label: string; value: string }[] => {
    const s = (report.summary || {}) as Record<string, unknown>;
    const rows: { label: string; value: string }[] = [];
    if (s.studentName) rows.push({ label: 'Student', value: String(s.studentName) });
    if (typeof s.quizzesTaken === 'number') rows.push({ label: 'Quizzes Taken', value: String(s.quizzesTaken) });
    if (typeof s.averageScore === 'number') rows.push({ label: 'Average Score', value: `${s.averageScore}%` });
    if (typeof s.passRate === 'number') rows.push({ label: 'Pass Rate', value: `${s.passRate}%` });
    if (Array.isArray(s.weakTopics)) rows.push({ label: 'Weak Topics', value: (s.weakTopics as string[]).join(', ') || 'None' });
    if (Array.isArray(s.strongTopics)) rows.push({ label: 'Strong Topics', value: (s.strongTopics as string[]).join(', ') || 'None' });
    if (typeof s.totalAttempts === 'number') rows.push({ label: 'Total Attempts', value: String(s.totalAttempts) });
    if (Array.isArray(s.quizzes)) rows.push({ label: 'Quizzes Analyzed', value: String((s.quizzes as unknown[]).length) });
    if (typeof s.overallAverage === 'number') rows.push({ label: 'Overall Average', value: `${s.overallAverage}%` });
    if (Array.isArray(s.subjects)) rows.push({ label: 'Subjects Covered', value: String((s.subjects as unknown[]).length) });
    if (typeof s.totalGenerated === 'number') rows.push({ label: 'Total AI Generated', value: String(s.totalGenerated) });
    if (typeof s.quizCount === 'number') rows.push({ label: 'Quizzes (Total)', value: String(s.quizCount) });
    if (typeof s.generationEvents === 'number') rows.push({ label: 'AI Generation Events', value: String(s.generationEvents) });
    if (s.breakdown && typeof s.breakdown === 'object') {
      const b = s.breakdown as Record<string, unknown>;
      rows.push({ label: 'By Type', value: Object.entries(b).map(([k, v]) => `${k}: ${v}`).join(' | ') });
    }
    return rows;
  };

  if (loading) return <LoadingView label="Loading reports..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary }]}>
          <FileText size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reports & Analytics</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Generate and review academic reports</Text>
        </View>
      </View>

      <SectionHeader title="Generate a Report" subtitle="Choose a report type to compile" />
      <View style={styles.grid}>
        {REPORT_TYPES.map((rt) => (
          <TouchableOpacity
            key={rt.key}
            onPress={() => openGenerate(rt.key)}
            style={[styles.typeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.typeIcon, { backgroundColor: colors.primary }]}>{rt.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{rt.key}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                {rt.key === 'Student Performance' ? 'Per-student progress summary' : rt.key === 'Quiz Analytics' ? 'Attempt & pass-rate stats' : rt.key === 'Subject Summary' ? 'Materials, quizzes & scores' : 'AI generation volume'}
              </Text>
            </View>
            <Plus size={16} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title="Generated Reports" subtitle={`${reports.length} report(s)`} actionLabel="Refresh" onAction={onRefresh} />
      {reports.length === 0 ? (
        <EmptyState icon={<FileText size={34} color={colors.mutedForeground} />} title="No reports yet" subtitle="Generate one using the cards above." />
      ) : (
        <View style={{ gap: 10 }}>
          {reports.map((r) => (
            <Card key={r.id} style={{ gap: 8 }}>
              <View style={styles.reportRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.reportTags}>
                    <Badge text={r.reportType} color={colors.primary} bg={colors.indigoSoft} />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800' }}>{r.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace' }}>{r.generatedAt}</Text>
                </View>
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => setViewing(r)} style={[styles.iconBtn, { backgroundColor: colors.indigoSoft }]}>
                    <BarChart2 size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => exportReportCSV(r)} disabled={exportingId === r.id} style={[styles.iconBtn, { backgroundColor: colors.successSoft, opacity: exportingId === r.id ? 0.5 : 1 }]}>
                    <Download size={16} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => exportReportPDF(r)} disabled={exportingId === r.id} style={[styles.iconBtn, { backgroundColor: colors.warningSoft, opacity: exportingId === r.id ? 0.5 : 1 }]}>
                    <FileText size={16} color={colors.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeReport(r.id)} style={[styles.iconBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={generateOpen} onClose={() => setGenerateOpen(false)} title={`Generate ${reportType}`} subtitle="Compile academic data into a report">
        <View style={{ gap: 12 }}>
          <View style={[styles.typeOption, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, alignSelf: 'flex-start' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mutedForeground }} numberOfLines={1}>
              {reportType} — locked to the report card you selected
            </Text>
          </View>

          <Field label="Report Title" value={title} onChangeText={setTitle} placeholder="Report title" />

          {reportType === 'Student Performance' && (
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>Target Student</Text>
              {students.length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No students enrolled in your subjects yet.</Text>
              )}
              <View style={styles.pickerWrap}>
                {students.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setTargetId(s.id)}
                    style={[styles.optionRow, targetId === s.id ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  >
                    <Check size={14} color={targetId === s.id ? '#fff' : 'transparent'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: targetId === s.id ? '#fff' : colors.foreground, flex: 1 }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {reportType === 'Quiz Analytics' && (
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>Target Quiz (optional)</Text>
              <View style={styles.pickerWrap}>
                {quizzes.map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    onPress={() => setTargetId(targetId === q.id ? '' : q.id)}
                    style={[styles.optionRow, targetId === q.id ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  >
                    <Check size={14} color={targetId === q.id ? '#fff' : 'transparent'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: targetId === q.id ? '#fff' : colors.foreground, flex: 1 }} numberOfLines={1}>
                      {q.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {reportType === 'Subject Summary' && (
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>Target Subject (optional)</Text>
              <View style={styles.pickerWrap}>
                {subjects.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setTargetId(targetId === s.id ? '' : s.id)}
                    style={[styles.optionRow, targetId === s.id ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  >
                    <Check size={14} color={targetId === s.id ? '#fff' : 'transparent'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: targetId === s.id ? '#fff' : colors.foreground, flex: 1 }} numberOfLines={1}>
                      {s.code} - {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {reportType === 'AI Usage' && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>
              Generates an AI Usage report summarizing all AI-generated content across the platform.
            </Text>
          )}

          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setGenerateOpen(false)} style={{ flex: 1 }} />
            <PrimaryButton label="Generate Report" onPress={submitGenerate} loading={generating} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} subtitle={viewing ? `${viewing.reportType} - ${viewing.generatedAt}` : ''}>
        <View style={{ gap: 10 }}>
          {viewing && summaryRows(viewing).length === 0 ? (
            <EmptyState icon={<FileText size={30} color={colors.mutedForeground} />} title="No summary data" />
          ) : (
            viewing && summaryRows(viewing).map((row, i) => (
              <View key={i} style={[styles.summaryRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700', flex: 1 }}>{row.label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1.5, textAlign: 'right' }}>{row.value}</Text>
              </View>
            ))
)}
          <View style={styles.modalActions}>
            {viewing && (
              <>
                <OutlineButton label="CSV" onPress={() => exportReportCSV(viewing)} disabled={exportingId === viewing.id} style={{ flex: 1 }} />
                <OutlineButton label="PDF" color={colors.primary} onPress={() => exportReportPDF(viewing)} disabled={exportingId === viewing.id} style={{ flex: 1 }} />
              </>
            )}
            <PrimaryButton label="Close" onPress={() => setViewing(null)} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, width: '48%', flexGrow: 1 },
  typeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  reportRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  reportTags: { flexDirection: 'row' },
  iconBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  pickerWrap: { gap: 8, maxHeight: 220 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
});
