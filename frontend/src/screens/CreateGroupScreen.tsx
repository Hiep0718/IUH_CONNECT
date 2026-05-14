import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import { API_URL } from '../config/env';

interface CreateGroupScreenProps {
  navigation: any;
  route: any;
}

// Giả lập danh sách user (trong thực tế sẽ lấy từ API danh bạ)
const MOCK_USERS = [
  { id: 'u1', name: 'Văn An' },
  { id: 'u2', name: 'Thị Bình' },
  { id: 'u3', name: 'Hoàng Minh' },
  { id: 'u4', name: 'Thị Lan' },
  { id: 'u5', name: 'Minh Đức' },
  { id: 'u6', name: 'Giáo viên ABC' },
];

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation, route }) => {
  // Lấy currentUser từ context hoặc route params (tạm thời lấy từ global context nếu có, hoặc route)
  const currentUser = route.params?.currentUser || 'current_user'; 
  
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const filteredUsers = MOCK_USERS.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/chat/conversations/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: groupName.trim(),
          creatorId: currentUser,
          memberIds: [...selectedUsers, currentUser]
        })
      });

      if (response.ok) {
        Alert.alert('Thành công', 'Tạo nhóm thành công', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert('Lỗi', errorData.message || 'Không thể tạo nhóm');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Lỗi mạng khi tạo nhóm');
    } finally {
      setIsLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => {
    const isSelected = selectedUsers.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item.id)}
        activeOpacity={0.7}
      >
        <Avatar name={item.name} size="medium" />
        <Text style={styles.userName}>{item.name}</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
        <TouchableOpacity 
          onPress={handleCreateGroup} 
          style={styles.headerButton}
          disabled={isLoading || selectedUsers.length === 0 || !groupName.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[
              styles.createButtonText, 
              (selectedUsers.length === 0 || !groupName.trim()) && styles.createButtonDisabled
            ]}>
              Tạo
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Group Name Input */}
        <View style={styles.inputContainer}>
          <View style={styles.iconWrapper}>
            <Icon name="account-group" size={24} color={Colors.primary} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Đặt tên nhóm..."
            placeholderTextColor={Colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        {/* Search Users */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm thành viên..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.sectionTitle}>
          Đã chọn: {selectedUsers.length} thành viên
        </Text>

        {/* User List */}
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
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
  headerButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  createButtonText: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  createButtonDisabled: {
    color: Colors.textMuted,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  userItemSelected: {
    backgroundColor: Colors.primaryGhost,
  },
  userName: {
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

export default CreateGroupScreen;
