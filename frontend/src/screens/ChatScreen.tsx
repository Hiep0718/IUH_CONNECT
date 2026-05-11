import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { GiftedChat, IMessage, Bubble, InputToolbar, Composer, Send, Time, SystemMessage, Day } from 'react-native-gifted-chat';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import OfflineBanner from '../components/OfflineBanner';
import MessageTicks from '../components/MessageTicks';
import TypingIndicator from '../components/TypingIndicator';
import type { MessageStatus, LecturerStatus } from '../types/types';
import { API_URL } from '../config/env';
import { useWebSocket } from '../services/WebSocketProvider';
import { isCallSignal } from '../services/callSignaling';

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

interface ExtendedMessage extends IMessage {
  status?: MessageStatus;
  isOffline?: boolean;
  isAutoReply?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

// Removed createMockMessages

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
    isOnline = false,
    lecturerStatus,
    isGroup = false,
  } = route.params;

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const attachMenuAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Dùng global WebSocket thay vì tạo WS riêng
  const { sendMessage, addListener, removeListener, isConnected } = useWebSocket();
  const isOffline = !isConnected;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/chat/history/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const historyMsgs: ExtendedMessage[] = data.map((msg: any) => ({
            _id: msg.id,
            text: msg.content,
            createdAt: new Date(msg.timestamp),
            user: {
              _id: msg.senderId === currentUser ? 'me' : msg.senderId,
              name: msg.senderId === currentUser ? 'Me' : msg.senderId,
            },
            status: 'read',
          }));
          
          if (lecturerStatus === 'busy') {
             historyMsgs.unshift({
               _id: 'auto-1',
               text: '⏰ Tự động phản hồi: Giảng viên hiện đang bận. Tin nhắn sẽ được phản hồi sớm.',
               createdAt: new Date(),
               user: { _id: recipientId, name: recipientName },
               system: true,
               isAutoReply: true,
             });
          }
          setMessages(historyMsgs);
        }
      } catch (error) {
        console.error('Failed to fetch history', error);
      }
    };

    fetchHistory();
  }, [conversationId, token, currentUser, recipientId, recipientName, lecturerStatus]);

  // Subscribe tới global WebSocket — chỉ nhận chat messages
  // Incoming call được xử lý ở WebSocketProvider (global coordinator)
  useEffect(() => {
    const listenerId = 'chat-' + conversationId;

    const handler = (data: any) => {
      // Bỏ qua call signals — đã xử lý ở global level
      if (isCallSignal(data)) return;

      // Chỉ nhận message thuộc conversation hiện tại
      if (data.conversationId !== conversationId) return;

      const incomingMessage: ExtendedMessage = {
        _id: `${data.conversationId}-${data.timestamp}-${Date.now()}`,
        text: data.content,
        createdAt: new Date(data.timestamp || Date.now()),
        user: {
          _id: data.senderId,
          name: data.senderId,
        },
        status: 'delivered' as MessageStatus,
      };
      setMessages((prev) => GiftedChat.append(prev, [incomingMessage]));
    };

    addListener(listenerId, handler);
    return () => removeListener(listenerId);
  }, [conversationId, addListener, removeListener]);

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      const extendedMessages: ExtendedMessage[] = newMessages.map((msg) => ({
        ...msg,
        status: isOffline ? ('sending' as MessageStatus) : ('sent' as MessageStatus),
        isOffline: isOffline,
      }));

      setMessages((prev) => GiftedChat.append(prev, extendedMessages));

      // Gửi qua global WebSocket
      newMessages.forEach((msg) => {
        sendMessage({
          senderId: currentUser,
          receiverId: recipientId,
          content: msg.text,
          conversationId: conversationId,
        });
      });

      if (!isOffline) {
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              extendedMessages.find((em) => em._id === m._id)
                ? { ...m, status: 'delivered' as MessageStatus }
                : m,
            ),
          );
        }, 1000);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              extendedMessages.find((em) => em._id === m._id)
                ? { ...m, status: 'read' as MessageStatus }
                : m,
            ),
          );
        }, 3000);
      }
    },
    [isOffline, currentUser, recipientId, conversationId, sendMessage],
  );

  // isOffline giờ dựa trên isConnected từ WebSocket — không toggle thủ công nữa

  const toggleAttachMenu = () => {
    const toValue = showAttachMenu ? 0 : 1;
    Animated.spring(attachMenuAnim, {
      toValue,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
    setShowAttachMenu(!showAttachMenu);
  };

  // Custom bubble
  const renderBubble = (props: any) => {
    const message = props.currentMessage as ExtendedMessage;
    const isMine = message.user._id === 'me' || message.user._id === currentUser;
    const messageIsOffline = message.isOffline;

    return (
      <View style={{ opacity: messageIsOffline ? 0.5 : 1, marginBottom: 2 }}>
        <Bubble
          {...props}
          wrapperStyle={{
            left: {
              backgroundColor: message.isAutoReply
                ? 'rgba(100, 116, 139, 0.08)'
                : Colors.chatBubbleReceived,
              borderRadius: 20,
              borderBottomLeftRadius: 6,
              paddingHorizontal: 2,
              paddingVertical: 2,
              ...Shadows.xs,
            },
            right: {
              backgroundColor: Colors.chatBubbleSent,
              borderRadius: 20,
              borderBottomRightRadius: 6,
              paddingHorizontal: 2,
              paddingVertical: 2,
              ...Shadows.sm,
            },
          }}
          textStyle={{
            left: {
              color: message.isAutoReply
                ? Colors.textMuted
                : Colors.chatBubbleReceivedText,
              fontSize: message.isAutoReply ? 13 : 15,
              fontStyle: message.isAutoReply ? 'italic' : 'normal',
              lineHeight: 21,
            },
            right: {
              color: Colors.chatBubbleSentText,
              fontSize: 15,
              lineHeight: 21,
            },
          }}
        />
        {/* Status Ticks */}
        {isMine && message.status && (
          <View style={styles.tickContainer}>
            {messageIsOffline && (
              <Icon
                name="clock-outline"
                size={12}
                color={Colors.textMuted}
                style={{ marginRight: 4 }}
              />
            )}
            <MessageTicks status={message.status} size={14} />
          </View>
        )}
      </View>
    );
  };

  // Custom day separator
  const renderDay = (props: any) => (
    <Day
      {...props}
      containerStyle={styles.daySeparatorContainer}
      textStyle={styles.daySeparatorText}
      wrapperStyle={styles.daySeparatorWrapper}
    />
  );

  // Custom input toolbar
  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={styles.inputToolbarPrimary}
    />
  );

  // Custom composer
  const renderComposer = (props: any) => (
    <View style={styles.composerContainer}>
      <TouchableOpacity onPress={toggleAttachMenu} style={styles.attachButton}>
        <Icon name="plus-circle-outline" size={26} color={Colors.primary} />
      </TouchableOpacity>
      <Composer
        {...props}
        textInputStyle={styles.composerInput}
        placeholder="Nhập tin nhắn..."
        placeholderTextColor={Colors.textMuted}
      />
      <TouchableOpacity style={styles.emojiButton}>
        <Icon name="emoticon-happy-outline" size={24} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  // Custom send button
  const renderSend = (props: any) => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <LinearGradient
        colors={['#0077CC', '#004A82']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sendButton}
      >
        <Icon name="send" size={18} color={Colors.white} style={{ marginLeft: 2 }} />
      </LinearGradient>
    </Send>
  );

  // Custom time
  const renderTime = (props: any) => (
    <Time
      {...props}
      timeTextStyle={{
        left: { color: Colors.textMuted, fontSize: 10, fontWeight: '400' },
        right: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '400' },
      }}
    />
  );

  // Custom system message
  const renderSystemMessage = (props: any) => (
    <SystemMessage
      {...props}
      containerStyle={styles.systemMessageContainer}
      textStyle={styles.systemMessageText}
    />
  );

  const renderChatFooter = () => (
    <TypingIndicator isVisible={isTyping} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Chat Header */}
      <Animated.View style={{ opacity: headerAnim }}>
        <LinearGradient
          colors={['#004A82', '#0066B3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerProfile} activeOpacity={0.7}>
            <Avatar
              name={recipientName}
              uri={recipientAvatar}
              size="medium"
              isOnline={isOnline}
              showOnlineStatus
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {recipientName}
              </Text>
              <View style={styles.headerStatusRow}>
                {lecturerStatus ? (
                  <StatusBadge status={lecturerStatus} compact />
                ) : (
                  <Text style={styles.headerStatus}>
                    {isOnline ? '● Đang hoạt động' : 'Ngoại tuyến'}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => {
                const roomName = `IUHConnect_${recipientId}_${Date.now()}`;
                navigation.navigate('Meeting', {
                  callerId: recipientId,
                  callerName: recipientName,
                  callerAvatar: recipientAvatar,
                  roomName: roomName,
                });
              }}
            >
              <Icon name="video-outline" size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => {}}
            >
              <Icon
                name={isOffline ? 'wifi-off' : 'dots-vertical'}
                size={20}
                color={Colors.white}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Offline Banner */}
      <OfflineBanner isOffline={isOffline} onRetry={() => {}} />

      {/* Busy Notice */}
      {lecturerStatus === 'busy' && (
        <View style={styles.busyNotice}>
          <Icon name="clock-alert-outline" size={16} color={Colors.warning} />
          <Text style={styles.busyNoticeText}>
            Giảng viên đang bận — Tin nhắn sẽ được tự động phản hồi
          </Text>
        </View>
      )}

      {/* Quick Reactions Bar */}
      <View style={styles.reactionsBar}>
        {QUICK_REACTIONS.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={styles.reactionButton}
            activeOpacity={0.6}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chat Messages */}
      <GiftedChat
        messages={messages}
        onSend={(newMessages: IMessage[]) => onSend(newMessages)}
        user={{ _id: 'me', name: currentUser }}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        renderTime={renderTime}
        renderDay={renderDay}
        renderSystemMessage={renderSystemMessage}
        renderChatFooter={renderChatFooter}
        messagesContainerStyle={styles.messagesContainer}
        listViewProps={{
          showsVerticalScrollIndicator: false,
        }}
      />

      {/* Attachment Menu Modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="none"
        onRequestClose={toggleAttachMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleAttachMenu}
        >
          <Animated.View
            style={[
              styles.attachMenuContainer,
              {
                transform: [{
                  translateY: attachMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                }],
                opacity: attachMenuAnim,
              },
            ]}
          >
            <View style={styles.attachMenuHandle} />
            <Text style={styles.attachMenuTitle}>Đính kèm tệp</Text>
            <View style={styles.attachMenuGrid}>
              {[
                { icon: 'image', label: 'Ảnh', color: '#4CAF50', hint: 'Từ thư viện' },
                { icon: 'file-document-outline', label: 'Tài liệu', color: '#2196F3', hint: 'PDF, DOCX' },
                { icon: 'camera-outline', label: 'Camera', color: '#FF9800', hint: 'Chụp ảnh' },
                { icon: 'map-marker-outline', label: 'Vị trí', color: '#E91E63', hint: 'Chia sẻ' },
                { icon: 'account-box-outline', label: 'Liên hệ', color: '#9C27B0', hint: 'Danh bạ' },
                { icon: 'poll', label: 'Bình chọn', color: '#00BCD4', hint: 'Tạo poll' },
              ].map((item, index) => (
                <TouchableOpacity key={index} style={styles.attachMenuItem}>
                  <LinearGradient
                    colors={[item.color, `${item.color}DD`]}
                    style={styles.attachMenuIcon}
                  >
                    <Icon name={item.icon} size={26} color={Colors.white} />
                  </LinearGradient>
                  <Text style={styles.attachMenuLabel}>{item.label}</Text>
                  <Text style={styles.attachMenuHint}>{item.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.chatBackground,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.xs,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  headerName: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerStatus: {
    fontSize: Typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerActionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Busy notice
  busyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningSoft,
  },
  busyNoticeText: {
    fontSize: Typography.caption,
    color: Colors.warning,
    fontWeight: Typography.medium,
    flex: 1,
  },
  // Quick reactions
  reactionsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reactionButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  // Messages
  messagesContainer: {
    paddingBottom: Spacing.xs,
  },
  // Tick container
  tickContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: Spacing.sm,
    marginTop: -4,
    marginBottom: 4,
  },
  // Day separator
  daySeparatorContainer: {
    marginVertical: Spacing.md,
  },
  daySeparatorWrapper: {
    backgroundColor: Colors.chatDateBadge,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  daySeparatorText: {
    fontSize: Typography.tiny,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  // Input toolbar
  inputToolbar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  inputToolbarPrimary: {
    alignItems: 'center',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachButton: {
    padding: Spacing.sm,
  },
  emojiButton: {
    padding: Spacing.sm,
  },
  composerInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
    maxHeight: 100,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // System message
  systemMessageContainer: {
    marginBottom: Spacing.md,
  },
  systemMessageText: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  attachMenuContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.huge,
    paddingTop: Spacing.md,
  },
  attachMenuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  attachMenuTitle: {
    fontSize: Typography.h4,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  attachMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  attachMenuItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: Spacing.xxl,
  },
  attachMenuIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  attachMenuLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  attachMenuHint: {
    fontSize: Typography.tiny,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default ChatScreen;
