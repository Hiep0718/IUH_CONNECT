import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
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
import { Colors, Shadows, Spacing, Typography } from '../theme/theme';
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
  if (msg.messageType === 'IMAGE') preview = '📷 Photo';
  if (msg.messageType === 'VIDEO') preview = '🎬 Video';
  if (msg.messageType === 'FILE') preview = `📎 ${msg.fileName || 'File'}`;
  if (msg.messageType === 'STICKER') preview = '😄 Sticker';
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
    } catch (error) {
      console.log('Error loading conversations', error);
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

  // ── Online users horizontal strip (Telegram stories-like) ──
  const renderOnlineStrip = () => {
    const onlineUsers = conversations
      .filter(c => c.isOnline && !c.isGroup)
      .map(c => ({ id: c.targetUserId!, name: c.name, isOnline: true }));

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
});

export default ChatListScreen;
