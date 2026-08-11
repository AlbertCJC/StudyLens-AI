import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  BookOpen,
  Sun,
  Moon,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  GraduationCap,
  UserCheck,
} from 'lucide-react-native';
import { useAuth, UserRole } from '../context/AuthContext';
import { User } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

export default function LoginScreen({ navigation, onBack }: any) {
  const { login, register, quickLogin } = useAuth();
  const { isDark, colors, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!firstName.trim()) {
          setError('Please enter your first name.');
          setLoading(false);
          return;
        }
        if (!lastName.trim()) {
          setError('Please enter your last name.');
          setLoading(false);
          return;
        }
        if (password && confirmPassword && password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        const cleanMI = middleInitial.trim().toUpperCase().replace(/\.$/, '');
        const formattedMI = cleanMI ? `${cleanMI}. ` : '';
        const computedFullName = `${firstName.trim()} ${formattedMI}${lastName.trim()}`.replace(/\s+/g, ' ');
        const dept = role === 'student' ? 'Computer Science' : role === 'teacher' ? 'Computer Science & IT' : 'Academic Affairs';
        await register(computedFullName, email.trim(), role, dept);
      } else {
        await login(email.trim(), role);
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoRole: UserRole) => {
    const profiles: Record<UserRole, Partial<User>> = {
      student: { id: 'usr-student-1', name: 'John Wendyl S. Sanchez', email: 'student@studylens.edu', role: 'student', department: 'Computer Science' },
      teacher: { id: 'usr-teacher-1', name: 'Christian C. Barral, MIT', email: 'teacher@studylens.edu', role: 'teacher', department: 'College of Computer Studies' },
    };
    quickLogin(profiles[demoRole]);
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
  };

  const inputBg = colors.inputBg;
  const inputBorder = colors.border;
  const inputText = colors.foreground;
  const placeholderColor = colors.mutedForeground;
  const fieldColor = colors.accent;

  const field = (value: string, setValue: (v: string) => void, placeholder: string, icon: React.ReactNode, secure?: boolean, showToggle?: boolean, show?: boolean, setShow?: (v: boolean) => void, extraProps?: any) => (
    <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        secureTextEntry={secure && !(show || false)}
        autoCapitalize="none"
        style={[styles.input, { color: inputText }]}
        {...extraProps}
      />
      {showToggle && setShow && (
        <TouchableOpacity onPress={() => setShow(!show)} style={styles.inputToggle}>
          {show ? <EyeOff size={16} color={placeholderColor} /> : <Eye size={16} color={placeholderColor} />}
        </TouchableOpacity>
      )}
    </View>
  );

  const rolePill = (r: UserRole, active: boolean, icon: React.ReactNode) => (
    <TouchableOpacity
      key={r}
      style={[
        styles.pillButton,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
      onPress={() => setRole(r)}
    >
      {icon}
      <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground }]}>{r}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.loginBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Theme Toggle */}
        <View style={styles.topRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            {isDark ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color={colors.mutedForeground} />}
          </TouchableOpacity>
        </View>

        <View style={styles.centerCol}>
          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.loginCard, borderColor: isDark ? colors.border : '#f1f5f9' }]}>
            {/* Logo */}
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <BookOpen size={22} color="#ffffff" />
            </View>

            {/* Header */}
            <View style={[styles.cardHeader, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
                {mode === 'login' ? 'Sign in to continue your learning journey' : 'Join StudyLens AI and start your learning journey'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {mode === 'register' && (
                <View style={{ gap: 10 }}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      {field(firstName, setFirstName, 'First name', <UserIcon size={16} color={colors.mutedForeground} />)}
                    </View>
                    <View style={styles.flex}>
                      {field(lastName, setLastName, 'Last name', <UserIcon size={16} color={colors.mutedForeground} />)}
                    </View>
                  </View>
                  {field(middleInitial, setMiddleInitial, 'Middle initial (optional)', <UserIcon size={16} color={colors.mutedForeground} />)}
                </View>
              )}

              {field(email, setEmail, 'Enter your email', <Mail size={16} color={colors.mutedForeground} />, false, false, false, undefined, { keyboardType: 'email-address' })}

              {field(
                password,
                setPassword,
                mode === 'login' ? 'Enter your password' : 'Create a password',
                <Lock size={16} color={colors.mutedForeground} />,
                true,
                true,
                showPassword,
                setShowPassword
              )}

              {mode === 'register' && (
                field(
                  confirmPassword,
                  setConfirmPassword,
                  'Confirm your password',
                  <Lock size={16} color={colors.mutedForeground} />,
                  true,
                  true,
                  showConfirmPassword,
                  setShowConfirmPassword
                )
              )}

              {error && (
                <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                  <AlertCircle size={16} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                </View>
              )}

              {mode === 'register' && (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: colors.foreground }]}>I am a</Text>
                  <View style={styles.roleRow}>
                    {rolePill('student', role === 'student', <GraduationCap size={14} color={role === 'student' ? '#fff' : colors.mutedForeground} />)}
                    {rolePill('teacher', role === 'teacher', <UserCheck size={14} color={role === 'teacher' ? '#fff' : colors.mutedForeground} />)}
                  </View>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              >
                <Text style={styles.submitText}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
              </TouchableOpacity>

              {/* Quick Demo */}
              <View style={[styles.demoDivider, { borderTopColor: isDark ? colors.border : '#f1f5f9' }]}>
                <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>Quick Demo 1-Click Entry</Text>
                <View style={styles.demoRow}>
                  <TouchableOpacity style={[styles.demoBtn, { backgroundColor: colors.indigoSoft }]} onPress={() => handleQuickLogin('student')}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.demoBtn, { backgroundColor: 'rgba(168,85,247,0.12)' }]} onPress={() => handleQuickLogin('teacher')}>
                    <Text style={{ color: '#a855f7', fontSize: 12, fontWeight: '600' }}>Teacher</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Toggle Login/Register */}
              <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'register' : 'login')} style={styles.switchLink}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{mode === 'login' ? 'Register here' : 'Sign in here'}</Text>
                </Text>
              </TouchableOpacity>

              {onBack && (
                <TouchableOpacity onPress={onBack} style={styles.backHome}>
                  <ArrowLeft size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>Back to home</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  topRight: { position: 'absolute', top: 18, right: 22, zIndex: 10 },
  themeBtn: { padding: 6 },
  centerCol: { alignItems: 'center', width: '100%' },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  logo: {
    height: 48,
    width: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 14,
  },
  cardHeader: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    width: '100%',
  },
  cardTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cardSubtitle: { fontSize: 12, textAlign: 'center' },
  form: { width: '100%', gap: 12 },
  label: { fontSize: 13, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  inputIcon: { padding: 6 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: '500' },
  inputToggle: { padding: 6 },
  row: { flexDirection: 'row', gap: 10 },
  roleRow: { flexDirection: 'row', gap: 8 },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    flex: 1,
  },
  pillText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 12, fontWeight: '600', flex: 1 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  demoDivider: { borderTopWidth: 1, paddingTop: 14, gap: 10 },
  demoLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  switchLink: { alignItems: 'center', paddingVertical: 4 },
  backHome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});