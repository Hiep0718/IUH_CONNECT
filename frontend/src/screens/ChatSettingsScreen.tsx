import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import { API_URL } from '../config/env';
import { authFetch } from '../services/authService';

interface ChatSettingsScreenProps {
  navigation: any;
  route: any;
  currentUser: string;
  token: string | null;
}

const ChatSettingsScreen: React.FC<ChatSettingsScreenProps> = ({ navigation, route, currentUser, token }) => {
  const { conversationId, recipientId, recipientName } = route.params;
  
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [isMuteModalVisible, setIsMuteModalVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      if (!conversationId) return;
      const settingsRes = await authFetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setIsMuted(settingsData.muted);
        setMutedUntil(settingsData.mutedUntil);
      }
    } catch (error) {
      console.error('Failed to fetch chat settings:', error);
    }
  };

  const handleMuteOption = async (option: 'UNMUTE' | '1H' | '8H' | 'FOREVER') => {
    try {
      let url = `${API_URL}/api/v1/chat/settings/${currentUser}/${conversationId}/mute`;
      
      if (option === 'UNMUTE') {
        if (!isMuted) {
          setIsMuteModalVisible(false);
          return;
        }
      } else if (option === 'FOREVER') {
        url += `?mutedUntil=-1`;
      } else if (option === '1H') {
        url += `?mutedUntil=${Date.now() + 60 * 60 * 1000}`;
      } else if (option === '8H') {
        url += `?mutedUntil=${Date.now() + 8 * 60 * 60 * 1000}`;
      }
      
      const res = await authFetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const updated = await res.json();
        setIsMuted(updated.muted);
        setMutedUntil(updated.mutedUntil);
        setIsMuteModalVisible(false);
      } else {
        Alert.alert('Lỗi', 'Không thể cập nhật cài đặt');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Lỗi', 'Lỗi kết nối');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chọn</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={{flex: 1}} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* User Info Profile */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarWrapper} 
            activeOpacity={0.8}
            onPress={() => {
              // Show user profile info
              Alert.alert('Trang cá nhân', `Bạn đang xem trang cá nhân của ${recipientName}`);
            }}
          >
            <Avatar name={recipientName} size="xlarge" />
          </TouchableOpacity>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{recipientName}</Text>
            {isMuted && (
              <Icon name="bell-off-outline" size={18} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.userSubInfo}>{userInfo?.email || userInfo?.username || recipientId}</Text>
        </View>

        {/* Actions Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            navigation.navigate('Chat', {
              conversationId,
              recipientName,
              recipientId,
              isGroup: false
            });
          }}>
            <View style={styles.actionIconWrapper}>
              <Icon name="chat" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Nhắn tin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIconWrapper}>
              <Icon name="magnify" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Tìm tin nhắn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => setIsMuteModalVisible(true)}>
            <View style={styles.actionIconWrapper}>
              <Icon name={isMuted ? "bell-off-outline" : "bell-outline"} size={24} color={isMuted ? Colors.primary : Colors.textPrimary} />
            </View>
            <Text style={[styles.actionText, isMuted && { color: Colors.primary }]}>
              {isMuted ? 'Đang tắt' : 'Tắt thông báo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, { marginBottom: 100, marginTop: Spacing.md }]}>
          <TouchableOpacity style={styles.dangerRow} onPress={() => {
            Alert.alert('Chặn', `Bạn có chắc chắn muốn chặn ${recipientName}?`, [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Chặn', style: 'destructive', onPress: () => Alert.alert('Thông báo', 'Tính năng đang được cập nhật') }
            ]);
          }}>
            <Icon name="block-helper" size={24} color={Colors.danger} />
            <Text style={styles.dangerText}>Chặn người dùng</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerRow} onPress={() => {
            Alert.alert('Xóa cuộc trò chuyện', 'Tất cả tin nhắn sẽ bị xóa ở phía bạn.', [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Xóa', style: 'destructive', onPress: () => Alert.alert('Thông báo', 'Tính năng đang được cập nhật') }
            ]);
          }}>
            <Icon name="delete-outline" size={24} color={Colors.danger} />
            <Text style={styles.dangerText}>Xóa cuộc trò chuyện</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mute Modal */}
      <Modal visible={isMuteModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMuteModalVisible(false)}>
          <View style={[styles.modalContent, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Thông báo</Text>
            </View>
            
            <View style={{ paddingVertical: Spacing.sm }}>
              {isMuted ? (
                <TouchableOpacity style={styles.dangerRow} onPress={() => handleMuteOption('UNMUTE')}>
                  <Icon name="bell-ring-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.dangerText, { color: Colors.primary }]}>Bật lại thông báo</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.dangerRow} onPress={() => handleMuteOption('1H')}>
                    <Icon name="clock-outline" size={24} color={Colors.textPrimary} />
                    <Text style={[styles.dangerText, { color: Colors.textPrimary }]}>Tắt trong 1 giờ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerRow} onPress={() => handleMuteOption('8H')}>
                    <Icon name="clock-outline" size={24} color={Colors.textPrimary} />
                    <Text style={[styles.dangerText, { color: Colors.textPrimary }]}>Tắt trong 8 giờ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerRow} onPress={() => handleMuteOption('FOREVER')}>
                    <Icon name="bell-off-outline" size={24} color={Colors.textPrimary} />
                    <Text style={[styles.dangerText, { color: Colors.textPrimary }]}>Tắt đến khi tôi mở lại</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarWrapper: {
    marginBottom: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  userSubInfo: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
  },
  actionItem: {
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    width: 80,
  },
  actionIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionText: {
    fontSize: Typography.tiny,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  dangerText: {
    fontSize: Typography.body,
    color: Colors.danger,
    marginLeft: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  modalTitle: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
});

export default ChatSettingsScreen;
