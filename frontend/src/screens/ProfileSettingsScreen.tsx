import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Animated,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import type { LecturerStatus, UserRole } from '../types/types';

interface ProfileSettingsScreenProps {
  navigation: any;
  currentUser: string;
  onLogout: () => void;
}

const MOCK_USER_PROFILE = {
  id: 'user-001',
  username: 'nguyenvana',
  fullName: 'Nguyễn Văn A',
  email: 'nguyenvana@iuh.edu.vn',
  role: 'lecturer' as UserRole,
  studentId: undefined,
  lecturerId: 'GV-2024-001',
  department: 'Khoa Công nghệ Thông tin',
  phone: '0901234567',
  lecturerStatus: 'available' as LecturerStatus,
};

// Stats
const MOCK_STATS = [
  { label: 'Tin nhắn', value: '1,247', icon: 'chat-processing' },
  { label: 'Liên hệ', value: '89', icon: 'account-group' },
  { label: 'Nhóm', value: '12', icon: 'account-multiple' },
];

interface SettingItemProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  iconColor = Colors.primary,
  title,
  subtitle,
  onPress,
  showArrow = true,
  rightElement,
}) => {
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        style={styles.settingItem}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <LinearGradient
          colors={[`${iconColor}20`, `${iconColor}10`]}
          style={styles.settingIcon}
        >
          <Icon name={icon} size={20} color={iconColor} />
        </LinearGradient>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        {rightElement || (showArrow && (
          <Icon name="chevron-right" size={20} color={Colors.textMuted} />
        ))}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  navigation,
  currentUser,
  onLogout,
}) => {
  const [profile] = useState(MOCK_USER_PROFILE);
  const [lecturerStatus, setLecturerStatus] = useState<LecturerStatus>(
    profile.lecturerStatus || 'available',
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const headerScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(headerScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(statsAnim, {
          toValue: 1,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const isLecturer = profile.role === 'lecturer';

  const handleStatusToggle = () => {
    const newStatus: LecturerStatus =
      lecturerStatus === 'available' ? 'busy' : 'available';
    setLecturerStatus(newStatus);
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          onPress: () => {
            // Thêm độ trễ nhỏ để Dialog Alert đóng hoàn toàn trước khi hủy cây Navigation
            // Tránh lỗi văng App/treo máy ảo trên một số dòng Android
            setTimeout(() => {
              if (onLogout) {
                onLogout();
              }
            }, 100);
          } 
        },
      ],
    );
  };

  const handleEditAvatar = () => {
    Alert.alert('Thay đổi ảnh đại diện', 'Chọn ảnh từ thư viện hoặc chụp mới', [
      { text: 'Chụp ảnh', onPress: () => {} },
      { text: 'Thư viện', onPress: () => {} },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <LinearGradient
        colors={['#004A82', '#0066B3']}
        style={styles.headerBar}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ & Cài đặt</Text>
        <TouchableOpacity style={styles.backButton}>
          <Icon name="qrcode-scan" size={20} color={Colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <Animated.View
          style={[
            styles.profileSection,
            { transform: [{ scale: headerScale }] },
          ]}
        >
          <LinearGradient
            colors={['#004A82', '#0066B3', '#0077CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            {/* Decorative */}
            <View style={styles.profileDecor1} />
            <View style={styles.profileDecor2} />

            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleEditAvatar}
              activeOpacity={0.8}
            >
              <Avatar name={profile.fullName} size="xxlarge" showGradientRing />
              <View style={styles.editAvatarBadge}>
                <Icon name="camera" size={14} color={Colors.white} />
              </View>
            </TouchableOpacity>

            <Text style={styles.profileName}>{profile.fullName}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>

            {/* Role Badge */}
            <View style={styles.roleBadge}>
              <Icon
                name={isLecturer ? 'school' : 'badge-account-horizontal-outline'}
                size={14}
                color={Colors.white}
              />
              <Text style={styles.roleText}>
                {isLecturer ? 'Giảng viên' : 'Sinh viên'}
              </Text>
            </View>

            {/* ID & Department */}
            <Text style={styles.profileId}>
              {isLecturer
                ? `Mã GV: ${profile.lecturerId}`
                : `MSSV: ${profile.studentId}`}
            </Text>
            {profile.department && (
              <Text style={styles.profileDepartment}>{profile.department}</Text>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Stats Bar */}
        <Animated.View
          style={[
            styles.statsBar,
            {
              transform: [{ scale: statsAnim }],
              opacity: statsAnim,
            },
          ]}
        >
          {MOCK_STATS.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.statItem}>
                <Icon name={stat.icon} size={20} color={Colors.primary} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity }}>
          {/* Lecturer Status */}
          {isLecturer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trạng thái tư vấn</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusInfo}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          lecturerStatus === 'available'
                            ? Colors.success
                            : Colors.danger,
                      },
                    ]}
                  />
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>
                      {lecturerStatus === 'available'
                        ? 'Sẵn sàng tư vấn'
                        : 'Đang bận'}
                    </Text>
                    <Text style={styles.statusDescription}>
                      {lecturerStatus === 'available'
                        ? 'Sinh viên có thể liên hệ trực tiếp'
                        : 'Tin nhắn sẽ được tự động phản hồi'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={lecturerStatus === 'available'}
                  onValueChange={handleStatusToggle}
                  trackColor={{
                    false: Colors.dangerSoft,
                    true: Colors.successSoft,
                  }}
                  thumbColor={
                    lecturerStatus === 'available'
                      ? Colors.success
                      : Colors.danger
                  }
                  style={styles.statusSwitch}
                />
              </View>
            </View>
          )}

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tài khoản</Text>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="account-edit-outline"
                title="Chỉnh sửa hồ sơ"
                subtitle="Tên, email, số điện thoại"
                onPress={() => {}}
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="lock-reset"
                iconColor="#FF9800"
                title="Đổi mật khẩu"
                onPress={() => {}}
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="shield-check-outline"
                iconColor="#4CAF50"
                title="Bảo mật"
                subtitle="Xác thực 2 bước"
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông báo</Text>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="bell-outline"
                iconColor="#2196F3"
                title="Thông báo đẩy"
                showArrow={false}
                rightElement={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primarySurface,
                    }}
                    thumbColor={
                      notificationsEnabled ? Colors.primary : Colors.textMuted
                    }
                  />
                }
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="volume-high"
                iconColor="#9C27B0"
                title="Âm thanh"
                subtitle="Tuỳ chỉnh âm báo"
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Appearance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giao diện</Text>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="theme-light-dark"
                iconColor="#607D8B"
                title="Chế độ tối"
                showArrow={false}
                rightElement={
                  <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primarySurface,
                    }}
                    thumbColor={
                      darkMode ? Colors.primary : Colors.textMuted
                    }
                  />
                }
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="format-size"
                iconColor="#FF5722"
                title="Cỡ chữ"
                subtitle="Trung bình"
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Storage & Data */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dung lượng & Dữ liệu</Text>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="database-outline"
                iconColor="#009688"
                title="Dung lượng lưu trữ"
                subtitle="124 MB đã sử dụng"
                onPress={() => {}}
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="cloud-download-outline"
                iconColor="#3F51B5"
                title="Tự động tải xuống"
                subtitle="Wi-Fi: Ảnh & Video"
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Other */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Khác</Text>
            <View style={styles.settingsCard}>
              <SettingItem
                icon="translate"
                iconColor="#00BCD4"
                title="Ngôn ngữ"
                subtitle="Tiếng Việt"
                onPress={() => {}}
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="information-outline"
                iconColor="#607D8B"
                title="Về IUH Connect"
                subtitle="Phiên bản 1.0.0"
                onPress={() => {}}
              />
              <View style={styles.settingDivider} />
              <SettingItem
                icon="help-circle-outline"
                iconColor="#795548"
                title="Trợ giúp & Phản hồi"
                onPress={() => {}}
              />
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[Colors.dangerLight, '#FFE0E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoutGradient}
            >
              <Icon name="logout" size={20} color={Colors.danger} />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>IUH Connect © 2024</Text>
            <Text style={styles.footerSubtext}>
              Trường Đại học Công nghiệp TP.HCM
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.h4,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },
  // Profile
  profileSection: {
    overflow: 'hidden',
  },
  profileGradient: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl + 20,
    position: 'relative',
  },
  profileDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -50,
    right: -30,
  },
  profileDecor2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.03)',
    bottom: -20,
    left: -30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  profileName: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.white,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  profileEmail: {
    fontSize: Typography.bodySmall,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: Spacing.md,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.round,
    gap: 6,
    marginBottom: Spacing.sm,
  },
  roleText: {
    fontSize: Typography.caption,
    fontWeight: Typography.semiBold,
    color: Colors.white,
  },
  profileId: {
    fontSize: Typography.caption,
    color: 'rgba(255,255,255,0.65)',
  },
  profileDepartment: {
    fontSize: Typography.caption,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  // Stats
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xl,
    marginTop: -Spacing.xxl,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    ...Shadows.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: Typography.h4,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.tiny,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
  },
  // Section
  section: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.caption,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Status Card
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.semiBold,
    color: Colors.textPrimary,
  },
  statusDescription: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusSwitch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  // Settings Card
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 70,
  },
  // Logout
  logoutButton: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xxxl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.danger,
  },
  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  footerText: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    fontWeight: Typography.medium,
  },
  footerSubtext: {
    fontSize: Typography.tiny,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default ProfileSettingsScreen;
