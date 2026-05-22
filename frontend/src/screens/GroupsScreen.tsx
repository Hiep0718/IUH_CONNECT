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
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';

import { API_URL } from '../config/env';
import { useWebSocket } from '../services/WebSocketProvider';
import { authFetch } from '../services/authService';

interface GroupsScreenProps {
  navigation: any;
  currentUser: string;
  token: string | null;
}

const GroupsScreen: React.FC<GroupsScreenProps> = ({ navigation, currentUser, token }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const [groups, setGroups] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadGroups = React.useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/user/${currentUser}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Groups fetch data:', JSON.stringify(data));
        const groupChats = data.filter((conv: any) => conv.type === 'GROUP' || conv.type === 'group');
        
        const mappedGroups = groupChats.map((g: any) => ({
          id: g.id,
          name: g.name,
          members: g.members?.length || 0,
          lastActive: 'Hoạt động gần đây',
          icon: g.avatar ? '🖼️' : '👥'
        }));
        setGroups(mappedGroups);
      } else {
        console.log('Failed to fetch groups, status:', res.status);
      }
    } catch (e) {
      console.log('Error loading groups', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, token]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadGroups();
  }, [loadGroups]);

  React.useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const { addListener, removeListener } = useWebSocket();

  React.useEffect(() => {
    const listenerId = 'groups-screen';
    const handler = (data: any) => {
      // Reload on new messages or contact events
      if (!data.type || data.type === 'CHAT_MESSAGE' || data.type === 'CONTACT_EVENT' || data.type === 'PRESENCE_UPDATE') {
        loadGroups();
      }
    };
    addListener(listenerId, handler);
    return () => removeListener(listenerId);
  }, [addListener, removeListener, loadGroups]);

  const renderGroup = ({ item, index }: { item: any; index: number }) => {
    const itemAnim = new Animated.Value(0);
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 60,
      useNativeDriver: true,
    }).start();

    return (
      <Animated.View style={{ opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }}>
        <TouchableOpacity 
          style={styles.groupItem} 
          activeOpacity={0.6}
          onPress={() => {
            navigation.navigate('Chat', {
              conversationId: item.id,
              recipientName: item.name,
              recipientId: item.id,
              isGroup: true
            });
          }}
        >
          <View style={styles.groupAvatar}>
            <Text style={styles.groupEmoji}>{item.icon}</Text>
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.groupMeta}>
              <Icon name="account-group" size={14} color={Colors.textMuted} />
              <Text style={styles.groupMembers}>{item.members} thành viên</Text>
              <Text style={styles.groupDot}>·</Text>
              <Text style={styles.groupLastActive}>{item.lastActive}</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      <Animated.View style={{ opacity: headerAnim }}>
        <LinearGradient colors={['#004A82', '#0066B3']} style={styles.header}>
          <Text style={styles.headerTitle}>Nhóm</Text>
          <Text style={styles.headerSubtitle}>{groups.length} nhóm</Text>
        </LinearGradient>
      </Animated.View>

      {/* Create Group Button */}
      <TouchableOpacity style={styles.createGroupButton} activeOpacity={0.7} onPress={() => navigation.navigate('CreateGroup', { currentUser })}>
        <LinearGradient
          colors={['#0077CC', '#004A82']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createGroupGradient}
        >
          <Icon name="account-multiple-plus" size={22} color={Colors.white} />
          <Text style={styles.createGroupText}>Tạo nhóm mới</Text>
        </LinearGradient>
      </TouchableOpacity>

      <FlatList
        data={groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0077CC']}
            tintColor="#0077CC"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  headerTitle: { fontSize: Typography.h2, fontWeight: Typography.extraBold, color: Colors.white },
  headerSubtitle: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  createGroupButton: { marginHorizontal: Spacing.xl, marginVertical: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  createGroupGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md + 2, gap: Spacing.sm },
  createGroupText: { fontSize: Typography.body, fontWeight: Typography.semiBold, color: Colors.white },
  listContent: { paddingBottom: Spacing.huge },
  groupItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, backgroundColor: Colors.white },
  groupAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.primaryGhost, justifyContent: 'center', alignItems: 'center' },
  groupEmoji: { fontSize: 24 },
  groupInfo: { flex: 1, marginLeft: Spacing.md },
  groupName: { fontSize: Typography.body, fontWeight: Typography.medium, color: Colors.textPrimary },
  groupMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  groupMembers: { fontSize: Typography.caption, color: Colors.textSecondary },
  groupDot: { fontSize: Typography.caption, color: Colors.textMuted },
  groupLastActive: { fontSize: Typography.caption, color: Colors.textMuted },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 84 },
});

export default GroupsScreen;
