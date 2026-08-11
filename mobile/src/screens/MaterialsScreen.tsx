import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BookOpen, FileText, Download, Eye, Sparkles, UploadCloud, CheckCircle2, X } from 'lucide-react-native';
import { fetchMaterials, fetchSubjects, uploadMaterial, Material, Subject } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Badge,
  LoadingView,
  EmptyState,
  Modal,
  Field,
  PrimaryButton,
  OutlineButton,
  SectionHeader,
} from '../components/ui';
import { STORAGE_KEYS, getStringSet, addToStringSet } from '../utils/storage';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

export default function MaterialsScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const isTeacher = currentUser?.role === 'teacher';

  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'course' | 'personal'>('all');
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMaterials(), fetchSubjects()]).then(([mats, subs]) => {
      setMaterials(mats);
      setSubjects(subs);
      if (subs.length > 0 && !subjectId) setSubjectId(subs[0].id);
      setLoading(false);
    });
    if (currentUser?.id) {
      getStringSet(STORAGE_KEYS.downloadedMaterials).then(setDownloadedIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setPickedFile({ uri: asset.uri, name: asset.name || 'lecture.pdf', type: asset.mimeType || 'application/octet-stream' });
      }
    } catch {
      setPickedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!pickedFile || !currentUser) return;
    setIsUploading(true);
    setUploadMessage(null);
    try {
      if (Platform.OS === 'web') {
        throw new Error('File upload is not supported on web in this build.');
      }
      const mat = await uploadMaterial({
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.type,
        title: title || undefined,
        description: description || undefined,
        subjectId,
        uploadedBy: currentUser.name,
        uploaderRole: currentUser.role,
        uploaderId: currentUser.id,
      });
      setMaterials((prev) => [mat, ...prev]);
      setUploadMessage('Material uploaded successfully and indexed for students!');
      setTitle('');
      setDescription('');
      setPickedFile(null);
    } catch (err) {
      setUploadMessage((err as Error).message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTxt = async (m: Material) => {
    const text = m.extractedText || m.title;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Download', `${m.title}.txt`);
      } else {
        const path = `${FileSystem.cacheDirectory}${m.title.replace(/[^\w\s]/g, '').slice(0, 40)}.txt`;
        await FileSystem.writeAsStringAsync(path, text);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'text/plain' });
        }
      }
      await addToStringSet(STORAGE_KEYS.downloadedMaterials, m.id);
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
    } catch {
      Alert.alert('Error', 'Could not export the file.');
    }
  };

  const filtered = materials.filter((m) => {
    if (sourceFilter === 'course') return m.materialType !== 'personal' && m.uploaderRole !== 'student';
    if (sourceFilter === 'personal') return m.materialType === 'personal' || m.uploaderRole === 'student';
    return true;
  });

  if (loading) return <LoadingView label="Loading materials..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Role header */}
      {isTeacher ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
            <UploadCloud size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Upload Course Lecture Material</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Publish lecture files to your enrolled students.</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
            <BookOpen size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Learning & Lecture Materials</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Course notes, reviewers, and self-study documents.</Text>
          </View>
        </View>
      )}

      {/* Teacher upload form */}
      {isTeacher && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <SectionHeader title="Upload New Material" subtitle="PDF, DOCX, PPTX, TXT supported" />
          <Field label="Document Title" value={title} onChangeText={setTitle} placeholder="e.g. Module 4: Relational Algebra & Normalization" />
          <View>
            <Text style={styles.fieldLabel}>Course Subject</Text>
            <View style={styles.chipWrap}>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSubjectId(s.id)}
                  style={[styles.chip, subjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: subjectId === s.id ? '#fff' : colors.foreground }}>
                    {s.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field label="Description / Topic Notes" value={description} onChangeText={setDescription} placeholder="Brief notes for students" multiline />
          {pickedFile ? (
            <View style={[styles.fileChip, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <FileText size={16} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {pickedFile.name}
              </Text>
              <TouchableOpacity onPress={() => setPickedFile(null)}>
                <X size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickFile} style={[styles.dropzone, { borderColor: colors.border }]} disabled={Platform.OS === 'web'}>
              <UploadCloud size={22} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Tap to select a lecture file</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{Platform.OS === 'web' ? 'File upload is available in the native app.' : 'PDF, DOCX, PPTX, TXT format supported'}</Text>
            </TouchableOpacity>
          )}
          {uploadMessage && (
            <View style={[styles.uploadMsg, { backgroundColor: uploadMessage.includes('successfully') ? colors.successSoft : colors.dangerSoft }]}>
              {uploadMessage.includes('successfully') ? <CheckCircle2 size={16} color={colors.success} /> : <X size={16} color={colors.danger} />}
              <Text style={{ fontSize: 12, fontWeight: '600', color: uploadMessage.includes('successfully') ? colors.success : colors.danger, flex: 1 }}>
                {uploadMessage}
              </Text>
            </View>
          )}
          <PrimaryButton
            label={isUploading ? 'Uploading...' : 'Publish Course Material to Students'}
            onPress={handleUpload}
            loading={isUploading}
            disabled={!pickedFile || Platform.OS === 'web'}
          />
        </View>
      )}

      {/* Catalog */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
        <SectionHeader title="Materials Catalog" subtitle={`${filtered.length} document(s)`} />
        <View style={styles.filterRow}>
          {([
            { key: 'all', label: `All (${materials.length})` },
            { key: 'course', label: 'Course Materials' },
            { key: 'personal', label: 'Personal Notes' },
          ] as const).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, sourceFilter === f.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt }]}
              onPress={() => setSourceFilter(f.key)}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: sourceFilter === f.key ? '#fff' : colors.foreground }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText size={36} color={colors.mutedForeground} />} title="No materials found" subtitle="Try a different filter, or ask your teacher to publish notes." />
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((m) => (
              <View key={m.id} style={[styles.matCard, { borderColor: colors.border }]}>
                <View style={styles.matBadges}>
                  <Badge text={m.materialType === 'personal' ? 'Personal Study Note' : 'Course Material'} color={m.materialType === 'personal' ? '#a855f7' : '#2563eb'} bg={m.materialType === 'personal' ? 'rgba(168,85,247,0.12)' : 'rgba(37,99,235,0.12)'} />
                  {downloadedIds.has(m.id) && (
                    <Badge text="Downloaded" color={colors.success} bg={colors.successSoft}>
                      <CheckCircle2 size={11} color={colors.success} />
                    </Badge>
                  )}
                  {m.fileSize && <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'monospace' }}>{m.fileSize}</Text>}
                </View>
                <Text style={[styles.matTitle, { color: colors.foreground }]} numberOfLines={1}>{m.title}</Text>
                {m.description && <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{m.description}</Text>}
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{m.subjectName}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                  Uploaded by {m.uploadedBy} - {new Date(m.createdAt).toLocaleDateString()}
                </Text>
                <View style={styles.matActions}>
                  <TouchableOpacity onPress={() => setPreviewMaterial(m)} style={[styles.actionBtn, { backgroundColor: colors.indigoSoft }]}>
                    <Eye size={15} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDownloadTxt(m)} style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt }]}>
                    <Download size={15} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '700' }}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.actionBtn, { backgroundColor: colors.successSoft }]}>
                    <Sparkles size={15} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>AI Tools</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Preview modal */}
      <Modal visible={!!previewMaterial} onClose={() => setPreviewMaterial(null)} title={previewMaterial?.title} subtitle={`${previewMaterial?.fileType?.toUpperCase() || 'DOC'} Document - ${previewMaterial?.subjectName || ''}`}>
        <ScrollView style={{ maxHeight: 400 }}>
          <View style={[styles.previewPaper, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.previewHeader, { color: colors.foreground }]}>StudyLens Course Material Document</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginVertical: 6 }}>
              Uploaded: {previewMaterial ? new Date(previewMaterial.createdAt).toLocaleString() : ''} by {previewMaterial?.uploadedBy}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 21 }}>{previewMaterial?.extractedText || previewMaterial?.title}</Text>
          </View>
        </ScrollView>
        <View style={styles.modalActions}>
          <OutlineButton label="Download TXT" onPress={() => previewMaterial && handleDownloadTxt(previewMaterial)} />
          <PrimaryButton label="Generate AI Study Tools" onPress={() => { setPreviewMaterial(null); onNavigate('ai-assistant'); }} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  dropzone: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', padding: 20, alignItems: 'center', gap: 6 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  uploadMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  matCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 },
  matBadges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  matTitle: { fontSize: 14, fontWeight: '800' },
  matActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  previewPaper: { borderRadius: 12, padding: 14 },
  previewHeader: { fontSize: 14, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});