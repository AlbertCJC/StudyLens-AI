import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { BookOpen, Users, Target, TrendingUp, AlertTriangle, ChevronRight, GraduationCap } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, StatCard, SectionHeader, ProgressBar, EmptyState, LoadingView, Badge, Modal } from '../components/ui';
import { fetchTeacherAnalytics, TeacherAnalytics, TeacherSubjectAnalytics } from '../services/api';

export default function TeacherAnalyticsScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const teacherId = currentUser?.id || '';
  const isTeacher = currentUser?.role === 'teacher';

  const [data, setData] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailSubject, setDetailSubject] = useState<TeacherSubjectAnalytics | null>(null);

  useEffect(() => {
    let alive = true;
    if (!teacherId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTeacherAnalytics(teacherId)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [teacherId]);

  if (loading && !data) return <LoadingView label="Loading class insights..." />;

  const totals = data?.totals;
  const subjects = data?.subjects ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Class Insights</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Performance across your subjects and students.
          </Text>
        </View>
        <GraduationCap size={26} color={colors.primary} />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Subjects"
          value={String(totals?.subjectCount ?? 0)}
          icon={<BookOpen size={18} color={colors.primary} />}
        />
        <StatCard
          label="Students"
          value={String(totals?.studentCount ?? 0)}
          icon={<Users size={18} color={colors.primary} />}
        />
        <StatCard
          label="Avg Score"
          value={`${totals?.averageScore ?? 0}%`}
          icon={<TrendingUp size={18} color={colors.success} />}
        />
        <StatCard
          label="Pass Rate"
          value={`${totals?.passRate ?? 0}%`}
          icon={<Target size={18} color={colors.success} />}
        />
      </View>

      {(totals?.atRiskCount ?? 0) > 0 && (
        <View style={[styles.riskBanner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700', flex: 1 }}>
            {totals?.atRiskCount} student{totals?.atRiskCount === 1 ? '' : 's'} averaging below 70% — see subject details.
          </Text>
        </View>
      )}

      <SectionHeader title="By Subject" subtitle={`${subjects.length} subject${subjects.length === 1 ? '' : 's'}`} />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={36} color={colors.mutedForeground} />}
          title="No class data yet"
          subtitle={
            isTeacher
              ? 'Create subjects and quizzes — insights appear as students take assessments.'
              : 'No subjects are assigned to you yet.'
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          {subjects.map((s) => (
            <Card key={s.subjectId} style={{ gap: 10 }} onPress={() => setDetailSubject(s)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge text={s.subjectCode} color={colors.primary} bg={colors.indigoSoft} />
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                  {s.subjectName}
                </Text>
                <ChevronRight size={16} color={colors.mutedForeground} />
              </View>

              <View style={styles.metaRow}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.studentCount} students</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.quizCount} quizzes</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.attempts} attempts</Text>
              </View>

              <View style={{ gap: 6 }}>
                <View style={styles.barRow}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, width: 74 }}>Avg Score</Text>
                  <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
                    <ProgressBar value={s.averageScore} color={colors.primary} height={8} />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '800', width: 38, textAlign: 'right' }}>
                    {s.averageScore}%
                  </Text>
                </View>
                <View style={styles.barRow}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, width: 74 }}>Pass Rate</Text>
                  <View style={[styles.track, { backgroundColor: colors.successSoft }]}>
                    <ProgressBar value={s.passRate} color={colors.success} height={8} />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '800', width: 38, textAlign: 'right' }}>
                    {s.passRate}%
                  </Text>
                </View>
              </View>

              {s.weakTopics.length > 0 && (
                <View style={styles.chipWrap}>
                  {s.weakTopics.map((t) => (
                    <Badge key={t} text={t} color={colors.warning} bg={colors.warningSoft} />
                  ))}
                </View>
              )}

              {s.atRiskStudents.length > 0 && (
                <View style={[styles.riskBox, { backgroundColor: colors.dangerSoft }]}>
                  <View style={styles.riskHeader}>
                    <AlertTriangle size={13} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '800' }}>
                      At Risk ({s.atRiskStudents.length})
                    </Text>
                  </View>
                  {s.atRiskStudents.slice(0, 3).map((stu) => (
                    <View key={stu.id} style={styles.riskRow}>
                      <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {stu.name}
                      </Text>
                      <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '800' }}>{stu.averageScore}%</Text>
                    </View>
                  ))}
                  {s.atRiskStudents.length > 3 && (
                    <TouchableOpacity onPress={() => setDetailSubject(s)}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                        View all {s.atRiskStudents.length} students
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}

      <Modal
        visible={!!detailSubject}
        onClose={() => setDetailSubject(null)}
        title={detailSubject ? `${detailSubject.subjectCode} — ${detailSubject.subjectName}` : ''}
        subtitle={
          detailSubject
            ? `${detailSubject.studentCount} students · ${detailSubject.attempts} attempts · avg ${detailSubject.averageScore}%`
            : ''
        }
      >
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
          {detailSubject && detailSubject.weakTopics.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Weak Topics
              </Text>
              <View style={styles.chipWrap}>
                {detailSubject.weakTopics.map((t) => (
                  <Badge key={t} text={t} color={colors.warning} bg={colors.warningSoft} />
                ))}
              </View>
            </View>
          )}
          {detailSubject &&
            (detailSubject.atRiskStudents.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No students are currently at risk in this subject.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  At-Risk Students ({detailSubject.atRiskStudents.length})
                </Text>
                {detailSubject.atRiskStudents.map((stu) => (
                  <View key={stu.id} style={[styles.detailRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{stu.name}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Average below the 70% passing mark</Text>
                    </View>
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>{stu.averageScore}%</Text>
                  </View>
                ))}
              </View>
            ))}
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 18, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  riskBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  metaRow: { flexDirection: 'row', gap: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, borderRadius: 99, overflow: 'hidden' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  riskBox: { borderRadius: 12, padding: 10, gap: 6 },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
});
