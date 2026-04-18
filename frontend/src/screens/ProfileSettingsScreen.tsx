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
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import type { LecturerStatus, UserRole } from '../types/types';

interface ProfileSettingsScreenProps {
  navigation: any;
  currentUser: string;
  token?: string | null;
  onLogout: () => void;
}

// Stats (Static for now as no backend endpoint exists for these yet)
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
    Animated.timing(pressAnim, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(pressAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
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
        <LinearGradient colors={[`${iconColor}20`, `${iconColor}10`]} style={styles.settingIcon}>
          <Icon name={icon} size={20} color={iconColor} />
        </LinearGradient>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        {rightElement || (showArrow && <Icon name="chevron-right" size={20} color={Colors.textMuted} />)}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  navigation,
  currentUser,
  token,
  onLogout,
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: '',
    bio: '',
    address: '',
    gender: 'OTHER',
    dateOfBirth: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [lecturerStatus, setLecturerStatus] = useState<LecturerStatus>('available');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const headerScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  const serverUrl = Platform.select({
    android: 'http://10.0.2.2:8080',
    default: 'http://localhost:8080',
  });

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${serverUrl}/api/v1/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          ...data,
          lecturerStatus: data.lecturerStatus ? data.lecturerStatus.toLowerCase() : 'available',
          role: data.role ? data.role.toLowerCase() : 'student',
          gender: data.gender || 'OTHER'
        });
        setLecturerStatus(data.lecturerStatus ? data.lecturerStatus.toLowerCase() : 'available');
      }
    } catch (error) {
      console.log('Error fetching user profile', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin cá nhân');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  useEffect(() => {
    if (!loadingProfile && profile) {
      Animated.sequence([
        Animated.spring(headerScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(statsAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [loadingProfile, profile]);

  const isLecturer = profile?.role === 'lecturer';

  const handleStatusToggle = async () => {
    const newStatus: LecturerStatus = lecturerStatus === 'available' ? 'busy' : 'available';
    setLecturerStatus(newStatus);
    try {
      await fetch(`${serverUrl}/api/v1/users/me`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lecturerStatus: newStatus.toUpperCase() })
      });
    } catch (e) {
      console.log('Failed to save status', e);
    }
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', onPress: () => setTimeout(() => onLogout?.(), 100) },
    ]);
  };

  const openEditModal = () => {
    let parsedDate = new Date();
    if (profile.dateOfBirth) {
      const parts = profile.dateOfBirth.split('-'); // Format expects YYYY-MM-DD
      if (parts.length === 3) {
        parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    
    setEditForm({
      fullName: profile.fullName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      department: profile.department || '',
      bio: profile.bio || '',
      address: profile.address || '',
      gender: profile.gender || 'OTHER',
      dateOfBirth: parsedDate,
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    // Format Date to YYYY-MM-DD
    const isoDateString = editForm.dateOfBirth.toISOString().split('T')[0];
    
    try {
      const response = await fetch(`${serverUrl}/api/v1/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email,
          phone: editForm.phone,
          department: editForm.department,
          bio: editForm.bio,
          address: editForm.address,
          gender: editForm.gender,
          dateOfBirth: isoDateString
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev: any) => ({
          ...prev,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          department: data.department,
          bio: data.bio,
          address: data.address,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth
        }));
        setShowEditModal(false);
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể lưu thay đổi.');
      }
    } catch (error) {
      Alert.alert('Lỗi mạng', 'Kiểm tra lại kết nối và thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateLabel = (dateObj: Date) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const translateGender = (g: string) => {
    if (g === 'MALE') return 'Nam';
    if (g === 'FEMALE') return 'Nữ';
    return 'Khác';
  };

  if (loadingProfile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (!profile) return <View style={styles.container}><Text style={{textAlign: 'center', marginTop: 50}}>Không tìm thấy hồ sơ.</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <LinearGradient colors={['#004A82', '#0066B3']} style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ & Cài đặt</Text>
        <TouchableOpacity style={styles.backButton}>
          <Icon name="qrcode-scan" size={20} color={Colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <Animated.View style={[styles.profileSection, { transform: [{ scale: headerScale }] }]}>
          <LinearGradient colors={['#004A82', '#0066B3', '#0077CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileGradient}>
            <View style={styles.profileDecor1} />
            <View style={styles.profileDecor2} />
            <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8}>
              <Avatar name={profile.fullName} size="xxlarge" showGradientRing />
              <View style={styles.editAvatarBadge}><Icon name="camera" size={14} color={Colors.white} /></View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{profile.fullName}</Text>
            {profile.bio ? <Text style={styles.profileBio}>"{profile.bio}"</Text> : null}
            
            <View style={styles.roleBadge}>
              <Icon name={isLecturer ? 'school' : 'badge-account-horizontal-outline'} size={14} color={Colors.white} />
              <Text style={styles.roleText}>{isLecturer ? 'Giảng viên' : 'Sinh viên'}</Text>
            </View>

            <Text style={styles.profileId}>{isLecturer ? `Mã GV: ${profile.lecturerId || 'Chưa cập nhật'}` : `MSSV: ${profile.studentId || 'Chưa cập nhật'}`}</Text>
            {profile.department && <Text style={styles.profileDepartment}>{profile.department}</Text>}
          </LinearGradient>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.statsBar, { transform: [{ scale: statsAnim }], opacity: statsAnim }]}>
            {MOCK_STATS.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                {idx > 0 && <View style={styles.statDivider} />}
                <View style={styles.statItem}>
                  <Icon name={stat.icon} size={20} color={Colors.primary} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity }}>
          {/* Extended Info Block */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Icon name="email-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{profile.email || 'Chưa cập nhật'}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Icon name="phone-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{profile.phone || 'Chưa cập nhật số điện thoại'}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Icon name="cake-variant-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{profile.dateOfBirth ? profile.dateOfBirth.split('-').reverse().join('/') : 'Chưa cập nhật ngày sinh'}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Icon name="gender-male-female" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{translateGender(profile.gender)}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Icon name="map-marker-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.infoText}>{profile.address || 'Chưa cập nhật địa chỉ'}</Text>
              </View>
            </View>
          </View>

          {isLecturer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trạng thái tư vấn</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusInfo}>
                  <View style={[styles.statusDot, { backgroundColor: lecturerStatus === 'available' ? Colors.success : Colors.danger }]} />
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>{lecturerStatus === 'available' ? 'Sẵn sàng tư vấn' : 'Đang bận'}</Text>
                    <Text style={styles.statusDescription}>{lecturerStatus === 'available' ? 'Sinh viên có thể liên hệ trực tiếp' : 'Tin nhắn sẽ tự động phản hồi'}</Text>
                  </View>
                </View>
                <Switch value={lecturerStatus === 'available'} onValueChange={handleStatusToggle} trackColor={{ false: Colors.dangerSoft, true: Colors.successSoft }} thumbColor={lecturerStatus === 'available' ? Colors.success : Colors.danger} />
              </View>
            </View>
          )}

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tài khoản</Text>
            <View style={styles.settingsCard}>
              <SettingItem icon="account-edit-outline" title="Chỉnh sửa hồ sơ" subtitle="Cập nhật toàn bộ thông tin cá nhân" onPress={openEditModal} />
              <View style={styles.settingDivider} />
              <SettingItem icon="lock-reset" iconColor="#FF9800" title="Đổi mật khẩu" onPress={() => {}} />
              <View style={styles.settingDivider} />
              <SettingItem icon="shield-check-outline" iconColor="#4CAF50" title="Bảo mật" subtitle="Xác thực 2 bước" onPress={() => {}} />
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <LinearGradient colors={[Colors.dangerLight, '#FFE0E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutGradient}>
              <Icon name="logout" size={20} color={Colors.danger} />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>IUH Connect © 2024</Text>
            <Text style={styles.footerSubtext}>Trường Đại học Công nghiệp TP.HCM</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Full Screen Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent={false} onRequestClose={() => setShowEditModal(false)}>
        <SafeAreaView style={styles.fullModalContainer}>
          {/* Modal Header */}
          <View style={styles.modalNavHeader}>
            <TouchableOpacity hitSlop={{top:15,bottom:15,left:15,right:15}} onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancelTextTop}>Hủy</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Sửa hồ sơ</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving}>
               {isSaving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.modalSaveTextTop}>Xong</Text>}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormContent}>
              
              {/* Photo Area */}
              <View style={styles.modalPhotoArea}>
                 <Avatar name={editForm.fullName} size="xlarge" />
                 <TouchableOpacity style={styles.changePhotoBtn}>
                    <Text style={styles.changePhotoText}>Thay đổi ảnh đại diện</Text>
                 </TouchableOpacity>
              </View>

              <View style={styles.formSectionGroup}>
                <Text style={styles.formSectionTitle}>THÔNG TIN CƠ BẢN</Text>
                <View style={styles.formGroupBackground}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Họ và tên</Text>
                    <TextInput style={styles.formInput} value={editForm.fullName} onChangeText={(text) => setEditForm(prev => ({...prev, fullName: text}))} placeholder="Nhập họ tên" />
                  </View>
                  <View style={styles.formDivider} />
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Tiểu sử (Bio)</Text>
                    <TextInput style={[styles.formInput, {height: 60}]} multiline value={editForm.bio} onChangeText={(text) => setEditForm(prev => ({...prev, bio: text}))} placeholder="Ví dụ: Sinh viên năng động..." />
                  </View>
                </View>
              </View>

              <View style={styles.formSectionGroup}>
                <Text style={styles.formSectionTitle}>LIÊN HỆ & ĐỊA CHỈ</Text>
                <View style={styles.formGroupBackground}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Email</Text>
                    <TextInput style={styles.formInput} value={editForm.email} onChangeText={(text) => setEditForm(prev => ({...prev, email: text}))} keyboardType="email-address" />
                  </View>
                  <View style={styles.formDivider} />
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Điện thoại</Text>
                    <TextInput style={styles.formInput} value={editForm.phone} onChangeText={(text) => setEditForm(prev => ({...prev, phone: text}))} keyboardType="phone-pad" />
                  </View>
                  <View style={styles.formDivider} />
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Địa chỉ</Text>
                    <TextInput style={styles.formInput} value={editForm.address} onChangeText={(text) => setEditForm(prev => ({...prev, address: text}))} placeholder="Thành phố, Tỉnh..." />
                  </View>
                </View>
              </View>

              <View style={styles.formSectionGroup}>
                <Text style={styles.formSectionTitle}>CÁ NHÂN HÓA</Text>
                <View style={styles.formGroupBackground}>
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Ngày sinh</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.datePickerText}>{formatDateLabel(editForm.dateOfBirth)}</Text>
                      <Icon name="calendar-month" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.formDivider} />
                  <View style={[styles.formRow, {flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12}]}>
                    <Text style={[styles.formLabel, {marginBottom: 8, width: '100%'}]}>Giới tính</Text>
                    <View style={styles.segmentedControl}>
                      <TouchableOpacity style={[styles.segmentBtn, editForm.gender === 'MALE' && styles.segmentActive]} onPress={() => setEditForm(prev => ({...prev, gender: 'MALE'}))}>
                        <Text style={[styles.segmentText, editForm.gender === 'MALE' && styles.segmentTextActive]}>Nam</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentBtn, editForm.gender === 'FEMALE' && styles.segmentActive]} onPress={() => setEditForm(prev => ({...prev, gender: 'FEMALE'}))}>
                        <Text style={[styles.segmentText, editForm.gender === 'FEMALE' && styles.segmentTextActive]}>Nữ</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentBtn, editForm.gender === 'OTHER' && styles.segmentActive]} onPress={() => setEditForm(prev => ({...prev, gender: 'OTHER'}))}>
                        <Text style={[styles.segmentText, editForm.gender === 'OTHER' && styles.segmentTextActive]}>Khác</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {isLecturer && (
                <View style={styles.formSectionGroup}>
                  <Text style={styles.formSectionTitle}>CÔNG TÁC</Text>
                  <View style={styles.formGroupBackground}>
                    <View style={styles.formRow}>
                      <Text style={styles.formLabel}>Khoa / Bộ môn</Text>
                      <TextInput style={styles.formInput} value={editForm.department} onChangeText={(text) => setEditForm(prev => ({...prev, department: text}))} placeholder="Khoa CNTT..." />
                    </View>
                  </View>
                </View>
              )}

              <View style={{height: 60}}/>
            </ScrollView>
          </KeyboardAvoidingView>
          
          <DatePicker
            modal
            open={showDatePicker}
            date={editForm.dateOfBirth}
            mode="date"
            title="Chọn ngày sinh"
            confirmText="Đồng ý"
            cancelText="Hủy"
            onConfirm={(date) => {
              setShowDatePicker(false);
              setEditForm(prev => ({...prev, dateOfBirth: date}));
            }}
            onCancel={() => setShowDatePicker(false)}
          />

        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Typography.h4, fontWeight: Typography.bold, color: Colors.white },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.huge },
  profileSection: { overflow: 'hidden' },
  profileGradient: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xxxl + 20, position: 'relative' },
  profileDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: -50, right: -30 },
  profileDecor2: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.03)', bottom: -20, left: -30 },
  avatarContainer: { position: 'relative', marginBottom: Spacing.md },
  editAvatarBadge: { position: 'absolute', bottom: 6, right: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.primary, ...Shadows.sm },
  profileName: { fontSize: Typography.h3, fontWeight: Typography.bold, color: Colors.white, marginBottom: 4, letterSpacing: 0.3 },
  profileBio: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.85)', marginBottom: Spacing.md, fontStyle: 'italic', paddingHorizontal: 20, textAlign: 'center'},
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 1, borderRadius: BorderRadius.round, gap: 6, marginBottom: Spacing.sm },
  roleText: { fontSize: Typography.caption, fontWeight: Typography.semiBold, color: Colors.white },
  profileId: { fontSize: Typography.caption, color: 'rgba(255,255,255,0.65)' },
  profileDepartment: { fontSize: Typography.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.white, marginHorizontal: Spacing.xl, marginTop: -Spacing.xxl, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, ...Shadows.md },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: Typography.h4, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.tiny, color: Colors.textSecondary, fontWeight: Typography.medium },
  statDivider: { width: 1, height: '60%', backgroundColor: Colors.borderLight, alignSelf: 'center' },
  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xxl },
  sectionTitle: { fontSize: Typography.caption, fontWeight: Typography.bold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', paddingVertical: Spacing.sm, ...Shadows.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  infoText: { flex: 1, marginLeft: Spacing.md, fontSize: Typography.body, color: Colors.textPrimary },
  infoDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.xl + 28 },
  statusCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadows.sm },
  statusInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  statusTextContainer: { flex: 1 },
  statusTitle: { fontSize: Typography.body, fontWeight: Typography.semiBold, color: Colors.textPrimary },
  statusDescription: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  settingsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.sm },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2 },
  settingIcon: { width: 38, height: 38, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: Typography.body, fontWeight: Typography.medium, color: Colors.textPrimary },
  settingSubtitle: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  settingDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 70 },
  logoutButton: { marginHorizontal: Spacing.xl, marginTop: Spacing.xxxl },
  logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.sm },
  logoutText: { fontSize: Typography.body, fontWeight: Typography.bold, color: Colors.danger },
  footer: { alignItems: 'center', marginTop: Spacing.xxl, paddingBottom: Spacing.lg },
  footerText: { fontSize: Typography.caption, color: Colors.textMuted, fontWeight: Typography.medium },
  footerSubtext: { fontSize: Typography.tiny, color: Colors.textMuted, marginTop: 2 },
  
  // NEW FULLSCREEN MODAL STYLES
  fullModalContainer: { flex: 1, backgroundColor: '#F2F2F7' },
  modalNavHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 15, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, ...Shadows.sm},
  modalCancelTextTop: { fontSize: Typography.body, color: Colors.primary },
  modalHeaderTitle: { fontSize: Typography.body, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalSaveTextTop: { fontSize: Typography.body, fontWeight: Typography.bold, color: Colors.primary },
  modalFormContent: { padding: Spacing.lg },
  modalPhotoArea: { alignItems: 'center', marginBottom: Spacing.xxl, marginTop: Spacing.md },
  changePhotoBtn: { marginTop: Spacing.md },
  changePhotoText: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: Typography.medium },
  formSectionGroup: { marginBottom: Spacing.xl },
  formSectionTitle: { fontSize: Typography.caption, color: Colors.textSecondary, marginLeft: Spacing.sm, marginBottom: Spacing.xs },
  formGroupBackground: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  formRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg },
  formLabel: { width: 100, fontSize: Typography.body, color: Colors.textPrimary, fontWeight: Typography.medium },
  formInput: { flex: 1, height: 48, fontSize: Typography.body, color: Colors.textSecondary },
  formDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.lg },
  datePickerBtn: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerText: { fontSize: Typography.body, color: Colors.textSecondary },
  segmentedControl: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 3, width: '100%' },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.sm },
  segmentActive: { backgroundColor: Colors.white, ...Shadows.sm },
  segmentText: { fontSize: Typography.bodySmall, color: Colors.textSecondary, fontWeight: Typography.medium },
  segmentTextActive: { color: Colors.primary, fontWeight: Typography.bold },
});

export default ProfileSettingsScreen;
