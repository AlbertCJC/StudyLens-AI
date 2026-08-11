import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { FolderKanban, Users, Layers, BookOpen } from 'lucide-react-native';
import { fetchSubjects, Subject } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, LoadingView, EmptyState } from '../components/ui';

export default function SubjectsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects().then((data) => {
      setSubjects(data);
      setLoading(false);
    });
  }, []);

  const isTeacher = currentUser?.role === 'teacher';

  if (loading) return <LoadingView label="Loading subjects..." />;

  const totalStudents = subjects.reduce((sum, s) => sum + (s.studentCount || 0), 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <FolderKanban size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Subjects & Course Catalog</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {isTeacher ? 'Course subjects shared with your enrolled students.' : 'Browse active course subjects and their materials.'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statChip}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Subjects</Text>
          <Text style={[styles.statNum, { color: colors.foreground }]}>{subjects.length}</Text>
        </Card>
        <Card style={styles.statChip}>
          <Users size={16} color={colors.primary} />
          <Text style={[styles.statNum, { color: colors.foreground }]}>{totalStudents}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Students</Text>
        </Card>
      </View>

      {subjects.length === 0 ? (
        <EmptyState icon={<FolderKanban size={36} color={colors.mutedForeground} />} title="No subjects found" subtitle="Subjects will appear here once published." />
      ) : (
        <View style={{ gap: 12 }}>
          {subjects.map((s) => (
            <Card key={s.id} style={{ gap: 10 }}>
              <View style={styles.subjectTop}>
                <Badge text={s.code} mono color={colors.primary} />
                <Badge text={`${s.studentCount} Students`} color={colors.success} bg={colors.successSoft}>
                  <Users size={12} color={colors.success} />
                </Badge>
              </View>
              <Text style={[styles.subjectName, { color: colors.foreground }]}>{s.name}</Text>
              {s.description && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }} numberOfLines={3}>
                  {s.description}
                </Text>
              )}
              <View style={[styles.subjectFooter, { borderTopColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                  Faculty: {s.teacherName || 'Faculty'}
                </Text>
                <View style={styles.footerRight}>
                  <Layers size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.materialCount} Materials</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Card style={[styles.aiNote, { backgroundColor: colors.card }]} onPress={() => onNavigate('ai-assistant')}>
        <View style={[styles.aiIcon, { backgroundColor: colors.indigoSoft }]}>
          <BookOpen size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Generate AI Study Resources</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Create quizzes, flashcards & summaries for any subject.</Text>
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
  statsRow: { flexDirection: 'row', gap: 12 },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  statNum: { fontSize: 20, fontWeight: '900' },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '800' },
  subjectFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiNote: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  aiIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});