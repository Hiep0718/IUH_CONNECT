import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Animated,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';

interface ContactsScreenProps {
  navigation: any;
  currentUser: string;
}

const MOCK_CONTACTS = [
  { id: '1', name: 'TS. Nguyễn Văn An', role: 'Giảng viên', dept: 'Khoa CNTT', isOnline: true },
  { id: '2', name: 'ThS. Trần Thị Bình', role: 'Giảng viên', dept: 'Khoa CNTT', isOnline: true },
  { id: '3', name: 'Lê Hoàng Minh', role: 'Sinh viên', dept: '20DHTH01', isOnline: true },
  { id: '4', name: 'Phạm Thị Lan', role: 'Sinh viên', dept: '20DHTH02', isOnline: false },
  { id: '5', name: 'TS. Hoàng Minh Đức', role: 'Giảng viên', dept: 'Khoa CNTT', isOnline: false },
  { id: '6', name: 'Nguyễn Thị Thu', role: 'Sinh viên', dept: '20DHTH01', isOnline: false },
  { id: '7', name: 'Trần Văn Nam', role: 'Sinh viên', dept: '21DHTH03', isOnline: false },
  { id: '8', name: 'PGS.TS Lê Văn Cường', role: 'Giảng viên', dept: 'Khoa CNTT', isOnline: true },
];

const ContactsScreen: React.FC<ContactsScreenProps> = ({ navigation, currentUser }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const lecturers = MOCK_CONTACTS.filter(c => c.role === 'Giảng viên');
  const students = MOCK_CONTACTS.filter(c => c.role === 'Sinh viên');

  const renderContact = ({ item, index }: { item: any; index: number }) => {
    const itemAnim = new Animated.Value(0);
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();

    return (
      <Animated.View style={{ opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <TouchableOpacity style={styles.contactItem} activeOpacity={0.6}>
          <Avatar name={item.name} size="large" isOnline={item.isOnline} showOnlineStatus />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            <Text style={styles.contactRole}>{item.dept}</Text>
          </View>
          <TouchableOpacity style={styles.chatButton}>
            <Icon name="chat-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <Animated.View style={{ opacity: headerAnim }}>
        <LinearGradient colors={['#004A82', '#0066B3']} style={styles.header}>
          <Text style={styles.headerTitle}>Danh bạ</Text>
          <Text style={styles.headerSubtitle}>{MOCK_CONTACTS.length} liên hệ</Text>
        </LinearGradient>
      </Animated.View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm liên hệ..."
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      <FlatList
        data={[...lecturers, ...students]}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {[
                { icon: 'account-plus', label: 'Thêm bạn', color: '#4CAF50' },
                { icon: 'account-group-outline', label: 'Tạo nhóm', color: '#2196F3' },
                { icon: 'qrcode-scan', label: 'Mã QR', color: '#FF9800' },
              ].map((action, i) => (
                <TouchableOpacity key={i} style={styles.quickActionItem} activeOpacity={0.7}>
                  <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                    <Icon name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <SectionHeader title={`Giảng viên (${lecturers.length})`} accentColor="#FF9800" />
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        stickyHeaderIndices={[]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  headerTitle: { fontSize: Typography.h2, fontWeight: Typography.extraBold, color: Colors.white },
  headerSubtitle: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchContainer: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.white },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, height: 42 },
  searchInput: { flex: 1, fontSize: Typography.bodySmall, color: Colors.textPrimary, marginLeft: Spacing.sm, padding: 0 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg, backgroundColor: Colors.white, marginBottom: Spacing.xs },
  quickActionItem: { alignItems: 'center', gap: Spacing.sm },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: Typography.medium },
  listContent: { paddingBottom: Spacing.huge },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.white },
  contactInfo: { flex: 1, marginLeft: Spacing.md },
  contactName: { fontSize: Typography.body, fontWeight: Typography.medium, color: Colors.textPrimary },
  contactRole: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  chatButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryGhost, justifyContent: 'center', alignItems: 'center' },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 88 },
});

export default ContactsScreen;
