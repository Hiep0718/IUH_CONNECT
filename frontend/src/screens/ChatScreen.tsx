import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Image,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import {
  Bubble,
  Composer,
  Day,
  GiftedChat,
  IMessage,
  InputToolbar,
  Send,
  SystemMessage,
  Time,
} from 'react-native-gifted-chat';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Avatar from '../components/Avatar';
import MessageTicks from '../components/MessageTicks';
import OfflineBanner from '../components/OfflineBanner';
import StatusBadge from '../components/StatusBadge';
import StickerPicker from '../components/StickerPicker';
import TypingIndicator from '../components/TypingIndicator';
import { API_URL } from '../config/env';
import { authFetch } from '../services/authService';
import { isCallSignal } from '../services/callSignaling';
import { uploadMedia, getMessageTypeFromMime } from '../services/mediaUploadService';
import { useWebSocket } from '../services/WebSocketProvider';
import { chatCache } from '../services/chatCache';
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../theme/theme';
import type { LecturerStatus, MessageStatus } from '../types/types';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

type ReactionMap = Record<string, string[]>;

interface ChatScreenProps {
  navigation: any;
  route: {
    params: {
      conversationId: string;
      recipientName: string;
      recipientAvatar?: string;
      recipientId: string;
      isOnline?: boolean;
      lecturerStatus?: LecturerStatus;
      isGroup?: boolean;
    };
  };
  currentUser: string;
  token: string | null;
}

interface ReplyPreview {
  _id: string | number;
  text: string;
  user: {
    _id: string | number;
    name?: string;
  };
}

interface ExtendedMessage extends IMessage {
  status?: MessageStatus;
  isOffline?: boolean;
  isAutoReply?: boolean;
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  replyTo?: ReplyPreview;
  reactions?: ReactionMap;
  serverId?: string;
  rawContent?: string;
}

interface ServerMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  content: string;
  conversationId: string;
  timestamp: number;
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  reactions?: ReactionMap;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
}

interface ChatReactionEvent {
  type: 'CHAT_REACTION';
  receiverId: string;
  actorUserId: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  reactions: ReactionMap;
}

const LIMIT = 20;
const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];
const LOCAL_MESSAGE_PREFIX = 'local-';

const createLocalMessageId = () => `${LOCAL_MESSAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isPersistedMessageId = (message?: ExtendedMessage | null) => {
  if (!message) {
    return false;
  }

  const serverId = message.serverId || String(message._id || '');
  return serverId.length > 0 && !serverId.startsWith(LOCAL_MESSAGE_PREFIX) && !serverId.includes('-pending-');
};

const normalizeMessageText = (messageType?: string, content?: string, fileName?: string) => {
  switch (messageType) {
    case 'IMAGE':
      return 'Photo';
    case 'VIDEO':
      return 'Video';
    case 'FILE':
      return `File: ${fileName || 'attachment'}`;
    default:
      return content || '';
  }
};

const mapServerMessage = (
  msg: ServerMessage,
  currentUser: string,
): ExtendedMessage => {
  const isStickerImage =
    msg.messageType === 'STICKER' &&
    !!msg.content &&
    msg.content.startsWith('http');

  return {
    _id: msg.id || createLocalMessageId(),
    serverId: msg.id,
    rawContent: msg.content,
    text:
      msg.messageType === 'CALL'
        ? msg.content
        : (msg.messageType === 'IMAGE' || msg.messageType === 'VIDEO' || msg.messageType === 'FILE' || isStickerImage)
          ? ''
          : normalizeMessageText(msg.messageType, msg.content, msg.fileName),
    createdAt: new Date(msg.timestamp),
    user: {
      _id: msg.senderId === currentUser ? 'me' : msg.senderId,
      name: msg.senderId === currentUser ? 'You' : msg.senderId,
    },
    status: msg.senderId === currentUser ? 'read' : 'delivered',
    image:
      msg.messageType === 'IMAGE'
        ? msg.mediaUrl
        : isStickerImage
          ? msg.content
          : undefined,
    audio: msg.messageType === 'AUDIO' ? msg.mediaUrl : undefined,
    messageType: msg.messageType || 'TEXT',
    isAutoReply: msg.messageType === 'AUTO_REPLY',
    mediaUrl: msg.mediaUrl,
    fileName: msg.fileName,
    fileSize: msg.fileSize,
    mimeType: msg.mimeType,
    reactions: msg.reactions || undefined,
    replyTo: msg.replyToId
      ? {
          _id: msg.replyToId,
          text: msg.replyToText || '',
          user: {
            _id: msg.replyToSender || '',
            name: msg.replyToSender || '',
          },
        }
      : undefined,
  };
};

const formatPresenceText = (presence: { status: string; lastSeen: number }) => {
  if (presence.status === 'BUSY') {
    return 'Đang bận';
  }

  if (presence.status === 'AVAILABLE') {
    return 'Sẵn sàng';
  }

  if (presence.status === 'ONLINE') {
    return 'Online';
  }

  if (!presence.lastSeen) {
    return 'Offline';
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - presence.lastSeen) / 60000));
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h ago`;
  }
  return 'Offline';
};

const isReactionEvent = (data: any): data is ChatReactionEvent =>
  data?.type === 'CHAT_REACTION' && !!data?.messageId;

const SWIPE_THRESHOLD = 50;

const SwipeableMessage = ({ children, onReply }: { children: React.ReactNode; onReply: () => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal right-swipes, ignore vertical scrolls
        return gestureState.dx > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        hasTriggered.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          // Dampen the movement so it feels bounded
          const clamped = Math.min(gestureState.dx * 0.5, 80);
          translateX.setValue(clamped);

          if (gestureState.dx >= SWIPE_THRESHOLD && !hasTriggered.current) {
            hasTriggered.current = true;
          }
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 10,
        }).start();

        if (hasTriggered.current) {
          onReply();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 10,
        }).start();
      },
    }),
  ).current;

  const replyIconOpacity = translateX.interpolate({
    inputRange: [0, 20, 40],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const replyIconScale = translateX.interpolate({
    inputRange: [0, 30, 50],
    outputRange: [0.5, 0.8, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeableWrapper}>
      {/* Reply icon behind the message */}
      <Animated.View
        style={[
          styles.swipeReplyAction,
          { opacity: replyIconOpacity, transform: [{ scale: replyIconScale }] },
        ]}
        pointerEvents="none"
      >
        <View style={styles.swipeReplyIconCircle}>
          <Icon name="reply" size={18} color="#1D6FD7" />
        </View>
      </Animated.View>

      {/* Message content */}
      <Animated.View
        style={{ transform: [{ translateX }], width: '100%' }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const ChatScreen: React.FC<ChatScreenProps> = ({
  navigation,
  route,
  currentUser,
  token,
}) => {
  const {
    conversationId,
    recipientName,
    recipientAvatar,
    recipientId,
    lecturerStatus,
    isGroup = false,
    participants = [],
  } = route.params;
  const [displayRecipientName, setDisplayRecipientName] = useState(recipientName || recipientId || 'Người dùng');

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ExtendedMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ExtendedMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [recipientPresence, setRecipientPresence] = useState({ status: 'OFFLINE', lastSeen: 0 });
  const [groupMemberNames, setGroupMemberNames] = useState<Record<string, string>>({});
  const [groupMemberAvatars, setGroupMemberAvatars] = useState<Record<string, string>>({});
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [activeMeeting, setActiveMeeting] = useState<{ meetingId: string; roomName: string } | null>(null);
  const audioRecorderPlayerRef = useRef(new AudioRecorderPlayer());
  const headerAnim = useRef(new Animated.Value(0)).current;
  const attachMenuAnim = useRef(new Animated.Value(0)).current;

  const { sendMessage, addListener, removeListener, isConnected, wasReconnected } = useWebSocket();
  const isOffline = !isConnected;

  const presenceText = useMemo(
    () => (lecturerStatus ? null : formatPresenceText(recipientPresence)),
    [lecturerStatus, recipientPresence],
  );

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  useEffect(() => {
    // Kiểm tra xem có cuộc gọi nhóm nào đang diễn ra không
    if (!isGroup || !conversationId) return;

    const checkActiveMeeting = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/v1/meetings/conversation/${conversationId}/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveMeeting(data);
        } else {
          setActiveMeeting(null);
        }
      } catch (error) {
        console.log('Error checking active meeting:', error);
      }
    };
    checkActiveMeeting();
  }, [conversationId, isGroup, token]);

  useEffect(() => {
    if (isGroup && participants && participants.length > 0) {
      const fetchGroupMemberProfiles = async () => {
        try {
          const res = await authFetch(`${API_URL}/api/v1/users/bulk-profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(participants),
          });
          if (res.ok) {
            const data = await res.json();
            const names: Record<string, string> = {};
            const avatars: Record<string, string> = {};
            Object.keys(data).forEach(key => {
              names[key] = data[key].fullName || data[key].username || key;
              avatars[key] = data[key].avatarUrl;
            });
            setGroupMemberNames(names);
            setGroupMemberAvatars(avatars);
          }
        } catch (error) {
          console.log('Error fetching member profiles', error);
        }
      };
      fetchGroupMemberProfiles();
    }
  }, [isGroup, participants, token]);

  const mergeMessageIntoState = useCallback((nextMessage: ExtendedMessage) => {
    setMessages(prev => {
      const existingIndex = prev.findIndex(item => {
        if (nextMessage.serverId && item.serverId === nextMessage.serverId) {
          return true;
        }

        const sameSender = item.user._id === nextMessage.user._id;
        const sameType = item.messageType === nextMessage.messageType;
        const sameMedia = item.mediaUrl === nextMessage.mediaUrl;
        const sameContent = (item.rawContent || item.text || '') === (nextMessage.rawContent || nextMessage.text || '');
        const timeDelta = Math.abs(
          new Date(item.createdAt).getTime() - new Date(nextMessage.createdAt).getTime(),
        );

        return sameSender && sameType && sameMedia && sameContent && timeDelta < 15000;
      });

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...nextMessage,
          _id: nextMessage.serverId || updated[existingIndex]._id,
          serverId: nextMessage.serverId || updated[existingIndex].serverId,
          status:
            nextMessage.user._id === 'me'
              ? 'read'
              : updated[existingIndex].status || nextMessage.status,
        };
        return updated.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      return [...prev, nextMessage].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);

  const applyReactionEvent = useCallback((event: ChatReactionEvent) => {
    setMessages(prev =>
      prev.map(item =>
        item.serverId === event.messageId || String(item._id) === event.messageId
          ? {
              ...item,
              serverId: event.messageId,
              _id: event.messageId,
              reactions: event.reactions || {},
            }
          : item,
      ),
    );
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/presence/${recipientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      setRecipientPresence({
        status: data.status || 'OFFLINE',
        lastSeen: data.lastSeen || 0,
      });
    } catch {
      // optional service
    }
  }, [recipientId]);

  const fetchHistory = useCallback(
    async (beforeTimestamp?: number) => {
      try {
        if (recipientId === 'ai-assistant') {
          // AI Chat is local-only
          if (!beforeTimestamp) {
            const cached = await chatCache.loadMessages(conversationId);
            if (cached && cached.length > 0) {
              setMessages(cached);
            } else {
              setMessages([{
                _id: 'ai-welcome',
                text: 'Chào bạn! Mình là trợ lý ảo IUH Assistant. Bạn cần mình giúp gì?',
                createdAt: new Date(),
                user: { _id: 'ai-assistant', name: 'IUH Assistant' },
                system: false,
              }]);
            }
          }
          setHasEarlierMessages(false);
          return;
        }

        const url = beforeTimestamp
          ? `${API_URL}/api/v1/chat/history/${conversationId}?before=${beforeTimestamp}&limit=${LIMIT}`
          : `${API_URL}/api/v1/chat/history/${conversationId}?limit=${LIMIT}`;

        const res = await authFetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`History request failed: ${res.status}`);
        }

        const data: ServerMessage[] = await res.json();
        const historyMessages = data
          .map(msg => mapServerMessage(msg, currentUser))
          .filter(msg => msg.text || msg.image || msg.audio || msg.messageType === 'CALL');

        setHasEarlierMessages(data.length === LIMIT);

        if (beforeTimestamp) {
          setMessages(prev =>
            GiftedChat.prepend(prev, historyMessages).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        } else {
          const nextMessages = [...historyMessages];
          if (lecturerStatus === 'busy') {
            nextMessages.push({
              _id: 'auto-busy-reply',
              text: 'Lecturer is busy now. Your message will be replied to later.',
              createdAt: new Date(),
              user: {
                _id: recipientId,
                name: recipientName,
              },
              system: true,
              isAutoReply: true,
            });
          }
          setMessages(nextMessages);

          // Cache tin nhắn khi fetch thành công
          chatCache.saveMessages(conversationId, nextMessages);
        }
      } catch (error) {
        console.error('Failed to fetch history', error);

        // Fallback: load từ cache khi mất mạng
        if (!beforeTimestamp) {
          const cached = await chatCache.loadMessages(conversationId);
          if (cached.length > 0) {
            console.log(`📦 [ChatScreen] Loaded ${cached.length} messages from cache`);
            setMessages(cached);
          }
        }
      }
    },
    [conversationId, currentUser, lecturerStatus, recipientId, recipientName, token],
  );

  const markMessagesAsRead = useCallback(async () => {
    try {
      await authFetch(
        `${API_URL}/api/v1/chat/history/${conversationId}/read?userId=${currentUser}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      console.log('Failed to mark messages as read', error);
    }
  }, [conversationId, currentUser, token]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/settings/${currentUser}/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsMuted(data.muted);
      }
    } catch (e) {
      console.log('Failed to fetch settings', e);
    }
  }, [currentUser, conversationId, token]);

  const handleAISummarize = useCallback(async () => {
    setShowSummaryModal(true);
    setIsSummarizing(true);
    setSummaryText('');
    try {
      const res = await authFetch(`${API_URL}/api/v1/ai/summarize/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to summarize');
      }
      const data = await res.json();
      setSummaryText(data.summary || 'Không thể tóm tắt cuộc trò chuyện lúc này.');
    } catch (error) {
      setSummaryText('Đã xảy ra lỗi khi AI tóm tắt tin nhắn.');
    } finally {
      setIsSummarizing(false);
    }
  }, [conversationId, token]);

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  useEffect(() => {
    fetchHistory();
    fetchPresence();
    markMessagesAsRead();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchSettings();
    });
    return unsubscribe;
  }, [navigation, fetchSettings]);

  // Re-sync tin nhắn khi reconnect sau mất mạng
  useEffect(() => {
    if (wasReconnected && isConnected) {
      console.log('🔄 [ChatScreen] Reconnected — syncing missed messages');
      fetchHistory();
      markMessagesAsRead();
    }
  }, [wasReconnected, isConnected, fetchHistory, markMessagesAsRead]);

  const onLoadEarlier = useCallback(async () => {
    if (messages.length === 0 || isLoadingEarlier) {
      return;
    }

    setIsLoadingEarlier(true);
    const oldest = messages[messages.length - 1];
    const oldestTimestamp = new Date(oldest.createdAt).getTime();
    await fetchHistory(oldestTimestamp);
    setIsLoadingEarlier(false);
  }, [fetchHistory, isLoadingEarlier, messages]);

  useEffect(() => {
    const listenerId = `chat-${conversationId}`;

    const handler = (data: any) => {
      if (isCallSignal(data)) {
        return;
      }

      if (data?.type === 'GROUP_UPDATED') {
        const conv = data.conversation;
        if (conv && conv.id === conversationId && conv.name) {
          setDisplayRecipientName(conv.name);
        }
        return;
      }


      if (data?.type === 'PRESENCE_UPDATE') {
        if (data.userId === recipientId) {
          setRecipientPresence({
            status: data.status,
            lastSeen: data.lastSeen,
          });
        }
        return;
      }

      if (isReactionEvent(data)) {
        if (data.conversationId === conversationId) {
          applyReactionEvent(data);
        }
        return;
      }

      if (data.conversationId !== conversationId) {
        return;
      }

      const incoming = mapServerMessage(data, currentUser);
      mergeMessageIntoState(incoming);

      if (navigation.isFocused?.()) {
        markMessagesAsRead();
      }
    };

    addListener(listenerId, handler);
    return () => removeListener(listenerId);
  }, [
    addListener,
    applyReactionEvent,
    conversationId,
    currentUser,
    markMessagesAsRead,
    mergeMessageIntoState,
    navigation,
    removeListener,
  ]);

  const resolvePersistedMessageId = useCallback(
    async (message: ExtendedMessage) => {
      if (isPersistedMessageId(message)) {
        return message.serverId || String(message._id);
      }

      const res = await authFetch(
        `${API_URL}/api/v1/chat/history/${conversationId}?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Cannot resolve message id: ${res.status}`);
      }

      const data: ServerMessage[] = await res.json();
      const senderId = message.user._id === 'me' ? currentUser : String(message.user._id);
      const targetTimestamp = new Date(message.createdAt).getTime();

      const matched = data.find(item => {
        const timestampDelta = Math.abs(item.timestamp - targetTimestamp);
        const sameSender = item.senderId === senderId;
        const sameType = (item.messageType || 'TEXT') === (message.messageType || 'TEXT');
        const sameMedia = (item.mediaUrl || '') === (message.mediaUrl || '');
        const sameText =
          (item.content || '') === (message.rawContent || message.text || '') ||
          normalizeMessageText(item.messageType, item.content, item.fileName) === message.text;

        return sameSender && sameType && sameMedia && sameText && timestampDelta < 20000;
      });

      if (!matched?.id) {
        return null;
      }

      setMessages(prev =>
        prev.map(item =>
          item._id === message._id
            ? {
                ...item,
                _id: matched.id as string,
                serverId: matched.id as string,
                rawContent: matched.content,
                reactions: matched.reactions || item.reactions,
              }
            : item,
        ),
      );

      return matched.id;
    },
    [conversationId, currentUser, token],
  );

  const toggleReactionLocally = useCallback(
    (messageId: string | number, emoji: string) => {
      setMessages(prev =>
        prev.map(item => {
          if (item._id !== messageId) {
            return item;
          }

          const nextReactions: ReactionMap = { ...(item.reactions || {}) };
          const currentUsers = nextReactions[emoji] || [];

          if (currentUsers.includes(currentUser)) {
            const filtered = currentUsers.filter(user => user !== currentUser);
            if (filtered.length === 0) {
              delete nextReactions[emoji];
            } else {
              nextReactions[emoji] = filtered;
            }
          } else {
            nextReactions[emoji] = [...currentUsers, currentUser];
          }

          return {
            ...item,
            reactions: nextReactions,
          };
        }),
      );
    },
    [currentUser],
  );

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessage) {
        return;
      }

      const messageSnapshot = selectedMessage;
      toggleReactionLocally(messageSnapshot._id, emoji);
      setShowMessageActions(false);
      setSelectedMessage(null);

      try {
        const persistedId = await resolvePersistedMessageId(messageSnapshot);
        if (!persistedId) {
          throw new Error('Message has not been persisted yet');
        }

        const res = await authFetch(
          `${API_URL}/api/v1/chat/messages/${persistedId}/react?userId=${currentUser}&emoji=${encodeURIComponent(emoji)}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          throw new Error(`Reaction failed: ${res.status}`);
        }

        const updated: ServerMessage = await res.json();
        const mapped = mapServerMessage(updated, currentUser);
        mergeMessageIntoState(mapped);
      } catch (error) {
        console.log('Failed to persist reaction', error);
        await fetchHistory();
        Alert.alert('Reaction failed', 'This message is not ready for reaction yet. Please try again.');
      }
    },
    [
      currentUser,
      fetchHistory,
      mergeMessageIntoState,
      resolvePersistedMessageId,
      selectedMessage,
      token,
      toggleReactionLocally,
    ],
  );

  const handleMessageLongPress = useCallback((message: ExtendedMessage) => {
    if (message.system || message.messageType === 'CALL') {
      return;
    }
    setSelectedMessage(message);
    setShowMessageActions(true);
  }, []);

  const handleReply = useCallback(() => {
    if (!selectedMessage) {
      return;
    }
    setReplyTo(selectedMessage);
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleCopyText = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
    Alert.alert('Copy', 'Clipboard is not configured in this project yet.');
  }, []);

  const handleForward = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
    Alert.alert('Forward', 'Forward flow is still under development.');
  }, []);

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      const optimisticMessages: ExtendedMessage[] = newMessages.map(msg => ({
        ...msg,
        _id: createLocalMessageId(),
        serverId: undefined,
        rawContent: msg.text,
        status: isOffline ? 'sending' : 'sent',
        isOffline,
        ...(replyTo
          ? {
              replyTo: {
                _id: replyTo._id,
                text: replyTo.text || '',
                user: replyTo.user,
              },
            }
          : {}),
      }));

      setReplyTo(null);
      setInputText('');

      const isBot = recipientId === 'ai-assistant';

      if (isBot) {
        setMessages(prev => {
           const updated = GiftedChat.append(prev, optimisticMessages);
           chatCache.saveMessages(conversationId, updated);
           return updated;
        });
        
        optimisticMessages.forEach(async message => {
          try {
            const res = await authFetch(`${API_URL}/api/v1/ai/ask`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ question: message.text }),
            });
            if (res.ok) {
              const data = await res.json();
              const botMessage: ExtendedMessage = {
                _id: createLocalMessageId(),
                text: data.answer || 'Xin lỗi, tôi không có câu trả lời.',
                createdAt: new Date(),
                user: { _id: 'ai-assistant', name: 'IUH Assistant' },
                status: 'sent',
              };
              setMessages(prev => {
                const updated = GiftedChat.append(prev, [botMessage]);
                chatCache.saveMessages(conversationId, updated);
                return updated;
              });
            }
          } catch (e) {
            console.log('AI Ask Error:', e);
          }
        });
      } else {
        setMessages(prev => GiftedChat.append(prev, optimisticMessages));

        optimisticMessages.forEach(message => {
          sendMessage({
            senderId: currentUser,
            receiverId: recipientId,
            content: message.text,
            conversationId,
            ...(replyTo
              ? {
                  replyToId: String(replyTo._id),
                  replyToText: replyTo.text,
                  replyToSender: String(replyTo.user._id),
                }
              : {}),
          });
        });
      }

      if (!isOffline) {
        setTimeout(() => {
          setMessages(prev =>
            prev.map(item =>
              optimisticMessages.some(message => message._id === item._id)
                ? { ...item, status: 'delivered' as MessageStatus }
                : item,
            ),
          );
        }, 1000);
      }
    },
    [conversationId, currentUser, isOffline, recipientId, replyTo, sendMessage],
  );

  const handleMediaSend = useCallback(
    async (file: {
      uri: string;
      fileName: string;
      type: string;
      fileSize?: number;
    }) => {
      if (!token) {
        return;
      }

      setIsUploading(true);
      try {
        const upload = await uploadMedia(token, file);
        const messageType = getMessageTypeFromMime(upload.mimeType);
        const optimisticId = createLocalMessageId();

        const optimisticMessage: ExtendedMessage = {
          _id: optimisticId,
          text: (messageType === 'IMAGE' || messageType === 'VIDEO' || messageType === 'FILE') ? '' : normalizeMessageText(messageType, '', upload.fileName),
          rawContent: normalizeMessageText(messageType, '', upload.fileName),
          createdAt: new Date(),
          user: { _id: 'me', name: currentUser },
          image: messageType === 'IMAGE' ? upload.mediaUrl : undefined,
          messageType,
          mediaUrl: upload.mediaUrl,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          status: 'sent',
          ...(replyTo
            ? {
                replyTo: {
                  _id: replyTo._id,
                  text: replyTo.text || '',
                  user: replyTo.user,
                },
              }
            : {}),
        };

        setMessages(prev => GiftedChat.append(prev, [optimisticMessage]));
        setReplyTo(null);

        sendMessage({
          senderId: currentUser,
          receiverId: recipientId,
          content: normalizeMessageText(messageType, '', upload.fileName),
          conversationId,
          messageType,
          mediaUrl: upload.mediaUrl,
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          ...(replyTo
            ? {
                replyToId: String(replyTo._id),
                replyToText: replyTo.text,
                replyToSender: String(replyTo.user._id),
              }
            : {}),
        });
      } catch (error: any) {
        Alert.alert('Upload failed', error?.message || 'Cannot upload this file.');
      } finally {
        setIsUploading(false);
        setShowAttachMenu(false);
      }
    },
    [conversationId, currentUser, recipientId, sendMessage, token],
  );

  const handleStickerSend = useCallback(
    (sticker: string, type: 'emoji' | 'sticker') => {
      const isImageSticker = type === 'sticker';
      const optimisticMessage: ExtendedMessage = {
        _id: createLocalMessageId(),
        text: isImageSticker ? '' : sticker,
        rawContent: sticker,
        image: isImageSticker ? sticker : undefined,
        createdAt: new Date(),
        user: { _id: 'me', name: currentUser },
        messageType: 'STICKER',
        status: 'sent',
        ...(replyTo
          ? {
              replyTo: {
                _id: replyTo._id,
                text: replyTo.text || '',
                user: replyTo.user,
              },
            }
          : {}),
      };

      setMessages(prev => GiftedChat.append(prev, [optimisticMessage]));
      setReplyTo(null);

      sendMessage({
        senderId: currentUser,
        receiverId: recipientId,
        content: sticker,
        conversationId,
        messageType: 'STICKER',
        ...(replyTo
          ? {
              replyToId: String(replyTo._id),
              replyToText: replyTo.text,
              replyToSender: String(replyTo.user._id),
            }
          : {}),
      });
    },
    [conversationId, currentUser, recipientId, sendMessage],
  );

  const toggleAttachMenu = useCallback(() => {
    const next = !showAttachMenu;
    Animated.spring(attachMenuAnim, {
      toValue: next ? 1 : 0,
      tension: 90,
      friction: 11,
      useNativeDriver: true,
    }).start();
    setShowAttachMenu(next);
  }, [attachMenuAnim, showAttachMenu]);

  const openCamera = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Camera permission is required.');
          return;
        }
      }

      const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      await handleMediaSend({
        uri: asset.uri,
        fileName: asset.fileName || 'photo.jpg',
        type: asset.type || 'image/jpeg',
        fileSize: asset.fileSize,
      });
    } catch {
      Alert.alert('Camera', 'Cannot open camera.');
    }
  }, [handleMediaSend]);

  const openLibrary = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'mixed', quality: 0.8, selectionLimit: 0 });
      if (!result.assets || result.assets.length === 0) return;

      for (const asset of result.assets) {
        if (!asset.uri) continue;
        await handleMediaSend({
          uri: asset.uri,
          fileName: asset.fileName || 'media',
          type: asset.type || 'application/octet-stream',
          fileSize: asset.fileSize,
        });
      }
    } catch {
      Alert.alert('Gallery', 'Cannot open gallery.');
    }
  }, [handleMediaSend]);

  const openDocumentPicker = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });
      const file = result[0];
      await handleMediaSend({
        uri: file.uri,
        fileName: file.name || 'document',
        type: file.type || 'application/octet-stream',
        fileSize: file.size || undefined,
      });
    } catch (error: any) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Files', 'Cannot pick this document.');
      }
    }
  }, [handleMediaSend]);

  const renderCallBubble = useCallback((message: ExtendedMessage, isMine: boolean) => {
    let callInfo = {
      callStatus: 'completed',
      duration: 0,
    };

    try {
      callInfo = JSON.parse(message.text || '{}');
    } catch {
      // keep fallback
    }

    const durationMinutes = Math.floor((callInfo.duration || 0) / 60);
    const durationSeconds = (callInfo.duration || 0) % 60;
    const durationText =
      callInfo.duration > 0
        ? `${durationMinutes.toString().padStart(2, '0')}:${durationSeconds.toString().padStart(2, '0')}`
        : '';

    let icon = isMine ? 'phone-outgoing' : 'phone-incoming';
    let color = '#4CAF50';
    let title = durationText ? `Video call • ${durationText}` : 'Video call';

    if (callInfo.callStatus === 'missed') {
      icon = 'phone-missed';
      color = '#F44336';
      title = 'Missed call';
    } else if (callInfo.callStatus === 'rejected') {
      icon = 'phone-cancel';
      color = '#F97316';
      title = 'Call rejected';
    } else if (callInfo.callStatus === 'cancelled') {
      icon = 'phone-cancel';
      color = '#F59E0B';
      title = 'Call cancelled';
    }

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onLongPress={() => handleMessageLongPress(message)}
        delayLongPress={260}
        style={styles.callMessageContainer}
      >
        <View
          style={[
            styles.callCard,
            isMine ? styles.callCardRight : styles.callCardLeft,
          ]}
        >
          <View style={[styles.callIconCircle, { backgroundColor: `${color}18` }]}>
            <Icon name={icon} size={22} color={color} />
          </View>
          <View style={styles.callTextWrap}>
            <Text
              style={[
                styles.callTitle,
                isMine && styles.callTitleRight,
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.callTime,
                isMine && styles.callTimeRight,
              ]}
            >
              {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleMessageLongPress]);

  const renderAvatar = useCallback(
    (props: any) => {
      const message = props.currentMessage as ExtendedMessage;
      const nextMessage = props.nextMessage as ExtendedMessage | undefined;
      const isMine = message.user._id === 'me' || message.user._id === currentUser;

      if (isMine) return null;

      const isLastInGroup =
        !nextMessage ||
        nextMessage?.user?._id !== message.user._id ||
        nextMessage.messageType === 'CALL' ||
        nextMessage.system === true;

      if (!isLastInGroup) {
        // Spacer giữ chỗ để các bubble trên thẳng hàng với bubble dưới có avatar
        return <View style={styles.avatarSpacer} />;
      }

      return (
        <Avatar
          name={isGroup ? (groupMemberNames[props.currentMessage.senderId] || props.currentMessage.senderId) : displayRecipientName}
          uri={isGroup ? groupMemberAvatars[props.currentMessage.senderId] : recipientAvatar}
          size="small"
        />
      );
    },
    [currentUser, displayRecipientName, recipientAvatar, groupMemberNames, groupMemberAvatars, isGroup],
  );

  const renderBubble = useCallback(
    (props: any) => {
      const message = props.currentMessage as ExtendedMessage;
      const nextMessage = props.nextMessage as ExtendedMessage | undefined;
      const isMine = message.user._id === 'me' || message.user._id === currentUser;
      const reactionEntries = Object.entries(message.reactions || {}).filter(
        ([, users]) => users.length > 0,
      );

      const isLastInGroup =
        !nextMessage ||
        nextMessage?.user?._id !== message.user._id ||
        nextMessage.messageType === 'CALL' ||
        nextMessage.system === true;

      if (message.messageType === 'AUTO_REPLY' || message.isAutoReply) {
        const autoReplyTimeText = new Date(message.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <View style={styles.autoReplyBubbleWrap}>
            <View style={styles.autoReplyBubble}>
              <View style={styles.autoReplyBubbleHeader}>
                <Icon name="robot" size={14} color="#6366F1" />
                <Text style={styles.autoReplyBubbleLabel}>Phản hồi tự động</Text>
              </View>
              <Text style={styles.autoReplyBubbleText}>{message.text}</Text>
              <Text style={styles.autoReplyBubbleTime}>{autoReplyTimeText}</Text>
            </View>
          </View>
        );
      }

      if (message.messageType === 'CALL') {
        return renderCallBubble(message, isMine);
      }

      const isMediaMessage =
        message.messageType === 'IMAGE' ||
        message.messageType === 'VIDEO' ||
        message.messageType === 'STICKER' ||
        message.messageType === 'FILE' ||
        message.messageType === 'AUDIO' ||
        !!message.image ||
        !!message.audio;

      const timeText = new Date(message.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <SwipeableMessage onReply={() => {
          setReplyTo(message);
        }}>
          <View style={{ marginBottom: reactionEntries.length > 0 ? 16 : 2 }}>
            {message.replyTo && (
              <View
                style={[
                  styles.replySnippet,
                  isMine ? styles.replySnippetMine : styles.replySnippetOther,
                ]}
              >
                <View style={styles.replySnippetBar} />
                <View style={styles.replySnippetContent}>
                  <Text style={styles.replySnippetName} numberOfLines={1}>
                    {message.replyTo.user.name || 'Message'}
                  </Text>
                  <Text style={styles.replySnippetText} numberOfLines={1}>
                    {message.replyTo.text || 'Attachment'}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => handleMessageLongPress(message)}
              delayLongPress={260}
            >
              {isMediaMessage ? (
                <Bubble
                  {...props}
                  wrapperStyle={{
                    left: styles.bubbleWrapperLeft,
                    right: styles.bubbleWrapperRight,
                  }}
                  textStyle={{
                    left: styles.bubbleTextLeft,
                    right: styles.bubbleTextRight,
                  }}
                />
              ) : (
                <View style={isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft}>
                  <Text style={isMine ? styles.bubbleTextRight : styles.bubbleTextLeft}>
                    {message.text}
                  </Text>
                  <View style={styles.bubbleBottom}>
                    <Text style={isMine ? styles.timeRight : styles.timeLeft}>
                      {timeText}
                    </Text>
                    {isMine && message.status && (
                      <MessageTicks
                        status={message.status}
                        size={12}
                        color="#5B9BD5"
                      />
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {reactionEntries.length > 0 && (
              <View
                style={[
                  styles.reactionRow,
                  isMine ? styles.reactionRowMine : styles.reactionRowOther,
                ]}
              >
                {reactionEntries.map(([emoji, users]) => (
                  <View key={emoji} style={styles.reactionBadge}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {users.length > 1 && (
                      <Text style={styles.reactionCount}>{users.length}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </SwipeableMessage>
      );
    },
    [currentUser, handleMessageLongPress, renderCallBubble],
  );

  const renderDay = useCallback(
    (props: any) => (
      <Day
        {...props}
        containerStyle={styles.dayContainer}
        wrapperStyle={styles.dayWrapper}
        textStyle={styles.dayText}
      />
    ),
    [],
  );

  const renderSystemMessage = useCallback(
    (props: any) => (
      <SystemMessage
        {...props}
        containerStyle={styles.systemMessageContainer}
        textStyle={styles.systemMessageText}
      />
    ),
    [],
  );

  const renderTime = useCallback(
    (props: any) => (
      <Time
        {...props}
        timeTextStyle={{
          left: styles.timeLeft,
          right: styles.timeRight,
        }}
      />
    ),
    [],
  );

  const renderCustomView = useCallback((props: any) => {
    const msg = props.currentMessage as ExtendedMessage;
    if (msg.messageType === 'FILE' && msg.mediaUrl) {
      return (
        <TouchableOpacity style={styles.fileCard} onPress={() => Linking.openURL(msg.mediaUrl!)} activeOpacity={0.8}>
          <View style={styles.fileIconWrap}>
            <Icon name="file-document-outline" size={32} color="#FFF" />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{msg.fileName || 'Document'}</Text>
            <Text style={styles.fileSize}>
              {msg.fileSize
                ? (msg.fileSize / 1024 > 1024
                    ? (msg.fileSize / 1024 / 1024).toFixed(2) + ' MB'
                    : (msg.fileSize / 1024).toFixed(0) + ' KB')
                : 'Unknown size'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  }, []);

  const renderMessageAudio = useCallback((props: any) => {
    const msg = props.currentMessage as ExtendedMessage;
    if (msg.audio) {
      return (
        <TouchableOpacity 
          style={styles.audioCard} 
          onPress={async () => {
            try {
              await audioRecorderPlayerRef.current.stopPlayer();
              await audioRecorderPlayerRef.current.startPlayer(msg.audio!);
              audioRecorderPlayerRef.current.addPlayBackListener((e) => {
                if (e.currentPosition === e.duration) {
                  audioRecorderPlayerRef.current.stopPlayer();
                  audioRecorderPlayerRef.current.removePlayBackListener();
                }
              });
            } catch (error) {
              console.error('Error playing audio', error);
            }
          }}
          activeOpacity={0.8}
        >
          <Icon name="play-circle" size={36} color="#1D6FD7" />
          <Text style={styles.audioText}>Tin nhắn thoại</Text>
        </TouchableOpacity>
      );
    }
    return null;
  }, []);

  const renderMessageImage = useCallback((props: any) => {
    const msg = props.currentMessage as ExtendedMessage;
    if (msg.image) {
      return (
        <TouchableOpacity onPress={() => setViewerImage(msg.image!)} activeOpacity={0.9}>
          <Image source={{ uri: msg.image }} style={styles.customImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }
    return null;
  }, []);

  const renderChatFooter = useCallback(() => <TypingIndicator isVisible={isTyping} />, [isTyping]);

  const renderInputToolbar = useCallback(
    (props: any) => (
      <InputToolbar
        {...props}
        containerStyle={[styles.inputToolbar, replyTo ? { flexDirection: 'column-reverse' } : undefined]}
        primaryStyle={styles.inputToolbarPrimary}
        renderAccessory={replyTo ? () => (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLeft}>
              <View style={styles.replyBarAccent} />
              <View style={styles.replyBarContent}>
                <View style={styles.replyBarHeader}>
                  <Icon name="reply" size={14} color="#1D6FD7" style={{ marginRight: 4 }} />
                  <Text style={styles.replyBarLabel}>Trả lời </Text>
                  <Text style={styles.replyBarName} numberOfLines={1}>
                    {replyTo.user._id === 'me' || replyTo.user._id === currentUser
                      ? 'Bạn'
                      : replyTo.user.name || recipientName}
                  </Text>
                </View>
                <Text style={styles.replyBarText} numberOfLines={2}>
                  {replyTo.messageType === 'IMAGE'
                    ? '📷 Hình ảnh'
                    : replyTo.messageType === 'VIDEO'
                      ? '🎬 Video'
                      : replyTo.messageType === 'FILE'
                        ? `📎 ${(replyTo as any).fileName || 'Tệp đính kèm'}`
                        : replyTo.messageType === 'STICKER'
                          ? '😄 Sticker'
                          : replyTo.text || 'Tệp đính kèm'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.replyBarClose}
              onPress={() => setReplyTo(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.replyBarCloseCircle}>
                <Icon name="close" size={14} color="#64748B" />
              </View>
            </TouchableOpacity>
          </View>
        ) : undefined}
      />
    ),
    [currentUser, recipientName, replyTo],
  );

  const onStartRecord = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        if (grants['android.permission.RECORD_AUDIO'] !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Lỗi', 'Cần cấp quyền ghi âm để sử dụng tính năng này.');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }

    try {
      setIsRecording(true);
      const uri = await audioRecorderPlayerRef.current.startRecorder();
      audioRecorderPlayerRef.current.addRecordBackListener((e) => {
        setRecordTime(audioRecorderPlayerRef.current.mmssss(Math.floor(e.currentPosition)));
      });
      console.log('Recording at:', uri);
    } catch (error) {
      console.error('Error starting record:', error);
      setIsRecording(false);
    }
  }, []);

  const onStopRecord = useCallback(async () => {
    if (!isRecording) return;
    try {
      const resultUri = await audioRecorderPlayerRef.current.stopRecorder();
      audioRecorderPlayerRef.current.removeRecordBackListener();
      setIsRecording(false);
      setRecordTime('00:00');
      console.log('Recording stopped:', resultUri);
      
      setIsUploading(true);
      const fakeAsset = {
        uri: resultUri,
        type: 'audio/mp4',
        fileName: `voice_${Date.now()}.mp4`,
      };
      
      const uploadResult = await uploadMedia(token, fakeAsset);
      
      if (uploadResult) {
        const optimisticId = createLocalMessageId();
        const optimisticMessage: ExtendedMessage = {
          _id: optimisticId,
          text: '',
          rawContent: '[Tin nhắn thoại]',
          createdAt: new Date(),
          user: { _id: 'me', name: currentUser },
          audio: uploadResult.mediaUrl,
          messageType: 'AUDIO',
          mediaUrl: uploadResult.mediaUrl,
          fileName: uploadResult.fileName,
          status: 'sent',
          ...(replyTo ? { replyTo: { _id: replyTo._id, text: replyTo.text || '', user: replyTo.user } } : {}),
        };

        setMessages(prev => GiftedChat.append(prev, [optimisticMessage]));
        setReplyTo(null);

        sendMessage({
          senderId: currentUser,
          receiverId: recipientId,
          content: '[Tin nhắn thoại]',
          conversationId,
          messageType: 'AUDIO',
          mediaUrl: uploadResult.mediaUrl,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          ...(replyTo ? { replyToId: replyTo._id, replyToText: replyTo.text || '', replyToSender: replyTo.user.name } : {}),
        });
      }
    } catch (error) {
      console.error('Error stopping record:', error);
      setIsRecording(false);
      setRecordTime('00:00');
    } finally {
      setIsUploading(false);
    }
  }, [isRecording, token, currentUser, recipientId, conversationId, replyTo, sendMessage]);

  const renderComposer = useCallback(
    (props: any) => (
      <View style={styles.composerRow}>
        {!isRecording && (
          <TouchableOpacity
            onPress={toggleAttachMenu}
            style={styles.attachBtn}
            activeOpacity={0.6}
          >
            <Icon name="paperclip" size={24} color="#8E99A4" />
          </TouchableOpacity>
        )}
        <View style={styles.composerShell}>
          {isRecording ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
              <View style={[styles.recordingDot]} />
              <Text style={styles.recordingText}>Đang ghi âm... {recordTime}</Text>
            </View>
          ) : (
            <Composer
              {...props}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#A0AEC0"
              textInputStyle={styles.composerInput}
              onTextChanged={(text: string) => {
                setInputText(text);
                props.onTextChanged?.(text);
              }}
            />
          )}
          {!isRecording && (
            <TouchableOpacity
              onPress={() => setShowStickerPicker(true)}
              style={styles.emojiBtn}
              activeOpacity={0.6}
            >
              <Icon name="emoticon-outline" size={24} color="#8E99A4" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [inputText, toggleAttachMenu, isRecording, recordTime],
  );

  const renderSend = useCallback(
    (props: any) => {
      if (isRecording) {
        return (
          <View style={styles.sendContainer}>
            <TouchableOpacity style={[styles.actionFab, { backgroundColor: '#FF3B30' }]} activeOpacity={0.7} onPress={onStopRecord}>
              <Icon name="stop" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        );
      }

      if (!inputText.trim()) {
        return (
          <View style={styles.sendContainer}>
            <TouchableOpacity style={styles.actionFab} activeOpacity={0.7} onPress={onStartRecord}>
              <Icon name="microphone" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <Send {...props} containerStyle={styles.sendContainer}>
          <View style={styles.actionFab}>
            <Icon name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </Send>
      );
    },
    [inputText, isRecording, onStartRecord, onStopRecord],
  );

  const attachmentItems = useMemo(
    () => [
      { icon: 'image-multiple', label: 'Gallery', color: '#2D7FF9', onPress: openLibrary },
      { icon: 'camera', label: 'Camera', color: '#EC4899', onPress: openCamera },
      { icon: 'file-document-outline', label: 'File', color: '#FB923C', onPress: openDocumentPicker },
      {
        icon: 'video-outline',
        label: 'Video',
        color: '#8B5CF6',
        onPress: async () => {
          try {
            const result = await launchImageLibrary({ mediaType: 'video', quality: 0.8 });
            const asset = result.assets?.[0];
            if (!asset?.uri) {
              return;
            }

            await handleMediaSend({
              uri: asset.uri,
              fileName: asset.fileName || 'video.mp4',
              type: asset.type || 'video/mp4',
              fileSize: asset.fileSize,
            });
          } catch {
            Alert.alert('Video', 'Cannot pick video.');
          }
        },
      },
      {
        icon: 'sticker-emoji',
        label: 'Sticker',
        color: '#F59E0B',
        onPress: () => {
          toggleAttachMenu();
          setShowStickerPicker(true);
        },
      },
      {
        icon: 'map-marker-outline',
        label: 'Location',
        color: '#22C55E',
        onPress: () => Alert.alert('Coming soon', 'Location sharing is not ready yet.'),
      },
    ],
    [handleMediaSend, openCamera, openDocumentPicker, openLibrary, toggleAttachMenu],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#004A82" />

      <View style={styles.wallpaperLayer} />

      <Animated.View style={[styles.headerWrap, { opacity: headerAnim }]}>
        <LinearGradient
          colors={['#004A82', '#0066B3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerMain}
            activeOpacity={0.82}
            onPress={() => {
              if (isGroup) {
                navigation.navigate('GroupSettings', {
                  conversationId,
                  groupName: displayRecipientName,
                });
              } else {
                // Future profile settings navigation for 1-1 chat
              }
            }}
          >
            <Avatar
              name={displayRecipientName}
              uri={recipientAvatar}
              size="medium"
              isOnline={recipientPresence.status === 'ONLINE'}
              showOnlineStatus
            />
            <View style={styles.headerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text numberOfLines={1} style={styles.headerName}>
                  {displayRecipientName}
                </Text>
                {isMuted && (
                  <Icon name="bell-off-outline" size={14} color="#A0AEC0" style={{ marginLeft: 4, marginTop: 1 }} />
                )}
              </View>
              <View style={styles.headerMetaRow}>
                {lecturerStatus ? (
                  <StatusBadge status={lecturerStatus} compact />
                ) : (
                  <Text style={styles.headerMetaText}>{presenceText}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => {
                const roomName = `IUHConnect_${recipientId}_${Date.now()}`;
                navigation.navigate('Meeting', {
                  callerId: recipientId,
                  callerName: displayRecipientName,
                  callerAvatar: recipientAvatar,
                  roomName,
                  conversationId,
                });
              }}
            >
              <Icon name="video-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            {isGroup && (
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={handleAISummarize}
              >
                <Icon name="robot-outline" size={22} color="#FACC15" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => {
                if (!isOffline) {
                  if (isGroup) {
                    navigation.navigate('GroupSettings', {
                      conversationId,
                      groupName: displayRecipientName,
                    });
                  } else {
                    navigation.navigate('ChatSettings', {
                      conversationId,
                      recipientId,
                      recipientName: displayRecipientName,
                    });
                  }
                }
              }}
            >
              <Icon name={isOffline ? 'wifi-off' : 'dots-vertical'} size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <OfflineBanner isOffline={isOffline} />

      {activeMeeting && (
        <TouchableOpacity
          style={styles.activeMeetingBanner}
          onPress={() => {
            navigation.navigate('Meeting', {
              callerId: recipientId,
              callerName: displayRecipientName,
              callerAvatar: recipientAvatar,
              roomName: activeMeeting.roomName,
              meetingId: activeMeeting.meetingId,
              isIncoming: false,
              isLateJoin: true,
              conversationId,
            });
          }}
        >
          <Icon name="video" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.activeMeetingBannerText}>Cuộc gọi nhóm đang diễn ra. Tham gia ngay!</Text>
        </TouchableOpacity>
      )}

      {(lecturerStatus === 'busy' || recipientPresence.status === 'BUSY') && (
        <View style={styles.busyBanner}>
          <Icon name="clock-alert-outline" size={16} color="#B45309" />
          <Text style={styles.busyBannerText}>
            Giảng viên đang bận. Tin nhắn sẽ được phản hồi tự động.
          </Text>
        </View>
      )}

      <GiftedChat
        messages={messages}
        onSend={newMessages => onSend(newMessages)}
        user={{ _id: 'me', name: currentUser }}
        loadEarlier={hasEarlierMessages}
        isLoadingEarlier={isLoadingEarlier}
        onLoadEarlier={onLoadEarlier}
        renderBubble={renderBubble}
        renderDay={renderDay}
        renderSystemMessage={renderSystemMessage}
        renderTime={renderTime}
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        renderChatFooter={renderChatFooter}
        renderCustomView={renderCustomView}
        renderMessageAudio={renderMessageAudio}
        renderMessageImage={renderMessageImage}
        renderAvatar={renderAvatar}
        onInputTextChanged={setInputText}
        extraData={replyTo}
        bottomOffset={0}
        minInputToolbarHeight={62}
        messagesContainerStyle={styles.messagesContainer}
        listViewProps={{
          showsVerticalScrollIndicator: false,
          contentContainerStyle: styles.listContentContainer,
        }}
        alwaysShowSend
        scrollToBottom
        scrollToBottomStyle={styles.scrollToBottomBtn}
      />

      <Modal
        visible={showMessageActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageActions(false)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMessageActions(false)}
        >
          <View style={styles.actionModal}>
            <View style={styles.reactionPickerRow}>
              {REACTION_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPickerButton}
                  onPress={() => handleReaction(emoji)}
                >
                  <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.actionItem} onPress={handleReply}>
              <Icon name="reply-outline" size={20} color="#1D6FD7" />
              <Text style={styles.actionItemText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={handleForward}>
              <Icon name="share-outline" size={20} color="#1D6FD7" />
              <Text style={styles.actionItemText}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={handleCopyText}>
              <Icon name="content-copy" size={20} color="#1D6FD7" />
              <Text style={styles.actionItemText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAttachMenu}
        transparent
        animationType="none"
        onRequestClose={toggleAttachMenu}
      >
        <TouchableOpacity
          style={styles.attachOverlay}
          activeOpacity={1}
          onPress={toggleAttachMenu}
        >
          <Animated.View
            style={[
              styles.attachSheet,
              {
                opacity: attachMenuAnim,
                transform: [
                  {
                    translateY: attachMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [280, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.attachHandle} />
            <Text style={styles.attachTitle}>Attachments</Text>
            <View style={styles.attachGrid}>
              {attachmentItems.map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.attachItem}
                  onPress={item.onPress}
                >
                  <LinearGradient
                    colors={[item.color, `${item.color}DD`]}
                    style={styles.attachIconWrap}
                  >
                    <Icon name={item.icon} size={25} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.attachLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={(sticker, type) => handleStickerSend(sticker, type)}
      />

      <Modal
        visible={showSummaryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSummaryModal(false)}
        >
          <View style={[styles.actionModal, { padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="robot-outline" size={24} color="#1D6FD7" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#172233' }}>AI Tóm Tắt Nhóm</Text>
            </View>
            {isSummarizing ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1D6FD7" />
                <Text style={{ marginTop: 12, color: '#475569', fontSize: 14 }}>AI đang đọc tin nhắn...</Text>
              </View>
            ) : (
              <View>
                <Text style={{ color: '#334155', fontSize: 14, lineHeight: 22, minHeight: 60 }}>
                  {summaryText}
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 20,
                    backgroundColor: '#1D6FD7',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => setShowSummaryModal(false)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Đóng</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadCard}>
            <ActivityIndicator size="large" color="#1D6FD7" />
            <Text style={styles.uploadText}>Uploading...</Text>
          </View>
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)}>
        <View style={styles.viewerContainer}>
          <TouchableOpacity 
            style={styles.viewerCloseBtn} 
            onPress={() => setViewerImage(null)}
          >
            <Icon name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {viewerImage && (
            <Image 
              source={{ uri: viewerImage }} 
              style={styles.viewerImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8ECF1',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '500',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004A82',
    borderRadius: 12,
    padding: 12,
    margin: 4,
    maxWidth: 240,
  },
  fileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#E0E7FF',
    marginTop: 2,
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 16,
    margin: 4,
    minWidth: 150,
  },
  audioText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  customImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    margin: 4,
  },
  wallpaperLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8ECF1',
    opacity: 1,
  },
  headerWrap: {
    zIndex: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  headerMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMetaText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7E8',
    borderBottomWidth: 1,
    borderBottomColor: '#F7D7A1',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  busyBannerText: {
    flex: 1,
    color: '#9A5B08',
    fontSize: 12,
    fontWeight: '500',
  },
  activeMeetingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activeMeetingBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContentContainer: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  messagesContainer: {
    paddingHorizontal: 4,
  },
  scrollToBottomBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  messageBlock: {
    opacity: 1,
  },
  messageContainer: {
    width: '100%',
    opacity: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    gap: 6,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
    paddingRight: 8,
  },
  messageRowOther: {
    justifyContent: 'flex-start',
    paddingLeft: 8,
  },
  messageBubbleWrapper: {
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  avatarSpacer: {
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
    marginVertical: 2,
  },
  bubbleRowReverse: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubbleContent: {
    flexShrink: 1,
    maxWidth: '85%',
  },
  bubbleWrapperLeft: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: 280,
  },
  bubbleWrapperRight: {
    backgroundColor: '#D4E8FC',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-end',
    maxWidth: 280,
  },
  bubbleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleLeft: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Shadows.xs,
  },
  bubbleRight: {
    backgroundColor: '#1976D2',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  bubbleTextLeft: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.08,
  },
  bubbleTextRight: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.08,
  },
  tickWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 4,
  },
  timeLeft: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '400',
  },
  timeRight: {
    color: '#6B8BB5',
    fontSize: 11,
    fontWeight: '400',
  },
  dayContainer: {
    marginVertical: 10,
  },
  dayWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  systemMessageContainer: {
    marginBottom: 10,
  },
  systemMessageText: {
    color: '#7A8DA4',
    fontSize: 12,
    fontStyle: 'italic',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F6FF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(29, 111, 215, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    paddingRight: 8,
    paddingVertical: 0,
    minHeight: 52,
  },
  replyBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  replyBarAccent: {
    width: 3.5,
    backgroundColor: '#1D6FD7',
    borderRadius: 0,
  },
  replyBarContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  replyBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  replyBarLabel: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '500',
  },
  replyBarName: {
    color: '#1D6FD7',
    fontSize: 12.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  replyBarText: {
    color: '#475569',
    fontSize: 13.5,
    lineHeight: 19,
  },
  replyBarClose: {
    padding: 4,
    marginLeft: 4,
  },
  replyBarCloseCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySnippet: {
    flexDirection: 'row',
    maxWidth: '84%',
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  replySnippetMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  replySnippetOther: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(25, 111, 212, 0.08)',
  },
  replySnippetBar: {
    width: 3,
    borderRadius: 3,
    backgroundColor: '#1D6FD7',
    marginRight: 8,
  },
  replySnippetContent: {
    flex: 1,
  },
  replySnippetName: {
    color: '#1D6FD7',
    fontSize: 12,
    fontWeight: '700',
  },
  replySnippetText: {
    color: '#6B7A8D',
    fontSize: 12,
    marginTop: 1,
  },
  reactionRow: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
  },
  reactionRowMine: {
    right: -8,
  },
  reactionRowOther: {
    left: -8,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    marginLeft: 3,
    color: '#617286',
    fontSize: 11,
    fontWeight: '700',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  attachBtn: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingLeft: 12,
    paddingRight: 4,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
    lineHeight: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: 'transparent',
    marginLeft: 0,
    marginRight: 0,
  },
  inputToolbar: {
    backgroundColor: '#E8ECF1',
    borderTopWidth: 0,
    paddingHorizontal: 4,
    paddingTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 8 : 5,
  },
  inputToolbarPrimary: {
    alignItems: 'flex-end',
    minHeight: 52,
  },
  sendContainer: {
    height: 52,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 2,
  },
  actionFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callMessageContainer: {
    maxWidth: '78%',
    marginVertical: 4,
    paddingHorizontal: 2,
    alignSelf: 'flex-start',
  },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 58,
    maxWidth: 260,
  },
  callCardLeft: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderBottomLeftRadius: 6,
    ...Shadows.xs,
  },
  callCardRight: {
    backgroundColor: '#1D6FD7',
    borderBottomRightRadius: 6,
  },
  callIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  callTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  callTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '700',
  },
  callTitleRight: {
    color: '#FFFFFF',
  },
  callTime: {
    color: '#7A8A9E',
    fontSize: 11,
    marginTop: 2,
  },
  callTimeRight: {
    color: 'rgba(255,255,255,0.72)',
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  reactionPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 4,
  },
  reactionPickerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerEmoji: {
    fontSize: 22,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionItemText: {
    marginLeft: 14,
    color: '#172233',
    fontSize: 15,
    fontWeight: '600',
  },
  attachOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  attachSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 12,
  },
  attachHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5DEE8',
    alignSelf: 'center',
    marginBottom: 18,
  },
  attachTitle: {
    color: '#172233',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  attachItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 18,
  },
  attachIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachLabel: {
    color: '#425466',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 36,
    paddingVertical: 28,
    alignItems: 'center',
    ...Shadows.lg,
  },
  uploadText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  swipeableWrapper: {
    position: 'relative',
  },
  swipeReplyAction: {
    position: 'absolute',
    left: -8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
  },
  swipeReplyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(29, 111, 215, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // UC11: Auto-Reply Bubble Styles
  autoReplyBubbleWrap: {
    alignItems: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  autoReplyBubble: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  autoReplyBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  autoReplyBubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autoReplyBubbleText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  autoReplyBubbleTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});

export default ChatScreen;