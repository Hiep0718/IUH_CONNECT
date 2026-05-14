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
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import { API_URL } from '../config/env';

interface GroupSettingsScreenProps {
  navigation: any;
  route: any;
  currentUser: string;
  token: string | null;
}

// Giả lập danh sách user để thêm vào nhóm
const MOCK_USERS_TO_ADD = [
  { id: 'u2', name: 'Thị Bình' },
  { id: 'u3', name: 'Hoàng Minh' },
  { id: 'u4', name: 'Thị Lan' },
  { id: 'u5', name: 'Minh Đức' },
  { id: 'u6', name: 'Giáo viên ABC' },
];

const GroupSettingsScreen: React.FC<GroupSettingsScreenProps> = ({ navigation, route, currentUser, token }) => {
  const { conversationId, groupName } = route.params;
  const [currentGroupName, setCurrentGroupName] = useState(groupName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(groupName);

  const [members, setMembers] = useState<any[]>([]);

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNewUsers, setSelectedNewUsers] = useState<string[]>([]);

  useEffect(() => {
    fetchGroupDetails();
  }, []);

  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentGroupName(data.name);
        setEditNameInput(data.name);
        
        // Cập nhật danh sách thành viên với tên (tạm thời lấy userId làm tên, nếu có user-service thì gọi thêm)
        const mappedMembers = data.members.map((m: any) => ({
          id: m.userId,
          name: m.userId === currentUser ? 'Bạn' : m.userId,
          role: m.role
        }));
        setMembers(mappedMembers);
      } else {
        // Fallback nếu API lỗi (chưa khởi động lại backend)
        console.log('API returned not ok');
        setMembers([
          { id: currentUser, name: currentUser, role: 'ADMIN' },
          { id: 'mock_user_1', name: 'Thành viên Test 1', role: 'MEMBER' }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      // Fallback nếu API lỗi mạng
      setMembers([
        { id: currentUser, name: currentUser, role: 'ADMIN' },
        { id: 'mock_user_1', name: 'Thành viên Test 1', role: 'MEMBER' }
      ]);
    }
  };

  const isAdmin = members.find(m => m.id === currentUser)?.role === 'ADMIN';

  const handleLeaveGroup = () => {
    Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Rời đi', style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members/${currentUser}?requesterId=${currentUser}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              navigation.navigate('MainTabs');
            } else {
              Alert.alert('Lỗi', 'Không thể rời nhóm');
            }
          } catch (error) {
            console.error('Leave group error:', error);
          }
      }}
    ]);
  };

  const handleSaveGroupName = async () => {
    if (editNameInput.trim().length === 0) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }
    
    try {
      const newName = editNameInput.trim();
      const res = await fetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/name?requesterId=${currentUser}&newName=${encodeURIComponent(newName)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setCurrentGroupName(newName);
        setIsEditingName(false);
      } else {
        Alert.alert('Lỗi', 'Không thể đổi tên nhóm');
      }
    } catch (error) {
      console.error('Update name error:', error);
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (selectedNewUsers.includes(userId)) {
      setSelectedNewUsers(selectedNewUsers.filter(id => id !== userId));
    } else {
      setSelectedNewUsers([...selectedNewUsers, userId]);
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewUsers.length === 0) return;
    
    try {
      const res = await fetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members?requesterId=${currentUser}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(selectedNewUsers)
      });
      
      if (res.ok) {
        // Cập nhật lại danh sách sau khi thêm
        fetchGroupDetails();
        setIsAddingMember(false);
        setSelectedNewUsers([]);
        setSearchQuery('');
      } else {
        Alert.alert('Lỗi', 'Không thể thêm thành viên');
      }
    } catch (error) {
      console.error('Add member error:', error);
    }
  };

  const availableUsersToAdd = MOCK_USERS_TO_ADD.filter(
    u => !members.find(m => m.id === u.id) && u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMember = ({ item }: { item: any }) => (
    <View style={styles.memberItem}>
      <Avatar name={item.name} size="medium" />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberRole}>{item.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}</Text>
      </View>
      {isAdmin && item.id !== currentUser && (
        <TouchableOpacity style={styles.kickButton} onPress={() => {
          Alert.alert('Xóa thành viên', `Bạn muốn xóa ${item.name} khỏi nhóm?`, [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa', style: 'destructive', onPress: async () => {
                try {
                  const res = await fetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members/${item.id}?requesterId=${currentUser}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) {
                    setMembers(members.filter(m => m.id !== item.id));
                  } else {
                    Alert.alert('Lỗi', 'Không thể xóa thành viên');
                  }
                } catch (error) {
                  console.error('Kick member error:', error);
                }
              }
            }
          ]);
        }}>
          <Icon name="account-remove-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUserToAdd = ({ item }: { item: any }) => {
    const isSelected = selectedNewUsers.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.userAddRow, isSelected && styles.userAddRowSelected]}
        onPress={() => toggleUserSelection(item.id)}
        activeOpacity={0.7}
      >
        <Avatar name={item.name} size="medium" />
        <Text style={styles.userAddName}>{item.name}</Text>
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Icon name="check" size={16} color={Colors.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chọn nhóm</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Group Info Profile */}
        <View style={styles.profileSection}>
          <View style={styles.groupAvatar}>
            <Text style={styles.groupEmoji}>👥</Text>
          </View>
          <View style={styles.groupNameRow}>
            <Text style={styles.groupName}>{currentGroupName}</Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.editNameButton}>
                <Icon name="pencil" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.groupMeta}>{members.length} thành viên</Text>
        </View>

        {/* Actions Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIconWrapper}>
              <Icon name="magnify" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Tìm tin nhắn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIconWrapper}>
              <Icon name="account-plus-outline" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Thêm thành viên</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIconWrapper}>
              <Icon name="bell-outline" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Tắt thông báo</Text>
          </TouchableOpacity>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thành viên</Text>
          {members.map(item => (
            <View key={item.id}>
              {renderMember({ item })}
            </View>
          ))}
          {isAdmin && (
            <TouchableOpacity style={styles.addMemberRow} onPress={() => setIsAddingMember(true)}>
              <View style={styles.addMemberIcon}>
                <Icon name="plus" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.addMemberText}>Thêm thành viên mới</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleLeaveGroup}>
            <Icon name="logout" size={24} color={Colors.error} />
            <Text style={styles.dangerText}>Rời khỏi nhóm</Text>
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity style={styles.dangerRow}>
              <Icon name="delete-outline" size={24} color={Colors.error} />
              <Text style={styles.dangerText}>Giải tán nhóm</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={isEditingName} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.editNameModal}>
            <Text style={styles.modalTitle}>Đổi tên nhóm</Text>
            <TextInput
              style={styles.editNameInput}
              value={editNameInput}
              onChangeText={setEditNameInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.modalButton}>
                <Text style={styles.modalButtonCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveGroupName} style={styles.modalButton}>
                <Text style={styles.modalButtonSave}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={isAddingMember} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.addMemberModalContainer}>
          <View style={styles.addMemberModalHeader}>
            <TouchableOpacity onPress={() => setIsAddingMember(false)} style={styles.backButton}>
              <Icon name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thêm thành viên</Text>
            <TouchableOpacity 
              onPress={handleAddMembers} 
              style={styles.headerRightButton}
              disabled={selectedNewUsers.length === 0}
            >
              <Text style={[
                styles.headerRightButtonText, 
                selectedNewUsers.length === 0 && styles.headerRightButtonTextDisabled
              ]}>
                Thêm ({selectedNewUsers.length})
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Icon name="magnify" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={availableUsersToAdd}
            renderItem={renderUserToAdd}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMuted }}>
                Không tìm thấy người dùng phù hợp
              </Text>
            }
          />
        </SafeAreaView>
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
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  groupEmoji: {
    fontSize: 40,
  },
  groupName: {
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  memberInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  memberName: {
    fontSize: Typography.body,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  memberRole: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  kickButton: {
    padding: Spacing.sm,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  addMemberIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMemberText: {
    fontSize: Typography.body,
    color: Colors.primary,
    fontWeight: Typography.medium,
    marginLeft: Spacing.md,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  dangerText: {
    fontSize: Typography.body,
    color: Colors.error,
    fontWeight: Typography.medium,
    marginLeft: Spacing.md,
  },
  // Update Group Name Styles
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  editNameButton: {
    marginLeft: Spacing.sm,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editNameModal: {
    width: '80%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  modalTitle: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  editNameInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  modalButtonCancel: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  modalButtonSave: {
    fontSize: Typography.body,
    color: Colors.primary,
    fontWeight: Typography.bold,
  },
  // Add Member Modal
  addMemberModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  addMemberModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  headerRightButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  headerRightButtonText: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  headerRightButtonTextDisabled: {
    color: Colors.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
  },
  userAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.white,
  },
  userAddRowSelected: {
    backgroundColor: Colors.primaryGhost,
  },
  userAddName: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});

export default GroupSettingsScreen;
