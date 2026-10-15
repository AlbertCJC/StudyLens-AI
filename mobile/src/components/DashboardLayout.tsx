import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from 'react-native';
import {
  Menu,
  X,
  Bell,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth, UserRole } from '../context/AuthContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bumpRefresh } from '../navigation/navigationRef';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 320);

export interface MenuItem {
  key: string;
  label: string;
  Icon: React.ComponentType<any>;
  badge?: string;
}

interface DashboardLayoutProps {
  menuItems: MenuItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  onQuickNavigate?: (key: string) => void;
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ menuItems, activeKey, onNavigate, onQuickNavigate, title, onBack, children }: DashboardLayoutProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const { unreadCount } = useAnnouncements();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const translateX = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const role = (currentUser?.role === 'admin' ? 'admin' : currentUser?.role === 'teacher' ? 'teacher' : 'student') as UserRole;

  React.useEffect(() => {
    if (open) {
      translateX.setValue(-DRAWER_WIDTH);
      Animated.timing(translateX, { toValue: 0, duration: 230, useNativeDriver: true }).start();
    }
  }, [open, translateX]);

  const openDrawer = React.useCallback(() => setOpen(true), []);

  const closeDrawer = React.useCallback(() => {
    Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 180, useNativeDriver: true }).start(() => setOpen(false));
  }, [translateX]);

  // Swipe right from the left edge to open the navigation drawer
  const edgePan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !open && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        if (!open) openDrawer();
      },
    })
  ).current;

  // Drag the drawer to close it (swipe left), or release to snap back open
  const drawerPan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.max(-DRAWER_WIDTH, Math.min(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60 || g.vx < -0.5) {
          Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 150, useNativeDriver: true }).start(() => setOpen(false));
        } else {
          Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleNavigate = (key: string) => {
    closeDrawer();
    // Re-tapping the drawer item for the current screen would re-dispatch the
    // same navigation, which react-navigation ignores. Bump the screen's remount
    // counter instead so it reloads. activeKey is the one piece of state the
    // layout already has, so no extra prop is needed.
    if (key === activeKey) {
      bumpRefresh(key);
      return;
    }
    onNavigate(key);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Topbar */}
      <View style={[styles.topbar, { backgroundColor: colors.topbarBg, borderBottomColor: colors.border, paddingTop: insets.top, height: 56 + insets.top }]}>
        <View style={styles.topbarLeft}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
              <ChevronLeft size={24} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
              <Menu size={22} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <Text style={[styles.topbarTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.topbarRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            {isDark ? <Sun size={18} color={colors.warning} /> : <Moon size={18} color={colors.mutedForeground} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (onQuickNavigate) onQuickNavigate('notifications'); else openDrawer(); }} style={styles.bellWrap}>
            <Bell size={20} color={colors.mutedForeground} />
            {unreadCount > 0 && (
              <View style={[styles.bellDot, { backgroundColor: colors.primary }]}>
                <Text style={styles.bellDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (onQuickNavigate) onQuickNavigate('profile'); else openDrawer(); }} style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'SL'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.flex}>{children}</View>

      {/* Left-edge swipe zone to open the drawer */}
      {!open && <View {...edgePan.panHandlers} style={styles.edgeStrip} />}

      {/* Drawer */}
      <Modal visible={open} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={[styles.drawerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Animated.View
            {...drawerPan.panHandlers}
            style={[styles.drawer, { backgroundColor: colors.navBg, borderRightColor: colors.border, transform: [{ translateX }] }]}
          >
            <SafeAreaView style={styles.flex}>
              {/* Brand */}
              <View style={[styles.brandRow, { borderBottomColor: colors.border }]}>
                <Image
                  source={require('../../assets/studylens-icon.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.brandTitle, { color: colors.foreground }]}>StudyLens AI</Text>
                  <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '500', marginTop: 2 }}>Learning Platform</Text>
                </View>
                <TouchableOpacity onPress={closeDrawer} style={styles.iconBtn}>
                  <X size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Nav */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 4 }}>
                <Text style={[styles.navLabel, { color: colors.mutedForeground }]}>{role} Navigation</Text>
                {menuItems.map((item) => {
                  const isActive = activeKey === item.key;
                  const Icon = item.Icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => handleNavigate(item.key)}
                      style={[styles.navItem, isActive ? { backgroundColor: colors.navActiveBg } : { backgroundColor: 'transparent' }]}
                    >
                      <Icon size={17} color={isActive ? '#fff' : colors.navText} />
                      <Text style={[styles.navItemText, { color: isActive ? '#fff' : colors.navText }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.badge && (
                        <View style={[styles.navBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.primarySoft }]}>
                          <Text style={{ color: isActive ? '#fff' : colors.primary, fontSize: 10, fontWeight: '700' }}>{item.badge}</Text>
                        </View>
                      )}
                      <ChevronRight size={15} color={isActive ? '#fff' : 'rgba(148,163,184,0.5)'} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* User + Logout */}
              <View style={[styles.userBox, { borderTopColor: colors.border }]}>
                <View style={styles.userRow}>
                  <View style={[styles.avatarSm, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'J'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>{currentUser?.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>{currentUser?.email}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={logout}
                  style={[styles.logoutBtn, { borderColor: colors.border }]}
                >
                  <LogOut size={15} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>Logout</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
          <TouchableOpacity style={styles.flex} onPress={closeDrawer} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topbarTitle: { fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 4 },
  bellWrap: { position: 'relative', padding: 2 },
  bellDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellDotText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  edgeStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, backgroundColor: 'transparent', zIndex: 5 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawer: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    borderRightWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  brandLogo: { width: 38, height: 38 },
  brandTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  roleBox: { margin: 12, borderRadius: 12, borderWidth: 1, padding: 10, gap: 8 },
  roleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  roleRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 3,
  },
  rolePill: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  navLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 8, paddingVertical: 6 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  navItemText: { fontSize: 13, fontWeight: '600', flex: 1 },
  navBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  userBox: { borderTopWidth: 1, padding: 14, gap: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSm: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
});