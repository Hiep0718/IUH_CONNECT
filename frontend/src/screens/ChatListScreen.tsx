import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
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
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../theme/theme';
import { chatCache } from '../services/chatCache';
import type { Conversation } from '../types/types';

interface ChatListScreenProps {
  navigation: any;
  currentUser: string;
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
    return 'Call';
  }

  try {
    const callInfo = JSON.parse(content);
    switch (callInfo.callStatus) {
      case 'missed':
        return 'Missed call';
      case 'rejected':
        return 'Call rejected';
      case 'cancelled':
        return 'Call cancelled';
      default:
        return callInfo.duration > 0 ? 'Completed call' : 'Video call';
    }
  } catch {
    return 'Video call';
  }
};

const mapConversationPreview = (msg: any, currentUser: string): Conversation | null => {
  const otherUserId = resolveOtherUserId(msg, currentUser);
  if (!otherUserId || otherUserId === currentUser) {
    return null;
  }

  let preview = msg.content;
  if (msg.messageType === 'IMAGE') preview = 'Photo';
  if (msg.messageType === 'VIDEO') preview = 'Video';
  if (msg.messageType === 'FILE') preview = `File: ${msg.fileName || 'attachment'}`;
  if (msg.messageType === 'STICKER') preview = 'Sticker';
  if (msg.messageType === 'CALL') preview = formatCallPreview(msg.content);

  return {
    id: msg.conversationId,
    name: otherUserId,
    targetUserId: otherUserId,
    avatar: undefined,
    isGroup: false,
    participants: [],
    lastMessage: {
      text: preview,
      timestamp: new Date(msg.timestamp),
      senderId: msg.senderId,
    },
    unreadCount: msg.unreadCount || 0,
    isOnline: false,
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

const ChatListScreen: React.FC<ChatListScreenProps> = ({
  navigation,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
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
      const res = await fetch(`${API_URL}/api/v1/chat/conversations/${currentUser}`);
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const mapped = data
        .map((msg: any) => mapConversationPreview(msg, currentUser))
        .filter(Boolean) as Conversation[];
      const sanitized = sanitizeConversations(mapped, currentUser);

      const userIds = [
        ...new Set(sanitized.map(item => item.targetUserId).filter(Boolean)),
      ] as string[];

      if (userIds.length > 0 && presenceAvailableRef.current) {
        try {
          const presenceRes = await fetch(`${API_URL}/api/v1/presence/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

      setConversations(sanitized);

      // Cache danh sách conversations khi fetch thành công
      chatCache.saveConversations(sanitized);
    } catch (error) {
      console.log('Error loading conversations', error);

      // Fallback: load từ cache khi mất mạng
      const cached = await chatCache.loadConversations();
      if (cached.length > 0) {
        console.log(`📦 [ChatList] Loaded ${cached.length} conversations from cache`);
        setConversations(cached);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
        isOnline: conversation.isOnline,
        lecturerStatus: conversation.lecturerStatus,
        isGroup: conversation.isGroup,
      });
    },
    [navigation],
  );

  const renderOnlineStrip = () => {
    const onlineUsers = conversations
      .filter(c => c.isOnline && !c.isGroup)
      .map(c => ({ id: c.targetUserId!, name: c.name, isOnline: true }));

    if (onlineUsers.length === 0) {
      return null;
    }

    return (
      <View style={styles.onlineStrip}>
        <Text style={styles.stripTitle}>Active now</Text>
        <View style={styles.stripUsers}>
          {onlineUsers.slice(0, 4).map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.stripUser}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: buildDirectConversationKey(currentUser, user.id),
                  recipientName: user.name,
                  recipientId: user.id,
                  isOnline: user.isOnline,
                })
              }
            >
              <Avatar
                name={user.name}
                size="medium"
                isOnline={user.isOnline}
                showOnlineStatus
              />
              <Text style={styles.stripUserName} numberOfLines={1}>
                {user.name.split(' ').slice(-1)[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderConversationItem = ({
    item,
    index,
  }: {
    item: Conversation;
    index: number;
  }) => {
    const previewIcon =
      item.lastMessage?.text?.includes('Photo')
        ? 'image-outline'
        : item.lastMessage?.text?.includes('Video')
          ? 'video-outline'
          : item.lastMessage?.text?.includes('File:')
            ? 'file-outline'
            : undefined;

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
                  outputRange: [20 + index * 2, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.82}
          onPress={() => openConversation(item)}
        >
          <Avatar
            name={item.name}
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
                {previewIcon && (
                  <Icon
                    name={previewIcon}
                    size={14}
                    color="#8192A8"
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.previewText,
                    item.unreadCount > 0 && styles.previewTextUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage?.text || 'Start a conversation'}
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1459A2" />

      <Animated.View
        style={[
          styles.headerWrap,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#1459A2', '#1C74D8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Chats</Text>
              <Text style={styles.headerSubtitle}>
                {unreadCount > 0 ? `${unreadCount} unread messages` : `Signed in as ${currentUser}`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => setShowSearch(prev => !prev)}
              >
                <Icon
                  name={showSearch ? 'close' : 'magnify'}
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate('ProfileSettings')}
              >
                <Icon name="cog-outline" size={21} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {showSearch && (
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <Icon name="magnify" size={18} color="#7B8CA2" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search conversations"
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                  autoFocus
                />
              </View>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
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

      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={renderConversationItem}
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
            title="No conversations yet"
            subtitle="Start chatting with your classmates or lecturers."
            actionLabel="New chat"
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

      <View style={styles.fabWrap}>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.fabTouch}
          onPress={() => navigation.navigate('CreateGroup', { currentUser })}
        >
          <LinearGradient
            colors={['#1D6FD7', '#1459A2']}
            style={styles.fab}
          >
            <Icon name="message-plus" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DCE6F2',
  },
  headerWrap: {
    zIndex: 5,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: Typography.bodySmall,
    color: 'rgba(255,255,255,0.76)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginTop: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 46,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#182433',
    fontSize: 14,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingTop: 14,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  filterChipActive: {
    backgroundColor: '#1D6FD7',
  },
  filterChipText: {
    color: '#55657A',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  onlineStrip: {
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    ...Shadows.sm,
  },
  stripTitle: {
    color: '#223042',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  stripUsers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  stripUser: {
    flex: 1,
    alignItems: 'center',
  },
  stripUserName: {
    marginTop: 6,
    color: '#607285',
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
  },
  rowWrapper: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...Shadows.sm,
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    color: '#1A2535',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowNameUnread: {
    color: '#0F172A',
  },
  rowTime: {
    color: '#7F90A7',
    fontSize: 11,
    fontWeight: '600',
  },
  rowTimeUnread: {
    color: '#1D6FD7',
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
    color: '#6E8094',
    fontSize: 13,
    flex: 1,
  },
  previewTextUnread: {
    color: '#314155',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1D6FD7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  fabWrap: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xxl,
    ...Shadows.lg,
  },
  fabTouch: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatListScreen;
