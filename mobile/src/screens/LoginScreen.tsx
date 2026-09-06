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
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth, UserRole, TwoFactorRequiredError, TwoFactorPending, EmailVerificationRequiredError } from '../context/AuthContext';
import { apiRequestResetOtp, apiResetPassword, EmailVerificationPending } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { Modal, Field, PrimaryButton, OutlineButton } from '../components/ui';

export default function LoginScreen({ navigation, onBack }: any) {
  const { login, register, verifyTwoFactor, cancelTwoFactor, verifyEmail, resendEmailCode, cancelEmailVerification } = useAuth();
  const { isDark, colors, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotMsgType, setForgotMsgType] = useState<'success' | 'error'>('error');
  const [forgotDevCode, setForgotDevCode] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const [twoFactorPending, setTwoFactorPending] = useState<TwoFactorPending | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const [emailVerifyPending, setEmailVerifyPending] = useState<EmailVerificationPending | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const closeForgotModal = () => {
    setForgotOpen(false);
    setForgotStep('request');
    setForgotEmail('');
    setForgotOtp('');
    setForgotPassword('');
    setForgotConfirm('');
    setForgotMsg('');
    setForgotDevCode('');
  };

  const handleSendCode = async () => {
    setForgotMsg('');
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotMsgType('error');
      setForgotMsg('Please enter a valid email address.');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await apiRequestResetOtp(forgotEmail.trim());
      setForgotStep('verify');
      setForgotDevCode(res.devCode || '');
      setForgotMsgType('success');
      setForgotMsg('A 6-digit verification code was sent to your email.');
    } catch (err) {
      setForgotMsgType('error');
      setForgotMsg((err as Error).message || 'Could not issue a reset code.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotMsg('');
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotMsgType('error');
      setForgotMsg('Please enter the 6-digit verification code.');
      return;
    }
    if (!forgotPassword || forgotPassword.length < 6) {
      setForgotMsgType('error');
      setForgotMsg('New password must be at least 6 characters.');
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      setForgotMsgType('error');
      setForgotMsg('Passwords do not match.');
      return;
    }
    setForgotSubmitting(true);
    try {
      await apiResetPassword(forgotEmail.trim(), forgotOtp.trim(), forgotPassword);
      setForgotMsgType('success');
      setForgotMsg('Password reset successfully! You can now sign in with your new password.');
      setTimeout(() => closeForgotModal(), 2200);
    } catch (err) {
      setForgotMsgType('error');
      setForgotMsg((err as Error).message || 'Could not reset the password.');
    } finally {
      setForgotSubmitting(false);
    }
  };

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
        const computedFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const dept = role === 'student' ? 'Computer Science' : role === 'teacher' ? 'Computer Science & IT' : 'Academic Affairs';
        try {
          await register(computedFullName, email.trim(), role, dept, password);
        } catch (regErr) {
          if (regErr instanceof EmailVerificationRequiredError) {
            setEmailVerifyPending(regErr.pending);
            setVerifyCode('');
            setVerifyError(null);
            return;
          }
          throw regErr;
        }
      } else {
        try {
          await login(email.trim(), role, password);
        } catch (loginErr) {
          if (loginErr instanceof EmailVerificationRequiredError) {
            setEmailVerifyPending(loginErr.pending);
            setVerifyCode('');
            setVerifyError(null);
            return;
          }
          if (loginErr instanceof TwoFactorRequiredError) {
            setTwoFactorPending(loginErr.pending);
            setTwoFactorCode('');
            setTwoFactorError(null);
            return;
          }
          throw loginErr;
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    setTwoFactorError(null);
    if (!twoFactorCode.trim() || twoFactorCode.trim().length !== 6) {
      setTwoFactorError('Enter the 6-digit verification code.');
      return;
    }
    setTwoFactorLoading(true);
    try {
      await verifyTwoFactor(twoFactorCode.trim());
    } catch (err) {
      setTwoFactorError((err as Error).message || 'Verification failed. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifyError(null);
    if (!verifyCode.trim() || verifyCode.trim().length !== 6) {
      setVerifyError('Enter the 6-digit verification code.');
      return;
    }
    setVerifyLoading(true);
    try {
      await verifyEmail(verifyCode.trim());
    } catch (err) {
      if (err instanceof EmailVerificationRequiredError) {
        setEmailVerifyPending(err.pending);
        setVerifyCode('');
        setVerifyError(null);
        return;
      }
      setVerifyError((err as Error).message || 'Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendVerifyCode = async () => {
    setVerifyError(null);
    try {
      await resendEmailCode();
    } catch (err) {
      setVerifyError((err as Error).message || 'Could not resend the verification code.');
    }
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
                  {field(firstName, setFirstName, 'First name', <UserIcon size={16} color={colors.mutedForeground} />)}
                  {field(lastName, setLastName, 'Last name', <UserIcon size={16} color={colors.mutedForeground} />)}
                </View>
              )}

              {field(email, setEmail, 'Enter your email', <Mail size={16} color={colors.mutedForeground} />, false, false, false, undefined, { keyboardType: 'email-address' })}

              {!twoFactorPending &&
                field(
                  password,
                  setPassword,
                  mode === 'login' ? 'Enter your password' : 'Create a password',
                  <Lock size={16} color={colors.mutedForeground} />,
                  true,
                  true,
                  showPassword,
                  setShowPassword
                )}

              {twoFactorPending && (
                <View style={{ gap: 10 }}>
                  <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <View style={styles.inputIcon}>
                      <ShieldCheck size={16} color={colors.primary} />
                    </View>
                    <TextInput
                      value={twoFactorCode}
                      onChangeText={setTwoFactorCode}
                      placeholder="6-digit verification code"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={[styles.input, { color: colors.foreground, letterSpacing: 4, fontVariant: ['tabular-nums'] }]}
                    />
                  </View>
                  {twoFactorError && (
                    <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                      <AlertCircle size={16} color={colors.danger} />
                      <Text style={[styles.errorText, { color: colors.danger }]}>{twoFactorError}</Text>
                    </View>
                  )}
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Two-factor authentication is enabled. Enter the 6-digit code issued for {twoFactorPending.email}. Codes expire after 5 minutes.
                  </Text>
                  <TouchableOpacity
                    onPress={handleVerifyTwoFactor}
                    disabled={twoFactorLoading}
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: twoFactorLoading ? 0.7 : 1 }]}
                  >
                    <Text style={styles.submitText}>{twoFactorLoading ? 'Verifying...' : 'Verify & Sign In'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      cancelTwoFactor();
                      setTwoFactorPending(null);
                      setTwoFactorCode('');
                      setTwoFactorError(null);
                    }}
                    style={{ alignSelf: 'center', paddingVertical: 2 }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Cancel and go back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailVerifyPending && (
                <View style={{ gap: 10 }}>
                  <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <View style={styles.inputIcon}>
                      <Mail size={16} color={colors.primary} />
                    </View>
                    <TextInput
                      value={verifyCode}
                      onChangeText={(v) => setVerifyCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="6-digit verification code"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={[styles.input, { color: colors.foreground, letterSpacing: 4, fontVariant: ['tabular-nums'] }]}
                    />
                  </View>
                  {verifyError && (
                    <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                      <AlertCircle size={16} color={colors.danger} />
                      <Text style={[styles.errorText, { color: colors.danger }]}>{verifyError}</Text>
                    </View>
                  )}
                  {!!emailVerifyPending.devCode && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: colors.successSoft, borderColor: colors.success }}>
                      <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>
                        Dev mode: your code is {emailVerifyPending.devCode}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    A 6-digit code was sent to {emailVerifyPending.email}. Enter it to activate your account.
                  </Text>
                  <TouchableOpacity
                    onPress={handleVerifyEmail}
                    disabled={verifyLoading}
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: verifyLoading ? 0.7 : 1 }]}
                  >
                    <Text style={styles.submitText}>{verifyLoading ? 'Verifying...' : 'Verify & Sign In'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleResendVerifyCode}
                    style={{ alignSelf: 'center', paddingVertical: 2 }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Resend code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      cancelEmailVerification();
                      setEmailVerifyPending(null);
                      setVerifyCode('');
                      setVerifyError(null);
                    }}
                    style={{ alignSelf: 'center', paddingVertical: 2 }}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700' }}>Use a different account</Text>
                  </TouchableOpacity>
                </View>
              )}

              {mode === 'register' && (
                field(
                  confirmPassword,
                  setConfirmPassword,
                  'Confirm your password',
                  <Lock size={16} color={colors.mutedForeground} />,
                  true,
                  false,
                  false,
                  undefined
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
              {!twoFactorPending && (
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                >
                  <Text style={styles.submitText}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
                </TouchableOpacity>
              )}

              {mode === 'login' && !twoFactorPending && (
                <TouchableOpacity
                  onPress={() => {
                    setForgotEmail(email.trim());
                    setForgotOpen(true);
                  }}
                  style={{ alignSelf: 'center', paddingVertical: 2 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Forgot password?</Text>
                </TouchableOpacity>
              )}

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

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotOpen}
        onClose={closeForgotModal}
        title="Reset Password"
        subtitle={forgotStep === 'request' ? 'Enter your account email to receive a 6-digit verification code.' : 'Enter the code we sent and choose a new password.'}
      >
        <View style={{ gap: 14 }}>
          {forgotMsg ? (
            <Text style={{ color: forgotMsgType === 'success' ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: '700' }}>{forgotMsg}</Text>
          ) : null}
          {forgotStep !== 'request' && forgotDevCode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: colors.successSoft, borderColor: colors.success }}>
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>
                Dev mode: your code is {forgotDevCode}
              </Text>
            </View>
          ) : null}
          {forgotStep === 'request' ? (
            <>
              <Field label="Email Address" value={forgotEmail} onChangeText={setForgotEmail} placeholder="you@studylens.edu" keyboardType="email-address" />
              <PrimaryButton label={forgotSubmitting ? 'Sending Code...' : 'Send Verification Code'} onPress={handleSendCode} loading={forgotSubmitting} />
              <OutlineButton label="Cancel" onPress={closeForgotModal} />
            </>
          ) : (
            <>
              <Field label="Verification Code" value={forgotOtp} onChangeText={(v) => setForgotOtp(v.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit code" keyboardType="numeric" />
              <Field label="New Password" value={forgotPassword} onChangeText={setForgotPassword} placeholder="At least 6 characters" secureTextEntry />
              <Field label="Confirm New Password" value={forgotConfirm} onChangeText={setForgotConfirm} placeholder="Re-enter new password" secureTextEntry />
              <PrimaryButton label={forgotSubmitting ? 'Resetting...' : 'Reset Password'} onPress={handleForgotPassword} loading={forgotSubmitting} />
              <OutlineButton label="Cancel" onPress={closeForgotModal} />
            </>
          )}
        </View>
      </Modal>
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
  switchLink: { alignItems: 'center', paddingVertical: 4 },
  backHome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});