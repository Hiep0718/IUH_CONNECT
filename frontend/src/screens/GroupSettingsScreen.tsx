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
  Switch,
  Share,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import { API_URL } from '../config/env';
import { authFetch } from '../services/authService';
import QRCode from 'react-native-qrcode-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadMedia } from '../services/mediaUploadService';

interface GroupSettingsScreenProps {
  navigation: any;
  route: any;
  currentUser: string;
  token: string | null;
}



const GroupSettingsScreen: React.FC<GroupSettingsScreenProps> = ({ navigation, route, currentUser, token }) => {
  const { conversationId, groupName, groupMemberAvatars = {}, groupMemberNames = {} } = route.params as any;
  const [currentGroupName, setCurrentGroupName] = useState(groupName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(groupName);

  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [members, setMembers] = useState<any[]>([]);

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNewUsers, setSelectedNewUsers] = useState<string[]>([]);
  const [allFriends, setAllFriends] = useState<any[]>([]);
  const [isFetchingFriends, setIsFetchingFriends] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [isMuteModalVisible, setIsMuteModalVisible] = useState(false);

  // Group Settings states
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowMemberInvite, setAllowMemberInvite] = useState(true);
  
  // QR Code states
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  // Pending members states
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [isPendingModalVisible, setIsPendingModalVisible] = useState(false);
  
  // Transfer leadership modal
  const [isTransferLeadershipModal, setIsTransferLeadershipModal] = useState(false);
  const [selectedNewLeader, setSelectedNewLeader] = useState<string | null>(null);

  useEffect(() => {
    fetchGroupDetails();
  }, []);

  const fetchGroupDetails = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentGroupName(data.name);
        setEditNameInput(data.name);
        setGroupAvatar(data.avatar || null);
        setRequireApproval(data.requireApproval || false);
        setAllowMemberInvite(data.allowMemberInvite !== false);
        setPendingMembers((data.pendingMembers || []).map((m: any) => ({
          id: m.userId, name: m.userId, role: m.role
        })));
        
        const mappedMembers = data.members.map((m: any) => ({
          id: m.userId,
          name: m.userId === currentUser ? 'Bạn' : (groupMemberNames[m.userId] || m.userId),
          avatar: groupMemberAvatars[m.userId],
          role: m.role
        }));
        setMembers(mappedMembers);
      }
      
      // Fetch settings
      const settingsRes = await authFetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setIsMuted(settingsData.muted);
        setMutedUntil(settingsData.mutedUntil);
      }
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      setMembers([
        { id: currentUser, name: currentUser, role: 'ADMIN' },
        { id: 'mock_user_1', name: 'Thành viên Test 1', role: 'MEMBER' }
      ]);
    }
  };

  const currentUserLower = currentUser?.toLowerCase() || '';
  const isLeader = members.find(m => m.id?.toLowerCase() === currentUserLower)?.role?.toUpperCase() === 'ADMIN';
  const isDeputy = members.find(m => m.id?.toLowerCase() === currentUserLower)?.role?.toUpperCase() === 'DEPUTY';
  const hasPrivilege = isLeader || isDeputy;

  const handleUploadGroupAvatar = async () => {
    if (!hasPrivilege) {
      Alert.alert('Quyền hạn', 'Chỉ Trưởng nhóm hoặc Phó nhóm mới có quyền đổi ảnh đại diện');
      return;
    }
    
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);

      const fileName = asset.fileName || `group_avatar_${Date.now()}.jpg`;
      const mimeType = asset.type || 'image/jpeg';
      
      const uploadResult = await uploadMedia(token!, {
        uri: asset.uri!,
        fileName: fileName,
        type: mimeType,
        fileSize: asset.fileSize,
      });

      const res = await authFetch(
        `${API_URL}/api/v1/chat/conversations/group/${conversationId}/avatar?requesterId=${currentUser}&avatarUrl=${encodeURIComponent(uploadResult.mediaUrl)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.ok) {
        setGroupAvatar(uploadResult.mediaUrl);
        Alert.alert('Thành công', 'Đã đổi ảnh đại diện nhóm!');
      } else {
        const errText = await res.text();
        Alert.alert('Lỗi', errText || 'Không thể cập nhật ảnh đại diện');
      }
    } catch (err) {
      console.log('Error uploading group avatar:', err);
      Alert.alert('Lỗi', 'Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
  const [selectedSuccessor, setSelectedSuccessor] = useState<string | null>(null);
  const [selectedMemberAction, setSelectedMemberAction] = useState<any>(null);

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

  const handleLeaveGroup = () => {
    // Nếu là Trưởng nhóm
    if (isLeader && members.length > 1) {
      const hasDeputy = members.some(m => m.role === 'DEPUTY');
      if (hasDeputy) {
        // Có Phó nhóm → tự động chuyển quyền, chỉ cần xác nhận
        Alert.alert(
          'Rời nhóm',
          'Quyền Trưởng nhóm sẽ được tự động chuyển cho Phó nhóm. Bạn có chắc chắn?',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Rời đi', style: 'destructive', onPress: () => performLeave() }
          ]
        );
      } else {
        // Không có Phó nhóm → mở modal chọn người kế nhiệm
        setSelectedSuccessor(null);
        setIsTransferModalVisible(true);
      }
    } else {
      // Thành viên/Phó nhóm hoặc nhóm chỉ có 1 người
      Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Rời đi', style: 'destructive', onPress: () => performLeave() }
      ]);
    }
  };

  const performLeave = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members/${currentUser}?requesterId=${currentUser}`, {
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
  };

  const handleLeaveAndTransfer = async () => {
    if (!selectedSuccessor) {
      Alert.alert('Thông báo', 'Vui lòng chọn một người để bổ nhiệm làm Trưởng nhóm mới.');
      return;
    }
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/leave-transfer?requesterId=${currentUser}&successorId=${selectedSuccessor}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsTransferModalVisible(false);
        navigation.navigate('MainTabs');
      } else {
        Alert.alert('Lỗi', 'Không thể chuyển quyền và rời nhóm');
      }
    } catch (error) {
      console.error('Leave and transfer error:', error);
    }
  };

  const handleSaveGroupName = async () => {
    if (editNameInput.trim().length === 0) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }
    
    try {
      const newName = editNameInput.trim();
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/name?requesterId=${currentUser}&newName=${encodeURIComponent(newName)}`, {
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

  // Fetch danh sách bạn bè thật từ API contacts
  const fetchFriends = async () => {
    setIsFetchingFriends(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/contacts/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllFriends(data.map((c: any) => ({
          id: c.username,
          name: c.fullName || c.username,
          avatar: c.avatarUrl,
        })));
      }
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setIsFetchingFriends(false);
    }
  };

  // Mở modal thêm thành viên - dùng chung cho cả 2 nút
  const openAddMemberModal = () => {
    setSelectedNewUsers([]);
    setSearchQuery('');
    fetchFriends();
    setIsAddingMember(true);
  };

  const handleAddMembers = async () => {
    if (selectedNewUsers.length === 0) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members?requesterId=${currentUser}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(selectedNewUsers)
      });
      
      if (res.ok) {
        fetchGroupDetails();
        setIsAddingMember(false);
        setSelectedNewUsers([]);
        setSearchQuery('');
        Alert.alert('Thành công', `Đã thêm ${selectedNewUsers.length} thành viên`);
      } else {
        const errorText = await res.text();
        Alert.alert('Lỗi', errorText || 'Không thể thêm thành viên');
      }
    } catch (error) {
      console.error('Add member error:', error);
      Alert.alert('Lỗi', 'Lỗi kết nối');
    }
  };

  // Lọc bạn bè chưa là thành viên nhóm + khớp tìm kiếm
  const availableUsersToAdd = allFriends.filter(
    u => !members.find(m => m.id === u.id) && u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChangeRole = (item: any) => {
    if (!isLeader || item.id === currentUser || item.role === 'ADMIN') return;

    const isCurrentlyDeputy = item.role === 'DEPUTY';
    const actionText = isCurrentlyDeputy ? 'Giáng chức xuống Thành viên' : 'Phong làm Phó nhóm';
    const newRole = isCurrentlyDeputy ? 'MEMBER' : 'DEPUTY';

    Alert.alert('Phân quyền', `Bạn muốn phân quyền cho ${item.name}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: actionText, onPress: async () => {
          try {
            const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members/${item.id}/role?requesterId=${currentUser}&newRole=${newRole}`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              fetchGroupDetails();
            } else {
              Alert.alert('Lỗi', 'Không thể thay đổi quyền');
            }
          } catch (error) {
            console.error('Role change error:', error);
          }
      }}
    ]);
  };

  const handleKickMember = (item: any) => {
    Alert.alert('Xóa thành viên', `Bạn muốn xóa ${item.name} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/members/${item.id}?requesterId=${currentUser}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              setMembers(members.filter(m => m.id !== item.id));
              setSelectedMemberAction(null);
            } else {
              Alert.alert('Lỗi', 'Không thể xóa thành viên');
            }
          } catch (error) {
            console.error('Kick member error:', error);
          }
        }
      }
    ]);
  };

  const renderMember = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.memberItem}
      activeOpacity={0.7}
      onPress={() => {
        if (item.id !== currentUser) {
          setSelectedMemberAction(item);
        }
      }}
    >
      <Avatar name={item.name} uri={item.avatar} size="medium" />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberRole}>{item.role === 'ADMIN' ? 'Trưởng nhóm' : item.role === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}</Text>
      </View>
      
      {/* Nút Xóa Thành Viên */}
      {item.id !== currentUser && (isLeader || (isDeputy && item.role === 'MEMBER')) && (
        <TouchableOpacity 
          style={styles.kickButton} 
          onPress={() => handleKickMember(item)}
        >
          <View style={{ backgroundColor: '#FFEBEE', padding: 8, borderRadius: 20 }}>
            <Icon name="account-remove-outline" size={20} color={Colors.danger} />
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderUserToAdd = ({ item }: { item: any }) => {
    const isSelected = selectedNewUsers.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.userAddRow, isSelected && styles.userAddRowSelected]}
        onPress={() => toggleUserSelection(item.id)}
        activeOpacity={0.7}
      >
        <Avatar name={item.name} uri={item.avatar} size="medium" />
        <View style={{flex: 1, marginLeft: Spacing.md}}>
          <Text style={styles.userAddName}>{item.name}</Text>
          <Text style={{fontSize: Typography.caption, color: Colors.textMuted, marginTop: 2}}>{item.id}</Text>
        </View>
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

      <ScrollView style={{flex: 1}} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Group Info Profile */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.groupAvatar}
            onPress={handleUploadGroupAvatar}
            disabled={!hasPrivilege || uploadingAvatar}
            activeOpacity={0.8}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : groupAvatar ? (
              <Image source={{ uri: groupAvatar }} style={styles.groupAvatarImage} />
            ) : (
              <Text style={styles.groupEmoji}>👥</Text>
            )}
            {hasPrivilege && !uploadingAvatar && (
              <View style={styles.changeAvatarBadge}>
                <Icon name="camera" size={12} color={Colors.white} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.groupNameRow}>
            <Text style={styles.groupName}>{currentGroupName}</Text>
            {isMuted && (
              <Icon name="bell-off-outline" size={18} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
            )}
            {hasPrivilege && (
              <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.editNameButton}>
                <Icon name="pencil" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.groupMeta}>{members.length} thành viên</Text>
        </View>

        {/* Actions Grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsGridScroll} contentContainerStyle={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            navigation.navigate('Chat', {
              conversationId: conversationId,
              recipientName: currentGroupName,
              recipientId: conversationId,
              isGroup: true
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
          <TouchableOpacity style={styles.actionItem} onPress={openAddMemberModal}>
            <View style={styles.actionIconWrapper}>
              <Icon name="account-plus-outline" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Thêm thành viên</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={async () => {
            try {
              const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/invite-link`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                const data = await res.json();
                setInviteLink(data.inviteLink);
              } else {
                setInviteLink(`iuhconnect://join-group/${conversationId}`);
              }
            } catch (e) {
              setInviteLink(`iuhconnect://join-group/${conversationId}`);
            }
            setIsQRModalVisible(true);
          }}>
            <View style={styles.actionIconWrapper}>
              <Icon name="qrcode" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.actionText}>Mã QR nhóm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => setIsMuteModalVisible(true)}>
            <View style={styles.actionIconWrapper}>
              <Icon name={isMuted ? "bell-off-outline" : "bell-outline"} size={24} color={isMuted ? Colors.primary : Colors.textPrimary} />
            </View>
            <Text style={[styles.actionText, isMuted && { color: Colors.primary }]}>
              {isMuted ? 'Đang tắt\nthông báo' : 'Tắt\nthông báo'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thành viên</Text>
          {members.map(item => (
            <View key={item.id}>
              {renderMember({ item })}
            </View>
          ))}
          <TouchableOpacity style={styles.addMemberRow} onPress={openAddMemberModal}>
            <View style={styles.addMemberIcon}>
              <Icon name="plus" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.addMemberText}>Thêm thành viên mới</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone (Đưa lại vào trong ScrollView) */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleLeaveGroup}>
            <Icon name="logout" size={24} color={Colors.danger} />
            <Text style={styles.dangerText}>Rời khỏi nhóm</Text>
          </TouchableOpacity>
          
          {isLeader && (
            <TouchableOpacity style={styles.dangerRow} onPress={() => {
              Alert.alert('Giải tán nhóm', 'Bạn có chắc chắn muốn giải tán nhóm này? Tất cả tin nhắn và thành viên sẽ bị xóa.', [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Giải tán', style: 'destructive', onPress: async () => {
                    try {
                      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}?requesterId=${currentUser}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        Alert.alert('Thành công', 'Nhóm đã được giải tán');
                        navigation.navigate('MainTabs');
                      } else {
                        Alert.alert('Lỗi', 'Không thể giải tán nhóm');
                      }
                    } catch (error) {
                      console.error('Disband group error:', error);
                      Alert.alert('Lỗi', 'Lỗi kết nối');
                    }
                  }
                }
              ]);
            }}>
              <Icon name="delete-outline" size={24} color={Colors.danger} />
              <Text style={styles.dangerText}>Giải tán nhóm</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Group Management Section - ADMIN only */}
        {isLeader && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quản lý nhóm</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="shield-check-outline" size={22} color={Colors.primary} />
                <View style={{marginLeft: Spacing.md, flex: 1}}>
                  <Text style={styles.settingLabel}>Phê duyệt thành viên mới</Text>
                  <Text style={styles.settingDesc}>Yêu cầu Admin/Phó nhóm duyệt trước khi vào nhóm</Text>
                </View>
              </View>
              <Switch
                value={requireApproval}
                onValueChange={async (val) => {
                  try {
                    const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/settings?requesterId=${currentUser}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ requireApproval: val })
                    });
                    if (res.ok) { setRequireApproval(val); }
                    else { Alert.alert('Lỗi', 'Không thể cập nhật'); }
                  } catch (e) { Alert.alert('Lỗi', 'Lỗi kết nối'); }
                }}
                trackColor={{ false: Colors.border, true: Colors.primarySurface }}
                thumbColor={requireApproval ? Colors.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Icon name="account-plus-outline" size={22} color={Colors.primary} />
                <View style={{marginLeft: Spacing.md, flex: 1}}>
                  <Text style={styles.settingLabel}>Cho phép thành viên mời người khác</Text>
                  <Text style={styles.settingDesc}>Tất cả thành viên có thể thêm người mới</Text>
                </View>
              </View>
              <Switch
                value={allowMemberInvite}
                onValueChange={async (val) => {
                  try {
                    const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/settings?requesterId=${currentUser}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ allowMemberInvite: val })
                    });
                    if (res.ok) { setAllowMemberInvite(val); }
                    else { Alert.alert('Lỗi', 'Không thể cập nhật'); }
                  } catch (e) { Alert.alert('Lỗi', 'Lỗi kết nối'); }
                }}
                trackColor={{ false: Colors.border, true: Colors.primarySurface }}
                thumbColor={allowMemberInvite ? Colors.primary : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity style={styles.dangerRow} onPress={() => {
              setSelectedNewLeader(null);
              setIsTransferLeadershipModal(true);
            }}>
              <Icon name="account-switch-outline" size={24} color="#FF9800" />
              <Text style={[styles.dangerText, { color: '#FF9800' }]}>Chuyển quyền Trưởng nhóm</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Members Section */}
        {hasPrivilege && pendingMembers.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.dangerRow} onPress={() => setIsPendingModalVisible(true)}>
              <Icon name="account-clock-outline" size={24} color="#FF9800" />
              <Text style={[styles.dangerText, { color: '#FF9800', flex: 1 }]}>Yêu cầu tham gia</Text>
              <View style={{backgroundColor: Colors.danger, borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6}}>
                <Text style={{color: Colors.white, fontSize: 12, fontWeight: '700'}}>{pendingMembers.length}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
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

          {isFetchingFriends ? (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40}}>
              <Text style={{color: Colors.textMuted}}>Đang tải danh sách bạn bè...</Text>
            </View>
          ) : (
            <FlatList
              data={availableUsersToAdd}
              renderItem={renderUserToAdd}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: Spacing.xxl }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 20, color: Colors.textMuted }}>
                  {allFriends.length === 0 ? 'Bạn chưa có bạn bè nào' : 'Tất cả bạn bè đều đã trong nhóm'}
                </Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Transfer Leadership Modal */}
      <Modal visible={isTransferModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.addMemberModalContainer}>
          <View style={styles.addMemberModalHeader}>
            <TouchableOpacity onPress={() => setIsTransferModalVisible(false)} style={styles.backButton}>
              <Icon name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chọn Trưởng nhóm mới</Text>
            <TouchableOpacity 
              onPress={handleLeaveAndTransfer} 
              style={styles.headerRightButton}
              disabled={!selectedSuccessor}
            >
              <Text style={[
                styles.headerRightButtonText, 
                !selectedSuccessor && styles.headerRightButtonTextDisabled
              ]}>
                Xác nhận
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md }}>
            <Text style={{ fontSize: Typography.bodySmall, color: Colors.textSecondary }}>
              Bạn cần bổ nhiệm một thành viên làm Trưởng nhóm mới trước khi rời khỏi nhóm.
            </Text>
          </View>
          
          <FlatList
            data={members.filter(m => m.id !== currentUser)}
            renderItem={({ item }) => {
              const isSelected = selectedSuccessor === item.id;
              return (
                <TouchableOpacity 
                  style={[styles.userAddRow, isSelected && styles.userAddRowSelected]}
                  onPress={() => setSelectedSuccessor(item.id)}
                  activeOpacity={0.7}
                >
                  <Avatar name={item.name} uri={item.avatar} size="medium" />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.userAddName}>{item.name}</Text>
                    <Text style={{ fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 }}>
                      {item.role === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Icon name="check" size={16} color={Colors.white} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
          />
        </SafeAreaView>
      </Modal>

      {/* Member Action Modal */}
      <Modal visible={!!selectedMemberAction} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedMemberAction(null)}>
          <View style={[styles.editNameModal, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ padding: Spacing.xl, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
              <Avatar name={selectedMemberAction?.name} uri={selectedMemberAction?.avatar} size="large" />
              <Text style={[styles.modalTitle, { marginTop: Spacing.md, marginBottom: 0 }]}>{selectedMemberAction?.name}</Text>
              <Text style={{ color: Colors.textSecondary, marginTop: 4 }}>
                {selectedMemberAction?.role === 'ADMIN' ? 'Trưởng nhóm' : selectedMemberAction?.role === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}
              </Text>
            </View>
            
            <View style={{ paddingVertical: Spacing.sm }}>
              {isLeader && selectedMemberAction?.role !== 'ADMIN' && (
                <TouchableOpacity style={styles.dangerRow} onPress={() => {
                  const item = selectedMemberAction;
                  setSelectedMemberAction(null);
                  handleChangeRole(item);
                }}>
                  <Icon name="account-cog-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.dangerText, { color: Colors.primary }]}>
                    {selectedMemberAction?.role === 'DEPUTY' ? 'Giáng chức xuống Thành viên' : 'Phong làm Phó nhóm'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {(isLeader || (isDeputy && selectedMemberAction?.role === 'MEMBER')) && (
                <TouchableOpacity style={styles.dangerRow} onPress={() => {
                  const item = selectedMemberAction;
                  setSelectedMemberAction(null);
                  handleKickMember(item);
                }}>
                  <Icon name="account-remove-outline" size={24} color={Colors.danger} />
                  <Text style={styles.dangerText}>Đuổi khỏi nhóm</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Mute Modal */}
      <Modal visible={isMuteModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMuteModalVisible(false)}>
          <View style={[styles.editNameModal, { padding: 0, overflow: 'hidden' }]}>
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

      {/* QR Code Modal */}
      <Modal visible={isQRModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsQRModalVisible(false)}>
          <View style={[styles.editNameModal, { alignItems: 'center' }]}>
            <Text style={styles.modalTitle}>Mã QR nhóm</Text>
            <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center', fontSize: Typography.bodySmall }}>
              Chia sẻ mã QR này để mời người khác tham gia nhóm "{currentGroupName}"
            </Text>
            <View style={{ padding: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg }}>
              <QRCode value={inviteLink || `iuhconnect://join-group/${conversationId}`} size={200} backgroundColor="white" color="#004A82" />
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: Typography.caption, marginBottom: Spacing.lg, textAlign: 'center' }}>
              {inviteLink || `iuhconnect://join-group/${conversationId}`}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: BorderRadius.round }}
              onPress={async () => {
                try {
                  await Share.share({ message: `Tham gia nhóm "${currentGroupName}" trên IUH Connect: ${inviteLink || `iuhconnect://join-group/${conversationId}`}` });
                } catch (e) { console.error(e); }
              }}
            >
              <Text style={{ color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.body }}>Chia sẻ link</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transfer Leadership Modal */}
      <Modal visible={isTransferLeadershipModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.addMemberModalContainer}>
          <View style={styles.addMemberModalHeader}>
            <TouchableOpacity onPress={() => setIsTransferLeadershipModal(false)} style={styles.backButton}>
              <Icon name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chuyển quyền Trưởng nhóm</Text>
            <TouchableOpacity
              onPress={async () => {
                if (!selectedNewLeader) return;
                Alert.alert('Xác nhận', 'Bạn sẽ trở thành Thành viên sau khi chuyển quyền. Tiếp tục?', [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Chuyển quyền', onPress: async () => {
                    try {
                      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/transfer?requesterId=${currentUser}&newAdminId=${selectedNewLeader}`, {
                        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        setIsTransferLeadershipModal(false);
                        fetchGroupDetails();
                        Alert.alert('Thành công', 'Đã chuyển quyền Trưởng nhóm');
                      } else { Alert.alert('Lỗi', 'Không thể chuyển quyền'); }
                    } catch (e) { Alert.alert('Lỗi', 'Lỗi kết nối'); }
                  }}
                ]);
              }}
              style={styles.headerRightButton}
              disabled={!selectedNewLeader}
            >
              <Text style={[styles.headerRightButtonText, !selectedNewLeader && styles.headerRightButtonTextDisabled]}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md }}>
            <Text style={{ fontSize: Typography.bodySmall, color: Colors.textSecondary }}>
              Chọn thành viên sẽ trở thành Trưởng nhóm mới. Bạn sẽ trở thành Thành viên thường.
            </Text>
          </View>
          <FlatList
            data={members.filter(m => m.id !== currentUser)}
            renderItem={({ item }) => {
              const isSelected = selectedNewLeader === item.id;
              return (
                <TouchableOpacity style={[styles.userAddRow, isSelected && styles.userAddRowSelected]} onPress={() => setSelectedNewLeader(item.id)} activeOpacity={0.7}>
                  <Avatar name={item.name} size="medium" />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.userAddName}>{item.name}</Text>
                    <Text style={{ fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 }}>
                      {item.role === 'DEPUTY' ? 'Phó nhóm' : 'Thành viên'}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Icon name="check" size={16} color={Colors.white} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
          />
        </SafeAreaView>
      </Modal>

      {/* Pending Members Modal */}
      <Modal visible={isPendingModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.addMemberModalContainer}>
          <View style={styles.addMemberModalHeader}>
            <TouchableOpacity onPress={() => setIsPendingModalVisible(false)} style={styles.backButton}>
              <Icon name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Yêu cầu tham gia ({pendingMembers.length})</Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={pendingMembers}
            renderItem={({ item }) => (
              <View style={[styles.memberItem, { paddingVertical: Spacing.md }]}>
                <Avatar name={item.name} size="medium" />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  <Text style={{ fontSize: Typography.caption, color: Colors.textMuted }}>Đang chờ duyệt</Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round, marginRight: Spacing.sm }}
                  onPress={async () => {
                    try {
                      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/approve/${item.id}?requesterId=${currentUser}`, {
                        method: 'POST', headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        setPendingMembers(prev => prev.filter(m => m.id !== item.id));
                        fetchGroupDetails();
                      } else { Alert.alert('Lỗi', 'Không thể duyệt'); }
                    } catch (e) { Alert.alert('Lỗi', 'Lỗi kết nối'); }
                  }}
                >
                  <Text style={{ color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.caption }}>Duyệt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#FFEBEE', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.round }}
                  onPress={async () => {
                    try {
                      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/group/${conversationId}/reject/${item.id}?requesterId=${currentUser}`, {
                        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        setPendingMembers(prev => prev.filter(m => m.id !== item.id));
                      } else { Alert.alert('Lỗi', 'Không thể từ chối'); }
                    } catch (e) { Alert.alert('Lỗi', 'Lỗi kết nối'); }
                  }}
                >
                  <Text style={{ color: Colors.danger, fontWeight: Typography.bold, fontSize: Typography.caption }}>Từ chối</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: Spacing.xxl }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 40, color: Colors.textMuted }}>Không có yêu cầu nào</Text>
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
    position: 'relative',
  },
  groupAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  changeAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
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
  actionsGridScroll: {
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
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
  footerSection: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg,
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default GroupSettingsScreen;
