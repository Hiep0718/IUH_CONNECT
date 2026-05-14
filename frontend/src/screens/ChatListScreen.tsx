import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  Animated,
  Dimensions,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import type { Conversation, LecturerStatus } from '../types/types';
import { API_URL } from '../config/env';

const { width } = Dimensions.get('window');

interface ChatListScreenProps {
  navigation: any;
  currentUser: string;
  onLogout: () => void;
}

// Mock active users for stories bar
const MOCK_ACTIVE_USERS = [
  { id: 'u1', name: 'Văn An', isOnline: true },
  { id: 'u2', name: 'Thị Bình', isOnline: true },
  { id: 'u3', name: 'Hoàng Minh', isOnline: true },
  { id: 'u4', name: 'Thị Lan', isOnline: true },
  { id: 'u5', name: 'Minh Đức', isOnline: true },
  { id: 'u6', name: 'CLB Tin', isOnline: false },
];

// Removed MOCK_CONVERSATIONS

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins}ph`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const ChatListScreen: React.FC<ChatListScreenProps> = ({
  navigation,
  currentUser,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchBarWidth = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(fabAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/chat/conversations/${currentUser}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((msg: any) => {
          // Recover from corrupted data where msg.receiverId is a conversation ID
          let otherUserId = msg.senderId === currentUser ? msg.receiverId : msg.senderId;
          
          // If the extracted otherUserId looks like a conversation ID (contains a hyphen),
          // fallback to extracting it from the conversationId securely.
          if (otherUserId && otherUserId.includes('-')) {
            const parts = msg.conversationId.split('-');
            otherUserId = parts[0] === currentUser ? parts[1] : parts[0];
          }

          return {
            id: msg.conversationId,
            name: otherUserId, // TODO: Fetch real name if needed
            targetUserId: otherUserId,
            isGroup: false,
            participants: [],
            lastMessage: {
              text: msg.content,
              timestamp: new Date(msg.timestamp),
              senderId: msg.senderId,
            },
            unreadCount: 0,
            isOnline: false,
          } as Conversation;
        });
        setConversations(mapped);
      }
    } catch (e) {
      console.log('Error loading conversations', e);
    }
  }, [currentUser]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000); // Polling for demo, or rely on WS
    return () => clearInterval(interval);
  }, [loadConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations().then(() => setRefreshing(false));
  }, [loadConversations]);

  const toggleSearch = () => {
    if (showSearch) {
      Animated.timing(searchBarWidth, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        setShowSearch(false);
        setSearchQuery('');
      });
    } else {
      setShowSearch(true);
      Animated.timing(searchBarWidth, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    (conv.name || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pinnedConversations = filteredConversations.filter((c) => c.isPinned);
  const regularConversations = filteredConversations.filter((c) => !c.isPinned);

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      recipientName: conversation.name,
      recipientId: conversation.targetUserId || conversation.name,
      isOnline: conversation.isOnline,
      lecturerStatus: conversation.lecturerStatus,
      isGroup: conversation.isGroup,
    });
  };

  const getMessagePreviewIcon = (text: string) => {
    if (text.includes('📋') || text.includes('Thông báo')) return 'bullhorn-outline';
    if (text.includes('🎉') || text.includes('họp')) return 'calendar-clock';
    if (text.includes('📸') || text.includes('Ảnh')) return 'image-outline';
    if (text.includes('📎') || text.includes('File')) return 'paperclip';
    return null;
  };

  // Active Users Stories Bar
  const renderActiveUsers = () => (
    <View style={styles.activeUsersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.activeUsersScroll}
      >
        {/* Add Story */}
        <TouchableOpacity style={styles.activeUserItem}>
          <View style={styles.addStoryCircle}>
            <Icon name="plus" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.activeUserName} numberOfLines={1}>Bạn</Text>
        </TouchableOpacity>

        {MOCK_ACTIVE_USERS.map((user) => (
          <TouchableOpacity key={user.id} style={styles.activeUserItem}>
            <Avatar
              name={user.name}
              size="large"
              isOnline={user.isOnline}
              showOnlineStatus
              showGradientRing={user.isOnline}
            />
            <Text style={styles.activeUserName} numberOfLines={1}>
              {user.name.split(' ').pop()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderConversationItem = ({ item, index }: { item: Conversation; index: number }) => {
    const itemAnim = new Animated.Value(0);
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 40,
      useNativeDriver: true,
    }).start();

    const previewIcon = item.lastMessage ? getMessagePreviewIcon(item.lastMessage.text) : null;

    return (
      <Animated.View
        style={{
          opacity: itemAnim,
          transform: [{
            translateY: itemAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            }),
          }],
        }}
      >
        <TouchableOpacity
          style={[styles.conversationItem, item.isPinned && styles.pinnedItem]}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.5}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Avatar
              name={item.name}
              size="large"
              isOnline={item.isOnline}
              showOnlineStatus={!item.isGroup}
            />
            {item.isGroup && (
              <View style={styles.groupBadge}>
                <Icon name="account-group" size={10} color={Colors.white} />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.conversationContent}>
            <View style={styles.topRow}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    styles.conversationName,
                    item.unreadCount > 0 && styles.unreadName,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.lecturerStatus && (
                  <StatusBadge status={item.lecturerStatus} compact />
                )}
                {item.isPinned && (
                  <Icon
                    name="pin"
                    size={12}
                    color={Colors.textMuted}
                    style={styles.pinIcon}
                  />
                )}
              </View>
              <Text style={[styles.timeText, item.unreadCount > 0 && styles.timeUnread]}>
                {item.lastMessage
                  ? formatTimeAgo(item.lastMessage.timestamp)
                  : ''}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.messagePreview}>
                {previewIcon && (
                  <Icon
                    name={previewIcon}
                    size={14}
                    color={Colors.textMuted}
                    style={styles.previewIcon}
                  />
                )}
                <Text
                  style={[
                    styles.lastMessage,
                    item.unreadCount > 0 && styles.unreadMessage,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage?.text || 'Bắt đầu cuộc trò chuyện'}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
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

  const renderHeader = () => (
    <>
      {/* Active Users Stories */}
      {renderActiveUsers()}

      {/* Pinned Section */}
      {pinnedConversations.length > 0 && (
        <>
          <SectionHeader title="Đã ghim" accentColor={Colors.warning} />
          {pinnedConversations.map((item, index) => (
            <View key={item.id}>
              {renderConversationItem({ item, index })}
            </View>
          ))}
          <SectionHeader title="Tất cả tin nhắn" />
        </>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <Animated.View
        style={[
          styles.headerWrapper,
          {
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            }],
          },
        ]}
      >
        <LinearGradient
          colors={['#004A82', '#0066B3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>IUH Connect</Text>
              <Text style={styles.headerSubtitle}>
                Xin chào, {currentUser} 👋
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={toggleSearch}
              >
                <Icon name={showSearch ? 'close' : 'magnify'} size={22} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate('ProfileSettings')}
              >
                <Icon name="cog-outline" size={22} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          {showSearch && (
            <Animated.View style={[styles.searchContainer, {
              opacity: searchBarWidth,
              transform: [{
                scaleY: searchBarWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              }],
            }]}>
              <View style={styles.searchBar}>
                <Icon name="magnify" size={20} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm cuộc trò chuyện..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Conversation List */}
      <FlatList
        data={pinnedConversations.length > 0 ? regularConversations : filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
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
            title="Chưa có cuộc trò chuyện"
            subtitle="Bắt đầu nhắn tin với bạn bè và giảng viên của bạn"
            actionLabel="Bắt đầu trò chuyện"
            onAction={() => { }}
          />
        }
      />

      {/* FAB */}
      <Animated.View
        style={[
          styles.fabWrapper,
          {
            transform: [{ scale: fabAnim }],
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} style={styles.fabTouch} onPress={() => navigation.navigate('CreateGroup', { currentUser })}>
          <LinearGradient
            colors={['#0077CC', '#004A82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Icon name="message-plus" size={26} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Header
  headerWrapper: {
    zIndex: 10,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.h2,
    fontWeight: Typography.extraBold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: Typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 44,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    padding: 0,
  },
  // Active Users
  activeUsersContainer: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
    ...Shadows.xs,
  },
  activeUsersScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  activeUserItem: {
    alignItems: 'center',
    width: 64,
  },
  addStoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryGhost,
  },
  activeUserName: {
    fontSize: Typography.tiny,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  // List
  listContent: {
    paddingBottom: 100,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginVertical: 2,
    borderRadius: BorderRadius.lg,
  },
  pinnedItem: {
    backgroundColor: Colors.primaryGhost,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  avatarSection: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  conversationContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
    gap: 6,
  },
  conversationName: {
    fontSize: Typography.body,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  unreadName: {
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  pinIcon: {
    marginLeft: 2,
  },
  timeText: {
    fontSize: Typography.tiny,
    color: Colors.textMuted,
    fontWeight: Typography.regular,
  },
  timeUnread: {
    color: Colors.primary,
    fontWeight: Typography.semiBold,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  previewIcon: {
    marginRight: 4,
  },
  lastMessage: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  unreadMessage: {
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: Colors.white,
    fontSize: Typography.tiny,
    fontWeight: Typography.bold,
  },
  // FAB
  fabWrapper: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatListScreen;
