import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Building2, Calendar, CheckCircle2, Edit3, Save, Camera, FileBadge, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { uploadAvatar, resolveMaterialFileUrl } from '../services/api';
import { Card, Badge, Field, PrimaryButton, OutlineButton, SectionHeader } from '../components/ui';

export default function ProfileScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  if (!currentUser) return null;

  const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const pickAvatar = async () => {
    if (!currentUser || uploadingAvatar || !isEditing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Allow photo library access to choose a profile photo.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const ext = (asset.mimeType?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const updated = await uploadAvatar(
        currentUser.id,
        asset.uri,
        `avatar_${Date.now()}.${ext}`,
        asset.mimeType || 'image/jpeg'
      );
      await updateProfile({ avatar: updated.avatar });
      showToast('Profile photo updated.');
    } catch (err) {
      showToast((err as Error).message || 'Could not upload the profile photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removePhoto = async () => {
    if (!currentUser?.avatar || removingAvatar) return;
    setRemovingAvatar(true);
    try {
      await updateProfile({ avatar: null });
      showToast('Profile photo removed.');
    } catch (err) {
      showToast((err as Error).message || 'Could not remove the profile photo.', 'error');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Full name is required.', 'error');
      return;
    }
    setIsEditing(false);
    updateProfile({ name: name.trim() }).catch(() => showToast('Could not save profile changes.', 'error'));
    showToast('Profile updated successfully!');
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (err) {
      showToast((err as Error).message || 'Could not update the password. Check your current password and try again.', 'error');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const roleBadge = (() => {
    switch (currentUser.role) {
      case 'admin':
        return { label: 'System Administrator', color: '#e11d48' };
      case 'teacher':
        return { label: 'Faculty Instructor', color: '#9333ea' };
      default:
        return { label: 'Enrolled Student', color: colors.primary };
    }
  })();

  const roleInfo = (() => {
    switch (currentUser.role) {
      case 'student':
        return {
          description:
            "You're enrolled in your subjects and have everything you need to study — AI-generated quizzes, flashcards, summaries, and reviewers built from your actual lecture materials, plus your own progress analytics.",
          highlights: [
            'Study your enrolled subjects and course materials',
            'Take teacher quizzes and personal practice drills',
            'Generate AI quizzes, flashcards, and reviewers',
            'Track your mastery and get study recommendations',
          ],
        };
      case 'teacher':
        return {
          description:
            'You manage your assigned subjects and publish everything students need — lecture materials, quizzes, and class announcements — while keeping an eye on how the class is performing.',
          highlights: [
            'Upload and organize lecture materials',
            'Build, publish, and manage quizzes',
            'Post class bulletins and announcements',
            'Monitor student progress and performance',
          ],
        };
      default:
        return {
          description:
            'You keep the platform running smoothly — managing accounts and roles, maintaining the subject catalog, moderating materials, and watching over activity and system performance.',
          highlights: [
            'Manage user accounts and assign roles',
            'Maintain the subject catalog and rosters',
            'Moderate uploaded learning materials',
            'Review activity logs and system performance',
          ],
        };
    }
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Hero banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary }]}>
        <View style={styles.bannerInner}>
          <View>
            <TouchableOpacity
              onPress={isEditing ? pickAvatar : undefined}
              disabled={!isEditing || uploadingAvatar}
              style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }]}
            >
              {currentUser.avatar ? (
                <Image source={{ uri: resolveMaterialFileUrl(currentUser.avatar) || undefined }} style={styles.avatarImage} />
              ) : uploadingAvatar ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.avatarText}>{initials || initial}</Text>
              )}
            </TouchableOpacity>
            {isEditing && (
              <View style={[styles.avatarBadge, { backgroundColor: '#fff' }]}>
                <Camera size={11} color={colors.primary} />
              </View>
            )}
            {isEditing && currentUser.avatar && (
              <TouchableOpacity onPress={removePhoto} disabled={removingAvatar} style={[styles.avatarRemove, { backgroundColor: colors.danger }]}>
                {removingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Trash2 size={11} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.bannerBody}>
            <View style={styles.nameRow}>
              <Text style={styles.bannerName} numberOfLines={1}>{currentUser.name}</Text>
              <Badge text={roleBadge.label} color="#fff" bg="rgba(255,255,255,0.18)" />
            </View>
            <Text style={styles.bannerEmail}>{currentUser.email}</Text>
            <View style={styles.bannerMeta}>
              <View style={styles.metaItem}>
                <Building2 size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>{currentUser.department || 'General Department'}</Text>
              </View>
              {currentUser.studentId ? (
                <View style={styles.metaItem}>
                  <FileBadge size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={[styles.metaText, { fontFamily: 'monospace' }]}>ID: {currentUser.studentId}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <Calendar size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>Joined {new Date(currentUser.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          {!isEditing ? (
            <TouchableOpacity onPress={() => { setName(currentUser.name); setIsEditing(true); }} style={styles.editBtn}>
              <Edit3 size={13} color="#fff" />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSave} style={styles.editBtn}>
              <Save size={13} color="#fff" />
              <Text style={styles.editBtnText}>Save Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Account details */}
      <Card style={styles.panel}>
        <SectionHeader title="Account Details" />
        {isEditing ? (
          <View style={{ gap: 12 }}>
            <Field label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
            <View>
              <Text style={styles.readOnlyLabel}>Department / Faculty (Read-only)</Text>
              <View style={[styles.readOnlyBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>{currentUser.department || 'General'}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.readOnlyLabel}>Email Address (Read-only)</Text>
              <View style={[styles.readOnlyBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>{currentUser.email}</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <OutlineButton label="Cancel" onPress={() => setIsEditing(false)} style={{ flex: 1 }} />
              <PrimaryButton label="Save Changes" onPress={handleSave} disabled={!name.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={styles.detailLabel}>Full Name</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.name}</Text>
            </View>
            <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={styles.detailLabel}>Email Address</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.email}</Text>
            </View>
            <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={styles.detailLabel}>User Role</Text>
              <Text style={[styles.detailValue, { color: colors.foreground, textTransform: 'capitalize' }]}>{currentUser.role}</Text>
            </View>
            <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={styles.detailLabel}>Department</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.department || 'General'}</Text>
            </View>
          </View>
        )}
      </Card>

      {/* Security & credentials */}
      <Card style={styles.panel}>
        <SectionHeader title="Security & Credentials" />
        {!showPasswordChange ? (
          <TouchableOpacity onPress={() => setShowPasswordChange(true)} style={[styles.securityRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.securityTitle, { color: colors.foreground }]}>Password Authentication</Text>
              <Text style={[styles.securitySub, { color: colors.mutedForeground }]}>Keep your StudyLens account protected</Text>
            </View>
            <View style={[styles.changePwBtn, { backgroundColor: colors.indigoSoft }]}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Change Password</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.securityForm, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Set New Password</Text>
            <Field label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter your current password" secureTextEntry />
            <Field label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry />
            <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry />
            <View style={styles.btnRow}>
              <OutlineButton label="Cancel" onPress={() => { setShowPasswordChange(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} style={{ flex: 1 }} />
              <PrimaryButton label={passwordSubmitting ? 'Updating...' : 'Update Password'} onPress={handlePasswordChange} loading={passwordSubmitting} disabled={passwordSubmitting} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </Card>

      {/* About my role */}
      <Card style={styles.panel}>
        <SectionHeader title="About My Role" />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>{roleInfo.description}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {roleInfo.highlights.map((h) => (
            <View key={h} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <CheckCircle2 size={14} color={colors.success} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1, lineHeight: 17 }}>{h}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { borderRadius: 16, padding: 18, boxShadow: '0 6px 14px rgba(0, 0, 0, 0.12)', elevation: 6 },
  bannerInner: { flexDirection: 'column', gap: 12 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 68, height: 68, borderRadius: 34 },
  avatarBadge: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#5b51d8' },
  avatarRemove: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#5b51d8' },
  avatarText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  bannerBody: { gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bannerName: { fontSize: 20, fontWeight: '800', color: '#fff', maxWidth: '100%' },
  bannerEmail: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  bannerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  panel: { gap: 12, padding: 16 },
  readOnlyLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, color: '#64748b' },
  readOnlyBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  detailBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  securityTitle: { fontSize: 14, fontWeight: '700' },
  securitySub: { fontSize: 12, marginTop: 2 },
  changePwBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  securityForm: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
});
