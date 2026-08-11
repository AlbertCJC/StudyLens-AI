import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {
  BookOpen,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Brain,
  PieChart,
  Users,
  Star,
  CheckCircle2,
  GraduationCap,
  UserCheck,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import LoginScreen from './LoginScreen';

type TabKey = 'home' | 'features' | 'about' | 'contact';

export default function LandingScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { quickLogin } = useAuth();
  const [activeTab, setActiveTab] = React.useState<TabKey>('home');
  const [authModal, setAuthModal] = React.useState<'login' | 'register' | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionsRef = useRef<Record<string, number>>({});

  const scrollToTab = (tab: TabKey) => {
    setActiveTab(tab);
    const y = sectionsRef.current[tab] || 0;
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  const onSectionLayout = (tab: TabKey) => (e: any) => {
    sectionsRef.current[tab] = e.nativeEvent.layout.y;
  };

  const navTab = (tab: TabKey, label: string) => (
    <TouchableOpacity key={tab} onPress={() => scrollToTab(tab)} style={{ paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: activeTab === tab ? colors.primary : colors.mutedForeground }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (authModal) {
    return <LoginScreen onBack={() => setAuthModal(null)} />;
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.topbarBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.brandRow} onPress={() => scrollToTab('home')}>
          <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
            <BookOpen size={16} color="#fff" />
          </View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>
            StudyLens<Text style={{ color: colors.primary }}> AI</Text>
          </Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerTabs}>
          {navTab('home', 'Home')}
          {navTab('features', 'Features')}
          {navTab('about', 'About')}
          {navTab('contact', 'Contact')}
        </ScrollView>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            {isDark ? <Sun size={16} color={colors.warning} /> : <Moon size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAuthModal('login')}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAuthModal('register')} style={[styles.registerBtn, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View onLayout={onSectionLayout('home')} style={[styles.hero, { backgroundColor: colors.background }]}>
          <View style={styles.heroCol}>
            <View style={[styles.heroBadge, { backgroundColor: colors.indigoSoft }]}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>AI-Powered Learning</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Transform Your Learning with{' '}
              <Text style={{ color: colors.primary }}>AI Technology</Text>
            </Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              StudyLens AI is an adaptive learning and automated assessment generation platform that personalizes your
              educational journey with intelligent quizzes, flashcards, and progress tracking.
            </Text>
            <View style={styles.heroCtas}>
              <TouchableOpacity onPress={() => setAuthModal('register')} style={[styles.ctaPrimary, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Get Started</Text>
                <ArrowRight size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => scrollToTab('features')} style={[styles.ctaOutline, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>Learn More</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              {[
                { n: '1000+', l: 'Active Students' },
                { n: '500+', l: 'Quiz Generated' },
                { n: '95%', l: 'Success Rate' },
              ].map((s) => (
                <View key={s.l} style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.primary }]}>{s.n}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.l}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Hero visual (2x2 cards that quick-login as student) */}
          <View style={[styles.heroBoard, { backgroundColor: isDark ? colors.surfaceAlt : colors.surfaceAlt }]}>
            {[
              { label: 'AI Quiz', desc: 'Auto-generated assessments', Icon: Brain },
              { label: 'Flashcards', desc: 'Smart study cards', Icon: BookOpen },
              { label: 'Progress', desc: 'Track your growth', Icon: PieChart },
              { label: 'Community', desc: 'Learn together', Icon: Users },
            ].map(({ label, desc, Icon }) => (
              <TouchableOpacity
                key={label}
                onPress={() => quickLogin({ id: 'usr-student-1', name: 'John Wendyl S. Sanchez', email: 'student@studylens.edu', role: 'student' })}
                style={[styles.hvCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.hvIcon, { backgroundColor: colors.indigoSoft }]}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FEATURES */}
        <View onLayout={onSectionLayout('features')} style={[styles.section, { backgroundColor: isDark ? colors.background : colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Powerful Features for Modern Learning</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Everything you need to excel in your studies, powered by artificial intelligence
          </Text>
          <View style={styles.featureGrid}>
            {[
              { title: 'AI Quiz Generator', desc: 'Automatically generate customized quizzes from your study materials using advanced AI', Icon: Brain },
              { title: 'AI Flashcard Generator', desc: 'Create interactive flashcards instantly from PDFs and learning materials', Icon: BookOpen },
              { title: 'Learning Progress Tracking', desc: 'Monitor your performance with detailed analytics and insights', Icon: PieChart },
              { title: 'Personalized Recommendations', desc: 'Get AI-powered suggestions tailored to your learning style and goals', Icon: Star },
            ].map(({ title, desc, Icon }) => (
              <View key={title} style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.hvIcon, { backgroundColor: colors.indigoSoft }]}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '700' }}>{title}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ABOUT */}
        <View onLayout={onSectionLayout('about')} style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={styles.aboutLeft}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About StudyLens AI</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19, marginTop: 10 }}>
              StudyLens AI is designed to revolutionize the way students learn and teachers assess. Our platform
              leverages cutting-edge artificial intelligence to create personalized learning experiences that adapt to
              each student's unique needs.
            </Text>
            {[
              'Adaptive learning algorithms',
              'Automated assessment generation',
              'Real-time progress tracking',
              'Collaborative learning tools',
              'Multi-format content support',
            ].map((item) => (
              <View key={item} style={styles.checkRow}>
                <CheckCircle2 size={16} color={colors.success} />
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.whyBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.whyTitle, { color: colors.foreground }]}>Why Choose Us?</Text>
            {[
              { who: 'For Students', text: 'Personalized learning paths, instant feedback, and comprehensive progress tracking to help you achieve your academic goals.' },
              { who: 'For Teachers', text: 'Save time with automated assessment generation, gain insights into student performance, and focus on what matters most - teaching.' },
              { who: 'For Administrators', text: 'Comprehensive analytics, user management, and system monitoring to ensure optimal learning outcomes.' },
            ].map(({ who, text }) => (
              <View key={who} style={styles.whyItem}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>{who}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View onLayout={onSectionLayout('contact')} style={[styles.ctaSection, { backgroundColor: isDark ? colors.background : colors.surfaceAlt }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: 'center' }]}>Ready to Get Started?</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Join thousands of students and educators already using StudyLens AI to transform their learning experience.
          </Text>
          <TouchableOpacity onPress={() => setAuthModal('register')} style={[styles.ctaPrimary, { backgroundColor: colors.primary, alignSelf: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Start Learning Today</Text>
            <ArrowRight size={18} color="#fff" />
          </TouchableOpacity>
          {/* Quick demo entry */}
          <View style={[styles.demoPillRow, { borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Demo 1-Click Entry</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity onPress={() => quickLogin({ id: 'usr-student-1', name: 'John Wendyl S. Sanchez', email: 'student@studylens.edu', role: 'student' })} style={[styles.demoBtn, { backgroundColor: colors.indigoSoft }]}>
                <GraduationCap size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Student</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => quickLogin({ id: 'usr-teacher-1', name: 'Christian C. Barral, MIT', email: 'teacher@studylens.edu', role: 'teacher' })} style={[styles.demoBtn, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                <UserCheck size={14} color="#a855f7" />
                <Text style={{ color: '#a855f7', fontSize: 12, fontWeight: '700' }}>Teacher</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View style={[styles.footer, { backgroundColor: isDark ? colors.surfaceAlt : colors.surface }]}>
          <View style={styles.footerBrand}>
            <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
              <BookOpen size={14} color="#fff" />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '800' }}>StudyLens AI</Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
            Adaptive Learning and Automated Assessment Generation Platform
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 8 }}>
            {'\u00a9 2026 StudyLens AI. All rights reserved.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 15, fontWeight: '800' },
  headerTabs: { alignItems: 'center', gap: 14, flex: 1, paddingHorizontal: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 2 },
  registerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  hero: { paddingHorizontal: 20, paddingVertical: 28, gap: 20 },
  heroCol: { gap: 14 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  heroTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  heroSub: { fontSize: 13, lineHeight: 20 },
  heroCtas: { flexDirection: 'row', gap: 10 },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  ctaOutline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 14, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '900' },
  heroBoard: { borderRadius: 28, padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hvCard: { width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  hvIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { padding: 20, gap: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sectionSub: { fontSize: 12, lineHeight: 18, maxWidth: 420 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  featureCard: { width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  aboutLeft: { gap: 10, maxWidth: 460 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  whyBox: { borderRadius: 28, padding: 22, gap: 16, marginTop: 8 },
  whyTitle: { fontSize: 16, fontWeight: '900' },
  whyItem: { gap: 2 },
  ctaSection: { padding: 28, gap: 14 },
  demoPillRow: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginTop: 6, alignItems: 'center' },
  demoRow: { flexDirection: 'row', gap: 10, width: '100%' },
  demoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  footer: { padding: 24, gap: 4 },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});