import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView, TouchableOpacity } from 'react-native';
import { FolderKanban, Layers, ChevronRight, Search } from 'lucide-react-native';
import { fetchSubjects, Subject } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, LoadingView, EmptyState } from '../components/ui';

export default function SubjectsScreen({ onNavigate, onOpenSubject }: { onNavigate: (tab: string) => void; onOpenSubject?: (subject: Subject) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('');

  useEffect(() => {
    fetchSubjects().then((data) => {
      setSubjects(data);
      setLoading(false);
    });
  }, []);

  const isTeacher = currentUser?.role === 'teacher';

  const uniqueSemesters = useMemo(() => {
    const sems = new Set<string>();
    subjects.forEach((s) => { if (s.semester) sems.add(s.semester); });
    return Array.from(sems).sort();
  }, [subjects]);

  const uniqueCourses = useMemo(() => {
    const cs = new Set<string>();
    subjects.forEach((s) => { if (s.course) cs.add(s.course); });
    return Array.from(cs).sort();
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false;
      if (semesterFilter && s.semester !== semesterFilter) return false;
      if (courseFilter && s.course !== courseFilter) return false;
      return true;
    });
  }, [subjects, query, semesterFilter, courseFilter]);

  if (loading) return <LoadingView label="Loading subjects..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Subjects & Course Catalog</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {isTeacher ? 'Course subjects shared with your enrolled students.' : 'Browse active course subjects and their materials.'}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Search size={16} color={colors.mutedForeground} />
        <TextInput
          placeholder="Search subjects..."
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      {/* Semester Filters */}
      {uniqueSemesters.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setSemesterFilter('')}
            style={[styles.filterChip, !semesterFilter && { backgroundColor: colors.primary }, semesterFilter && { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: !semesterFilter ? '#fff' : colors.foreground }}>All Semesters</Text>
          </TouchableOpacity>
          {uniqueSemesters.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSemesterFilter(semesterFilter === s ? '' : s)}
              style={[styles.filterChip, semesterFilter === s && { backgroundColor: colors.primary }, semesterFilter !== s && { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: semesterFilter === s ? '#fff' : colors.foreground }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Course Filters */}
      {uniqueCourses.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setCourseFilter('')}
            style={[styles.filterChip, !courseFilter && { backgroundColor: colors.primary }, courseFilter && { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: !courseFilter ? '#fff' : colors.foreground }}>All Courses</Text>
          </TouchableOpacity>
          {uniqueCourses.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCourseFilter(courseFilter === c ? '' : c)}
              style={[styles.filterChip, courseFilter === c && { backgroundColor: colors.primary }, courseFilter !== c && { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: courseFilter === c ? '#fff' : colors.foreground }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filteredSubjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={36} color={colors.mutedForeground} />}
          title={query || semesterFilter || courseFilter ? 'No subjects match your filters' : (isTeacher || currentUser?.role === 'admin' ? "You haven't created any subjects yet" : 'You are not enrolled in any subjects yet')}
          subtitle={query || semesterFilter || courseFilter ? 'Try adjusting your search or filters.' : (isTeacher || currentUser?.role === 'admin' ? 'Create a subject to start publishing materials, quizzes, and announcements for your students.' : 'Subjects will appear here once your instructor adds you to a class roster.')}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredSubjects.map((s) => (
            <Card key={s.id} style={{ gap: 10 }} onPress={() => onOpenSubject && onOpenSubject(s)}>
              <View style={styles.subjectTop}>
                <Badge text={s.code} mono color={colors.primary} />
                <ChevronRight size={16} color={colors.mutedForeground} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: '800' },
  subjectFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});