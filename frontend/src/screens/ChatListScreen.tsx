import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { API_URL } from '../config/env';
import { useWebSocket } from '../services/WebSocketProvider';
import { authFetch } from '../services/authService';
import { Colors, Shadows, Spacing, Typography } from '../theme/theme';
import type { Conversation } from '../types/types';

interface ChatListScreenProps {
  navigation: any;
  currentUser: string;
  token: string | null;
  onLogout: () => void;
}

interface PresenceInfo {
  status: string;
  lastSeen: number;
}

// Remove hardcoded preview users

const formatTimeAgo = (date: Date) => {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const buildDirectConversationKey = (currentUser: string, otherUserId?: string | null) => {
  if (!otherUserId) {
    return null;
  }

  return [currentUser, otherUserId].sort().join('::');
};

const resolveOtherUserId = (msg: any, currentUser: string) => {
  if (msg.senderId === currentUser && msg.receiverId) {
    return msg.receiverId;
  }

  if (msg.receiverId === currentUser && msg.senderId) {
    return msg.senderId;
  }

  const conversationId = typeof msg.conversationId === 'string' ? msg.conversationId : '';
  const parts = conversationId.split('-').filter(Boolean);
  if (parts.length === 2) {
    return parts[0] === currentUser ? parts[1] : parts[0];
  }

  return msg.senderId || msg.receiverId || null;
};

const formatCallPreview = (content?: string) => {
  if (!content) {
    return '📞 Cuộc gọi';
  }

  try {
    const callInfo = JSON.parse(content);
    switch (callInfo.callStatus) {
      case 'missed':
        return '📞 Cuộc gọi nhỡ';
      case 'rejected':
        return '📞 Cuộc gọi bị từ chối';
      case 'cancelled':
        return '📞 Cuộc gọi bị huỷ';
      default:
        if (callInfo.duration > 0) {
          const mins = Math.floor(callInfo.duration / 60);
          const secs = callInfo.duration % 60;
          const durationStr = mins > 0 ? `${mins}p ${secs}s` : `${secs}s`;
          return `📞 Cuộc gọi kết thúc (${durationStr})`;
        }
        return '📞 Cuộc gọi video';
    }
  } catch {
    return '📞 Cuộc gọi video';
  }
};

const mapConversationPreview = (
  msg: any,
  currentUser: string,
  groupMap: Record<string, any>,
  settingsMap: Record<string, any>,
  contactMap: Record<string, {name: string, avatar?: string}>
): Conversation | null => {
  const groupInfo = groupMap[msg.conversationId];
  const settings = settingsMap[msg.conversationId] || {};

  if (groupInfo) {
    let preview = msg.content;
    if (msg.messageType === 'IMAGE') preview = '📷 Hình ảnh';
    if (msg.messageType === 'VIDEO') preview = '🎬 Video';
    if (msg.messageType === 'FILE') preview = `📎 ${msg.fileName || 'Tệp đính kèm'}`;
    if (msg.messageType === 'STICKER') preview = '😄 Sticker';
    if (msg.messageType === 'AUDIO') preview = '🎤 Tin nhắn thoại';
    if (msg.messageType === 'CALL') preview = formatCallPreview(msg.content);

    return {
      id: msg.conversationId,
      name: groupInfo.name || 'Nhóm',
      targetUserId: msg.conversationId,
      avatar: undefined,
      isGroup: true,
      participants: groupInfo.members?.map((m: any) => m.userId) || [],
      lastMessage: {
        text: preview,
        timestamp: new Date(msg.timestamp),
        senderId: msg.senderId,
      },
      unreadCount: msg.unreadCount !== undefined ? msg.unreadCount : (msg.unread_count || 0),
      isOnline: false,
      isPinned: settings.pinned || false,
      isMuted: settings.muted || false,
      isArchived: settings.archived || false,
    };
  }

  const otherUserId = resolveOtherUserId(msg, currentUser);
  console.log('MSG UNREAD CHECK:', otherUserId, msg.unreadCount, msg.unread_count, Object.keys(msg));
  if (!otherUserId || otherUserId === currentUser) {
    return null;
  }

  let preview = msg.content;
  if (msg.messageType === 'IMAGE') preview = '📷 Hình ảnh';
  if (msg.messageType === 'VIDEO') preview = '🎬 Video';
  if (msg.messageType === 'FILE') preview = `📎 ${msg.fileName || 'Tệp đính kèm'}`;
  if (msg.messageType === 'STICKER') preview = '😄 Sticker';
  if (msg.messageType === 'AUDIO') preview = '🎤 Tin nhắn thoại';
  if (msg.messageType === 'CALL') preview = formatCallPreview(msg.content);

  const contactInfo = contactMap[otherUserId] || { name: otherUserId };

  return {
    id: msg.conversationId,
    name: contactInfo.name,
    targetUserId: otherUserId,
    avatar: contactInfo.avatar,
    isGroup: false,
    participants: [],
    lastMessage: {
      text: preview,
      timestamp: new Date(msg.timestamp),
      senderId: msg.senderId,
    },
    unreadCount: msg.unreadCount !== undefined ? msg.unreadCount : (msg.unread_count || 0),
    isOnline: false,
    isPinned: settings.pinned || false,
    isMuted: settings.muted || false,
    isArchived: settings.archived || false,
  };
};

const sanitizeConversations = (items: Conversation[], currentUser: string) => {
  const seen = new Set<string>();

  return items.filter(item => {
    if (!item.id || !item.targetUserId || item.targetUserId === currentUser) {
      return false;
    }

    const dedupeKey = item.isGroup
      ? item.id
      : buildDirectConversationKey(currentUser, item.targetUserId);

    if (!dedupeKey || seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
};

// ── Mock data cho 5 users để test ──
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'mock-conv-1',
    name: 'Nguyễn Văn An',
    targetUserId: 'nguyen-van-an',
    isGroup: false,
    participants: [],
    lastMessage: { text: 'Anh ơi, bài tập tuần này nộp khi nào vậy?', timestamp: new Date(Date.now() - 120000), senderId: 'nguyen-van-an' },
    unreadCount: 3,
    isOnline: true,
    isPinned: true,
    isMuted: false,
    isArchived: false,
  },
  {
    id: 'mock-conv-2',
    name: 'Trần Thị Bình',
    targetUserId: 'tran-thi-binh',
    isGroup: false,
    participants: [],
    lastMessage: { text: 'Em đã gửi file báo cáo rồi ạ 📎', timestamp: new Date(Date.now() - 3600000), senderId: 'tran-thi-binh' },
    unreadCount: 1,
    isOnline: true,
    isPinned: false,
    isMuted: true,
    isArchived: false,
  },
  {
    id: 'mock-conv-3',
    name: 'Nhóm Đồ án KTPM',
    targetUserId: 'nhom-do-an-ktpm',
    isGroup: true,
    participants: [],
    lastMessage: { text: 'Cuối tuần họp nhóm nhé mọi người!', timestamp: new Date(Date.now() - 7200000), senderId: 'le-van-cuong' },
    unreadCount: 5,
    isOnline: false,
    isPinned: true,
    isMuted: false,
    isArchived: false,
  },
  {
    id: 'mock-conv-4',
    name: 'Lê Văn Cường',
    targetUserId: 'le-van-cuong',
    isGroup: false,
    participants: [],
    lastMessage: { text: 'Ok bạn, mình sẽ làm phần backend', timestamp: new Date(Date.now() - 86400000), senderId: 'le-van-cuong' },
    unreadCount: 0,
    isOnline: false,
    isPinned: false,
    isMuted: false,
    isArchived: false,
  },
  {
    id: 'mock-conv-5',
    name: 'Phạm Thị Dung',
    targetUserId: 'pham-thi-dung',
    isGroup: false,
    participants: [],
    lastMessage: { text: 'Cảm ơn bạn đã giúp đỡ! 🙏', timestamp: new Date(Date.now() - 172800000), senderId: 'pham-thi-dung' },
    unreadCount: 0,
    isOnline: false,
    isPinned: false,
    isMuted: false,
    isArchived: true,
  },
];

const ChatListScreen: React.FC<ChatListScreenProps> = ({
  navigation,
  currentUser,
  token,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [longPressItem, setLongPressItem] = useState<Conversation | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const presenceAvailableRef = useRef(true);

  const { addListener, removeListener } = useWebSocket();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(listAnim, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerAnim, listAnim]);

  const loadConversations = useCallback(async () => {
    try {
      let groupMap: Record<string, any> = {};
      try {
        const groupsRes = await authFetch(`${API_URL}/api/v1/chat/conversations/user/${currentUser}`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        if (groupsRes.ok) {
           const convs = await groupsRes.json();
           convs.forEach((c: any) => {
             if (c.type === 'GROUP' || c.type === 'group') {
               groupMap[c.id] = c;
             }
           });
        }
      } catch (e) {
         console.log('Error fetching user groups in ChatList', e);
      }

      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/${currentUser}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        return;
      }

      let settingsMap: Record<string, any> = {};
      try {
        const settingsRes = await authFetch(`${API_URL}/api/v1/chat/settings/${currentUser}`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        if (settingsRes.ok) {
           const settings = await settingsRes.json();
           settings.forEach((s: any) => {
             settingsMap[s.conversationId] = {
               pinned: s.pinned || false,
               muted: s.muted || false,
               archived: s.archived || false,
             };
           });
        }
      } catch (e) {
         console.log('Error fetching user settings in ChatList', e);
      }

      let contactMap: Record<string, {name: string, avatar?: string}> = {};
      try {
        const contactsRes = await authFetch(`${API_URL}/api/v1/contacts/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (contactsRes.ok) {
          const contacts = await contactsRes.json();
          contacts.forEach((c: any) => {
            contactMap[c.username] = {
              name: c.fullName || c.username,
              avatar: c.avatarUrl
            };
          });
        }
      } catch (e) {
        console.log('Error fetching contacts in ChatList', e);
      }

      const data = await res.json();
      const mapped = data
        .map((msg: any) => mapConversationPreview(msg, currentUser, groupMap, settingsMap, contactMap))
        .filter(Boolean) as Conversation[];
      const sanitized = sanitizeConversations(mapped, currentUser);

      const userIds = [
        ...new Set(sanitized.filter(item => !item.isGroup).map(item => item.targetUserId).filter(Boolean)),
      ] as string[];

      if (userIds.length > 0 && presenceAvailableRef.current) {
        try {
          const presenceRes = await authFetch(`${API_URL}/api/v1/presence/bulk`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(userIds),
          });

          if (presenceRes.ok) {
            const presenceMap: Record<string, PresenceInfo> = await presenceRes.json();
            sanitized.forEach(item => {
              const presence = presenceMap[item.targetUserId || ''];
              if (presence) {
                item.isOnline = presence.status === 'ONLINE';
              }
            });
          } else {
            presenceAvailableRef.current = false;
          }
        } catch {
          presenceAvailableRef.current = false;
        }
      }

      // Tách archived conversations ra riêng
      const archived = sanitized.filter(c => c.isArchived);
      const active = sanitized.filter(c => !c.isArchived);

      // Sort: pinned lên đầu, còn lại theo thời gian
      active.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.lastMessage?.timestamp?.getTime() || 0;
        const timeB = b.lastMessage?.timestamp?.getTime() || 0;
        return timeB - timeA;
      });

      setArchivedConversations(archived);
      setConversations(active);
    } catch (error) {
      console.log('Error loading conversations', error);
      // Fallback: clear or show error, but do NOT show mock data
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    const listenerId = 'chat-list-screen';
    const handler = (data: any) => {
      if (data?.type === 'CALL_SIGNAL') {
        return;
      }

      if (data?.type === 'PRESENCE_UPDATE') {
        const { userId, status } = data;
        setConversations(prev =>
          prev.map(conv =>
            conv.targetUserId === userId
              ? { ...conv, isOnline: status === 'ONLINE' }
              : conv,
          ),
        );
        return;
      }

      loadConversations();
    };

    addListener(listenerId, handler);
    return () => removeListener(listenerId);
  }, [addListener, loadConversations, removeListener]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  const filteredConversations = useMemo(() => {
    const normalized = conversations.filter(item =>
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()),
    );

    if (activeFilter === 'unread') {
      return normalized.filter(item => item.unreadCount > 0);
    }

    return normalized;
  }, [activeFilter, conversations, searchQuery]);

  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations],
  );

  const openConversation = useCallback(
    (conversation: Conversation) => {
      navigation.navigate('Chat', {
        conversationId: conversation.id,
        recipientName: conversation.name,
        recipientId: conversation.targetUserId || conversation.name,
        recipientAvatar: conversation.avatar,
        isOnline: conversation.isOnline,
        lecturerStatus: conversation.lecturerStatus,
        isGroup: conversation.isGroup,
        participants: conversation.participants,
      });
    },
    [navigation],
  );

  // ── Online users horizontal strip (Telegram stories-like) ──
  const renderOnlineStrip = () => {
    const onlineUsers = conversations
      .filter(c => c.isOnline && !c.isGroup)
      .map(c => ({ id: c.targetUserId!, name: c.name, isOnline: true, conversationId: c.id, avatar: c.avatar }));

    if (onlineUsers.length === 0) {
      return null;
    }

    return (
      <View style={styles.onlineStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.onlineScrollContent}
        >
          {/* New message button */}
          <TouchableOpacity
            style={styles.stripUser}
            onPress={() => navigation.navigate('CreateGroup', { currentUser })}
          >
            <View style={styles.addStoryCircle}>
              <Icon name="plus" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.stripUserName} numberOfLines={1}>Mới</Text>
          </TouchableOpacity>

          {onlineUsers.map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.stripUser}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: user.conversationId,
                  recipientName: user.name,
                  recipientId: user.id,
                  recipientAvatar: user.avatar,
                  isOnline: user.isOnline,
                })
              }
            >
              <Avatar
                name={user.name}
                uri={user.avatar}
                localSource={user.id === 'ai-assistant' ? require('../botai.png') : undefined}
                size="medium"
                isOnline={user.isOnline}
                showOnlineStatus
                showGradientRing
              />
              <Text style={styles.stripUserName} numberOfLines={1}>
                {user.name.split(' ').slice(-1)[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ── Conversation row (Telegram flat style) ──
  const renderConversationItem = ({
    item,
    index,
  }: {
    item: Conversation;
    index: number;
  }) => {
    const isMine = item.lastMessage?.senderId === currentUser;
    const previewPrefix = isMine ? 'You: ' : '';

    return (
      <Animated.View
        style={[
          styles.rowWrapper,
          {
            opacity: listAnim,
            transform: [
              {
                translateY: listAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12 + index * 1, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => openConversation(item)}
          onLongPress={() => setLongPressItem(item)}
          delayLongPress={400}
        >
          <Avatar
            name={item.name}
            uri={item.avatar}
            localSource={item.targetUserId === 'ai-assistant' ? require('../botai.png') : undefined}
            size="large"
            isOnline={item.isOnline}
            showOnlineStatus={!item.isGroup}
          />

          <View style={styles.rowContent}>
            <View style={styles.rowTop}>
              <View style={styles.rowNameWrap}>
                <Text
                  style={[
                    styles.rowName,
                    item.unreadCount > 0 && styles.rowNameUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.isPinned && (
                  <Icon name="pin" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
                )}
                {item.isMuted && (
                  <Icon name="bell-off-outline" size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
                )}
                {item.lecturerStatus && (
                  <StatusBadge status={item.lecturerStatus} compact />
                )}
              </View>
              <Text
                style={[
                  styles.rowTime,
                  item.unreadCount > 0 && styles.rowTimeUnread,
                ]}
              >
                {item.lastMessage ? formatTimeAgo(item.lastMessage.timestamp) : ''}
              </Text>
            </View>

            <View style={styles.rowBottom}>
              <View style={styles.previewWrap}>
                {isMine && (
                  <Icon
                    name="check-all"
                    size={16}
                    color={Colors.primary}
                    style={{ marginRight: 3 }}
                  />
                )}
                <Text
                  style={[
                    styles.previewText,
                    item.unreadCount > 0 && styles.previewTextUnread,
                  ]}
                  numberOfLines={2}
                >
                  {previewPrefix}{item.lastMessage?.text || 'Bắt đầu trò chuyện'}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSeparator = () => <View style={styles.separator} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#004A82" />

      <Animated.View
        style={[
          styles.headerWrap,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#004A82', '#0066B3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {showSearch ? (
            <View style={styles.searchRow}>
              <TouchableOpacity
                style={styles.searchBackBtn}
                onPress={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
              >
                <Icon name="arrow-left" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.searchBar}>
                <Icon name="magnify" size={18} color="rgba(255,255,255,0.5)" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.searchInput}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Tin nhắn</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setShowSearch(true)}
                >
                  <Icon name="magnify" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Filter tabs (Telegram-style minimal) */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'unread', label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
        ].map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              activeFilter === filter.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.key as 'all' | 'unread')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === filter.key && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderOnlineStrip()}

      {/* Archived conversations banner */}
      {archivedConversations.length > 0 && (
        <TouchableOpacity
          style={styles.archivedBanner}
          activeOpacity={0.7}
          onPress={() => setShowArchived(true)}
        >
          <View style={styles.archivedBannerLeft}>
            <View style={styles.archivedIconWrap}>
              <Icon name="archive-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.archivedBannerText}>Tin nhắn đã lưu trữ</Text>
          </View>
          <View style={styles.archivedBadge}>
            <Text style={styles.archivedBadgeText}>{archivedConversations.length}</Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderConversationItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chat-outline"
            title="Chưa có cuộc trò chuyện nào"
            subtitle="Bắt đầu nhắn tin với bạn bè hoặc giảng viên."
            actionLabel="Tin nhắn mới"
            onAction={() =>
              navigation.navigate('Chat', {
                conversationId: `demo-chat-${Date.now()}`,
                recipientName: 'Demo User',
                recipientId: 'demo-user',
                isOnline: true,
              })
            }
          />
        }
      />

      {/* FAB — New message */}
      <View style={styles.fabWrap}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.fabTouch}
          onPress={() => navigation.navigate('CreateGroup', { currentUser })}
        >
          <LinearGradient
            colors={['#0077CC', '#005A9E']}
            style={styles.fab}
          >
            <Icon name="pencil-outline" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Long-press context menu ── */}
      <Modal
        visible={!!longPressItem}
        transparent
        animationType="fade"
        onRequestClose={() => setLongPressItem(null)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setLongPressItem(null)}
        >
          <View style={styles.menuSheet}>
            {/* Header */}
            <View style={styles.menuHeader}>
              <Avatar 
                name={longPressItem?.name} 
                uri={longPressItem?.avatar} 
                localSource={longPressItem?.targetUserId === 'ai-assistant' ? require('../botai.png') : undefined}
                size="medium" 
              />
              <View style={styles.menuHeaderInfo}>
                <Text style={styles.menuHeaderName} numberOfLines={1}>
                  {longPressItem?.name}
                </Text>
                <Text style={styles.menuHeaderSub} numberOfLines={1}>
                  {longPressItem?.lastMessage?.text || 'Cuộc trò chuyện'}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Actions */}
            {[
              { icon: longPressItem?.isPinned ? 'pin-off-outline' : 'pin-outline',
                label: longPressItem?.isPinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện',
                color: '#0066B3', action: async () => {
                const convId = longPressItem?.id;
                const wasPinned = longPressItem?.isPinned;
                setLongPressItem(null);
                try {
                  await fetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${convId}/pin`, { method: 'PUT' });
                  setConversations(prev => {
                    const updated = prev.map(c => c.id === convId ? { ...c, isPinned: !wasPinned } : c);
                    return updated.sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1;
                      if (!a.isPinned && b.isPinned) return 1;
                      return 0;
                    });
                  });
                  Alert.alert(wasPinned ? 'Bỏ ghim' : 'Ghim', wasPinned ? `Đã bỏ ghim cuộc trò chuyện` : `Đã ghim cuộc trò chuyện`);
                } catch { Alert.alert('Lỗi', 'Không thể thay đổi trạng thái ghim'); }
              }},
              { icon: longPressItem?.isMuted ? 'volume-high' : 'volume-off',
                label: longPressItem?.isMuted ? 'Bật thông báo' : 'Tắt thông báo',
                color: '#64748B', action: async () => {
                const convId = longPressItem?.id;
                const wasMuted = longPressItem?.isMuted;
                setLongPressItem(null);
                try {
                  await fetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${convId}/mute`, { method: 'PUT' });
                  setConversations(prev => prev.map(c => c.id === convId ? { ...c, isMuted: !wasMuted } : c));
                  Alert.alert(wasMuted ? 'Bật thông báo' : 'Tắt thông báo', wasMuted ? `Đã bật thông báo` : `Đã tắt thông báo`);
                } catch { Alert.alert('Lỗi', 'Không thể thay đổi thông báo'); }
              }},
              { icon: 'check-all', label: 'Đánh dấu đã đọc', color: '#059669', action: async () => {
                const convId = longPressItem?.id;
                setLongPressItem(null);
                try {
                  await fetch(`${API_URL}/api/v1/chat/history/${convId}/read?userId=${currentUser}`);
                  setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
                } catch { Alert.alert('Lỗi', 'Không thể đánh dấu đã đọc'); }
              }},
              { icon: 'archive-outline', label: 'Lưu trữ', color: '#7C3AED', action: async () => {
                const convId = longPressItem?.id;
                const convItem = longPressItem;
                setLongPressItem(null);
                try {
                  await fetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${convId}/archive`, { method: 'PUT' });
                  setConversations(prev => prev.filter(c => c.id !== convId));
                  if (convItem) {
                    setArchivedConversations(prev => [...prev, { ...convItem, isArchived: true }]);
                  }
                  Alert.alert('Lưu trữ', `Đã lưu trữ cuộc trò chuyện`);
                } catch { Alert.alert('Lỗi', 'Không thể lưu trữ'); }
              }},
              { icon: 'delete-outline', label: 'Xóa cuộc trò chuyện', color: '#DC2626', action: () => {
                const convId = longPressItem?.id;
                const convName = longPressItem?.name;
                setLongPressItem(null);
                Alert.alert(
                  'Xóa cuộc trò chuyện',
                  `Bạn có chắc muốn xóa cuộc trò chuyện với ${convName}?`,
                  [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Xóa', style: 'destructive', onPress: async () => {
                      try {
                        await fetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${convId}`, { method: 'DELETE' });
                        setConversations(prev => prev.filter(c => c.id !== convId));
                      } catch { Alert.alert('Lỗi', 'Không thể xóa cuộc trò chuyện'); }
                    }},
                  ],
                );
              }},
            ].map((menuItem, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.menuItem}
                activeOpacity={0.6}
                onPress={menuItem.action}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: `${menuItem.color}12` }]}>
                  <Icon name={menuItem.icon} size={20} color={menuItem.color} />
                </View>
                <Text style={[
                  styles.menuItemText,
                  menuItem.color === '#DC2626' && { color: '#DC2626' },
                ]}>
                  {menuItem.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Archived conversations modal ── */}
      <Modal
        visible={showArchived}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArchived(false)}
      >
        <SafeAreaView style={styles.archivedModal}>
          <View style={styles.archivedModalHeader}>
            <TouchableOpacity onPress={() => setShowArchived(false)} style={styles.archivedBackBtn}>
              <Icon name="arrow-left" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.archivedModalTitle}>Tin nhắn đã lưu trữ</Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={archivedConversations}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="archive-outline"
                title="Không có tin nhắn lưu trữ"
                subtitle="Các cuộc trò chuyện đã lưu trữ sẽ hiển thị ở đây."
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                onPress={() => {
                  setShowArchived(false);
                  openConversation(item);
                }}
              >
                <Avatar name={item.name} size="large" isOnline={item.isOnline} showOnlineStatus={!item.isGroup} />
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowTime}>
                      {item.lastMessage ? formatTimeAgo(item.lastMessage.timestamp) : ''}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={styles.previewText} numberOfLines={1}>
                      {item.lastMessage?.text || 'Cuộc trò chuyện'}
                    </Text>
                    <TouchableOpacity
                      style={styles.unarchiveBtn}
                      onPress={async () => {
                        try {
                          await fetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${item.id}/archive`, { method: 'PUT' });
                          setArchivedConversations(prev => prev.filter(c => c.id !== item.id));
                          setConversations(prev => [...prev, { ...item, isArchived: false }]);
                        } catch { Alert.alert('Lỗi', 'Không thể bỏ lưu trữ'); }
                      }}
                    >
                      <Icon name="archive-arrow-up-outline" size={20} color="#7C3AED" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerWrap: {
    zIndex: 5,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  searchBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 15,
    padding: 0,
  },
  // ── Filter chips ──
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  // ── Online strip ──
  onlineStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF0',
  },
  onlineScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: 16,
  },
  stripUser: {
    alignItems: 'center',
    width: 60,
  },
  addStoryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 179, 0.05)',
  },
  stripUserName: {
    marginTop: 4,
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  // ── Conversation list ──
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8ECF0',
    marginLeft: 82,
  },
  rowWrapper: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowNameUnread: {
    fontWeight: '700',
    color: '#000000',
  },
  rowTime: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '400',
  },
  rowTimeUnread: {
    color: Colors.primary,
    fontWeight: '500',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  previewText: {
    color: '#94A3B8',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  previewTextUnread: {
    color: '#475569',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── FAB ──
  fabWrap: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xxl,
    ...Shadows.md,
  },
  fabTouch: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Context menu ──
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  menuHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  menuHeaderSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  // ── Archived banner ──
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    backgroundColor: '#F5F3FF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF0',
  },
  archivedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archivedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  archivedBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5B21B6',
  },
  archivedBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  archivedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Archived modal ──
  archivedModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  archivedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF0',
    backgroundColor: '#F8FAFC',
  },
  archivedBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archivedModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  unarchiveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatListScreen;
