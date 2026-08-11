import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { User, LogOut, Moon, Sun, GraduationCap, Building2, FileBadge, Sparkles, PenLine, Save, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Field, PrimaryButton, OutlineButton, SectionHeader, Modal } from '../components/ui';

export default function ProfileScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { currentUser, updateProfile, logout, switchRole } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [studentId, setStudentId] = useState(currentUser?.studentId || '');
  const [saving, setSaving] = useState(false);

  if (!currentUser) return null;

  const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
  const roleLabel = currentUser.role === 'teacher' ? 'Teacher' : 'Student';

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() || currentUser.name, email: email.trim() || currentUser.email, department: department.trim(), studentId: studentId.trim() });
      Alert.alert('Profile updated', 'Your changes have been saved on this device.');
      setEditOpen(false);
    } catch (err) {
      Alert.alert('Error', 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out of StudyLens AI?', 'Your session will be cleared from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Profile banner */}
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: '#fff' }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {currentUser.name}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{currentUser.email}</Text>
          <View style={styles.roleRow}>
            <Badge text={roleLabel} color={currentUser.role === 'teacher' ? '#2563eb' : colors.primary} bg={currentUser.role === 'teacher' ? 'rgba(37,99,235,0.12)' : colors.indigoSoft} />
            {currentUser.status === 'active' && <Badge text="Active" color={colors.success} bg={colors.successSoft} />}
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
        <SectionHeader title="Account Details" />
        {currentUser.studentId && (
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.indigoSoft }]}>
              <FileBadge size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Student ID</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{currentUser.studentId}</Text>
            </View>
          </View>
        )}
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: colors.successSoft }]}>
            <GraduationCap size={16} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Department</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{currentUser.department || 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={[styles.infoIcon, { backgroundColor: colors.warningSoft }]}>
            <Building2 size={16} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Institution</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>University of Cebu - Main Campus</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
        <SectionHeader title="Quick Actions" />
        <TouchableOpacity
          onPress={() => {
            setName(currentUser.name);
            setEmail(currentUser.email);
            setDepartment(currentUser.department || '');
            setStudentId(currentUser.studentId || '');
            setEditOpen(true);
          }}
          style={[styles.actionRow, { borderColor: colors.border }]}
        >
          <PenLine size={17} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1 }}>Edit Profile Information</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={[styles.actionRow, { borderColor: colors.border }]}>
          {isDark ? <Sun size={17} color={colors.warning} /> : <Moon size={17} color={colors.primary} />}
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1 }}>Toggle Dark / Light Mode</Text>
          <Badge text={isDark ? 'Dark' : 'Light'} color={isDark ? colors.warning : colors.primary} bg={isDark ? colors.warningSoft : colors.indigoSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const targetRole = currentUser.role === 'teacher' ? 'student' : 'teacher';
            switchRole(targetRole);
          }}
          style={[styles.actionRow, { borderColor: colors.border }]}
        >
          <ShieldCheck size={17} color={colors.success} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1 }}>
            Switch Role to {currentUser.role === 'teacher' ? 'Student' : 'Teacher'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate('ai-assistant')} style={[styles.actionRow, { borderColor: colors.border }]}>
          <Sparkles size={17} color="#d97706" />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1 }}>Open AI Resource Generator</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
        <SectionHeader title="About StudyLens AI" />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>
          Adaptive learning & automated assessment generation platform powered by Groq GPT-OSS-120B inference. Built for the
          College of Computer Studies, University of Cebu - Main Campus.
        </Text>
        <Badge text="Version 2.0.0 (Groq GPT-OSS-120B Edition)" color={colors.primary} />
      </View>

      <PrimaryButton label="Log Out" color={colors.danger} onPress={confirmLogout} />
      <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: 'center' }}>
        Logged in as {currentUser.email}
      </Text>

      {/* Edit modal */}
      <Modal visible={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile" subtitle="Changes are saved on this device">
        <View style={{ gap: 12 }}>
          <Field label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@studylens.edu" keyboardType="email-address" />
          <Field label="Department" value={department} onChangeText={setDepartment} placeholder="e.g. Computer Science" />
          <Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. 2024-STU-0841" />
          <View style={styles.modalActions}>
            <OutlineButton label="Cancel" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
            <PrimaryButton label="Save Changes" onPress={saveProfile} loading={saving} disabled={saving || !name.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 18 },
  avatar: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontWeight: '900' },
  bannerTitle: { fontSize: 18, fontWeight: '800' },
  roleRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});