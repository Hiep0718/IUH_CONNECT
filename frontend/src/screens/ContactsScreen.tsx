import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  Modal,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';
import { API_URL } from '../config/env';

interface ContactsScreenProps {
  navigation: any;
  currentUser: string;
  token: string | null;
}

const ContactsScreen: React.FC<ContactsScreenProps> = ({ navigation, currentUser, token }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const [friends, setFriends] = useState<any[]>([]);
  const [pendings, setPendings] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');

  const loadContacts = useCallback(async () => {
    try {
      const pRes = await fetch(`${API_URL}/api/v1/contacts/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (pRes.ok) setPendings(await pRes.json());

      const fRes = await fetch(`${API_URL}/api/v1/contacts/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (fRes.ok) setFriends(await fRes.json());
    } catch (e) {
      console.log('Load contacts error', e);
    }
  }, [token]);

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    loadContacts();
  }, [loadContacts]);

  const handleSendRequest = async () => {
    if (!targetUsername) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/contacts/request?targetUsername=${targetUsername}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        Alert.alert('Thành công', 'Đã gửi lời mời kết bạn');
        setShowAddModal(false);
        setTargetUsername('');
      } else {
        const err = await res.text();
        Alert.alert('Lỗi', err);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ');
    }
  };

  const handleAcceptRequest = async (senderUsername: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/contacts/accept?senderUsername=${senderUsername}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        Alert.alert('Thành công', 'Đã thêm bạn');
        loadContacts();
      } else {
        Alert.alert('Lỗi', 'Không thể chấp nhận');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ');
    }
  };

  const startChat = (contact: any) => {
      navigation.navigate('Chat', {
          conversationId: `${currentUser}-${contact.username}`,
          recipientName: contact.fullName || contact.username,
          recipientId: contact.username,
          isOnline: true,
      });
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.contactItem}>
        <Avatar name={item.fullName || item.username} size="large" isOnline={true} showOnlineStatus />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.fullName || item.username}</Text>
          <Text style={styles.contactRole}>{item.role}</Text>
        </View>
        {item.status === 'PENDING' ? (
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRequest(item.username)}>
            <Text style={styles.acceptButtonText}>Xác nhận</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.chatButton} onPress={() => startChat(item)}>
            <Icon name="chat-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const data = [
    ...(pendings.length > 0 ? [{ isHeader: true, title: `Lời mời kết bạn (${pendings.length})`, color: Colors.warning }] : []),
    ...pendings,
    ...(friends.length > 0 ? [{ isHeader: true, title: `Danh bạ (${friends.length})`, color: Colors.primary }] : []),
    ...friends
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <Animated.View style={{ opacity: headerAnim }}>
        <LinearGradient colors={['#004A82', '#0066B3']} style={styles.header}>
          <Text style={styles.headerTitle}>Danh bạ</Text>
          <Text style={styles.headerSubtitle}>{friends.length} liên hệ</Text>
        </LinearGradient>
      </Animated.View>

      <FlatList
        data={data as any[]}
        renderItem={({ item }) => {
          if (item.isHeader) return <SectionHeader title={item.title} accentColor={item.color} />;
          return renderItem({ item });
        }}
        keyExtractor={(item, idx) => item.username || `header-${idx}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => setShowAddModal(true)}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#4CAF5015' }]}>
                <Icon name="account-plus" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.quickActionLabel}>Thêm bạn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#2196F315' }]}>
                <Icon name="account-group-outline" size={24} color="#2196F3" />
              </View>
              <Text style={styles.quickActionLabel}>Tạo nhóm</Text>
            </TouchableOpacity>
          </View>
        }
        ItemSeparatorComponent={({ leadingItem }) => !leadingItem.isHeader ? <View style={styles.separator} /> : null}
      />

      {/* Add Friend Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Thêm bạn bè</Text>
                  <TextInput
                      style={styles.modalInput}
                      placeholder="Nhập tên tài khoản (Username)"
                      value={targetUsername}
                      onChangeText={setTargetUsername}
                      autoCapitalize="none"
                  />
                  <View style={styles.modalActions}>
                      <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalButton}>
                          <Text style={styles.modalCancel}>Hủy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSendRequest} style={[styles.modalButton, styles.modalButtonPrimary]}>
                          <Text style={styles.modalSend}>Gửi lời mời</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  headerTitle: { fontSize: Typography.h2, fontWeight: Typography.extraBold, color: Colors.white },
  headerSubtitle: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  quickActions: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg, backgroundColor: Colors.white, marginBottom: Spacing.xs },
  quickActionItem: { alignItems: 'center', gap: Spacing.sm },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: Typography.medium },
  listContent: { paddingBottom: Spacing.huge },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.white },
  contactInfo: { flex: 1, marginLeft: Spacing.md },
  contactName: { fontSize: Typography.body, fontWeight: Typography.medium, color: Colors.textPrimary },
  contactRole: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  chatButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryGhost, justifyContent: 'center', alignItems: 'center' },
  acceptButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.primary },
  acceptButtonText: { color: Colors.white, fontSize: 13, fontWeight: 'bold' },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 88 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: Colors.white, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: Typography.h3, fontWeight: Typography.bold, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalButtonPrimary: { backgroundColor: Colors.primary },
  modalCancel: { color: Colors.textSecondary, fontWeight: 'bold' },
  modalSend: { color: Colors.white, fontWeight: 'bold' },
});

export default ContactsScreen;
