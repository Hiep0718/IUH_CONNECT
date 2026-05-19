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
  Image,
  Linking,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { GiftedChat, IMessage, Bubble, InputToolbar, Composer, Send, Time, SystemMessage, Day, Message } from 'react-native-gifted-chat';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import OfflineBanner from '../components/OfflineBanner';
import MessageTicks from '../components/MessageTicks';
import TypingIndicator from '../components/TypingIndicator';
import StickerPicker from '../components/StickerPicker';
import type { MessageStatus, LecturerStatus } from '../types/types';
import { API_URL } from '../config/env';
import { useWebSocket } from '../services/WebSocketProvider';
import { isCallSignal } from '../services/callSignaling';
import { uploadMedia, getMessageTypeFromMime } from '../services/mediaUploadService';
import { authFetch } from '../services/authService';

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
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
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
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recipientPresence, setRecipientPresence] = useState<{status: string; lastSeen: number}>({status: 'OFFLINE', lastSeen: 0});
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

  // Fetch recipient presence
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/presence/${recipientId}`);
        if (res.ok) {
          const data = await res.json();
          setRecipientPresence({ status: data.status, lastSeen: data.lastSeen });
        }
      } catch (e) { /* ignore */ }
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [recipientId]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/v1/chat/history/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const historyMsgs: ExtendedMessage[] = data.map((msg: any) => {
            const isStickerImage = msg.messageType === 'STICKER' && msg.content && msg.content.startsWith('http');
            const isCallMsg = msg.messageType === 'CALL';
            return {
              _id: msg.id,
              text: isCallMsg ? msg.content
                  : msg.messageType === 'IMAGE' ? '📷 Hình ảnh'
                  : msg.messageType === 'VIDEO' ? '🎬 Video'
                  : msg.messageType === 'FILE' ? '📎 ' + (msg.fileName || 'Tệp')
                  : isStickerImage ? ''
                  : msg.content,
              createdAt: new Date(msg.timestamp),
              user: {
                _id: msg.senderId === currentUser ? 'me' : msg.senderId,
                name: msg.senderId === currentUser ? 'Me' : msg.senderId,
              },
              status: 'read',
              image: msg.messageType === 'IMAGE' ? msg.mediaUrl : (isStickerImage ? msg.content : undefined),
              messageType: msg.messageType || 'TEXT',
              mediaUrl: msg.mediaUrl,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              mimeType: msg.mimeType,
            };
          });
          
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

      const isStickerImage = data.messageType === 'STICKER' && data.content && data.content.startsWith('http');
      const isCallMsg = data.messageType === 'CALL';
      const incomingMessage: ExtendedMessage = {
        _id: `${data.conversationId}-${data.timestamp}-${Date.now()}`,
        text: isCallMsg ? data.content
            : data.messageType === 'IMAGE' ? '📷 Hình ảnh'
            : data.messageType === 'VIDEO' ? '🎬 Video'
            : data.messageType === 'FILE' ? '📎 ' + (data.fileName || 'Tệp')
            : isStickerImage ? ''
            : data.content,
        createdAt: new Date(data.timestamp || Date.now()),
        user: {
          _id: data.senderId,
          name: data.senderId,
        },
        status: 'delivered' as MessageStatus,
        image: data.messageType === 'IMAGE' ? data.mediaUrl : (isStickerImage ? data.content : undefined),
        messageType: data.messageType || 'TEXT',
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
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

  // ---- Media upload & send ----
  const handleMediaSend = useCallback(async (file: { uri: string; fileName: string; type: string; fileSize?: number }) => {
    if (!token) return;
    setIsUploading(true);
    try {
      const result = await uploadMedia(token, file);
      const msgType = getMessageTypeFromMime(result.mimeType);
      const msgId = `media-${Date.now()}`;

      const mediaMessage: ExtendedMessage = {
        _id: msgId,
        text: msgType === 'IMAGE' ? '📷 Hình ảnh' : msgType === 'VIDEO' ? '🎬 Video' : '📎 ' + result.fileName,
        createdAt: new Date(),
        user: { _id: 'me', name: currentUser },
        image: msgType === 'IMAGE' ? result.mediaUrl : undefined,
        messageType: msgType,
        mediaUrl: result.mediaUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        status: 'sent' as MessageStatus,
      };

      setMessages((prev) => GiftedChat.append(prev, [mediaMessage]));

      sendMessage({
        senderId: currentUser,
        receiverId: recipientId,
        content: msgType === 'IMAGE' ? '📷 Hình ảnh' : '📎 ' + result.fileName,
        conversationId,
        messageType: msgType,
        mediaUrl: result.mediaUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (error: any) {
      Alert.alert('Lỗi upload', error.message || 'Không thể upload file');
    } finally {
      setIsUploading(false);
      setShowAttachMenu(false);
    }
  }, [token, currentUser, recipientId, conversationId, sendMessage]);

  // ---- Sticker send ----
  const handleStickerSend = useCallback((sticker: string, type: 'emoji' | 'sticker') => {
    const msgId = `sticker-${Date.now()}`;
    const isImageSticker = type === 'sticker';
    
    const stickerMessage: ExtendedMessage = {
      _id: msgId,
      text: isImageSticker ? '' : sticker,
      image: isImageSticker ? sticker : undefined,
      createdAt: new Date(),
      user: { _id: 'me', name: currentUser },
      messageType: 'STICKER',
      status: 'sent' as MessageStatus,
    };
    setMessages((prev) => GiftedChat.append(prev, [stickerMessage]));
    sendMessage({
      senderId: currentUser,
      receiverId: recipientId,
      content: sticker,
      conversationId,
      messageType: 'STICKER',
    });
  }, [currentUser, recipientId, conversationId, sendMessage]);

  // ---- Presence text helper ----
  const getPresenceText = () => {
    if (recipientPresence.status === 'ONLINE') return '● Đang hoạt động';
    if (recipientPresence.lastSeen > 0) {
      const mins = Math.floor((Date.now() - recipientPresence.lastSeen) / 60000);
      if (mins < 1) return 'Vừa hoạt động';
      if (mins < 60) return `Hoạt động ${mins} phút trước`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Hoạt động ${hours} giờ trước`;
      return 'Ngoại tuyến';
    }
    return 'Ngoại tuyến';
  };

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
      <TouchableOpacity style={styles.emojiButton} onPress={() => setShowStickerPicker(true)}>
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

  // Custom call message bubble
  const renderMessage = (props: any) => {
    const message = props.currentMessage as ExtendedMessage;
    if (message.messageType === 'CALL') {
      let callInfo = { callStatus: 'completed', duration: 0, isIncoming: false, callerName: '' };
      try {
        callInfo = JSON.parse(message.text || '{}');
      } catch { /* fallback */ }

      const isMine = message.user._id === 'me' || message.user._id === currentUser;
      const durationMins = Math.floor((callInfo.duration || 0) / 60);
      const durationSecs = (callInfo.duration || 0) % 60;
      const durationStr = callInfo.duration > 0 ? `${durationMins.toString().padStart(2, '0')}:${durationSecs.toString().padStart(2, '0')}` : '';

      let statusIcon = 'phone';
      let statusColor = Colors.success;
      let statusText = '';

      switch (callInfo.callStatus) {
        case 'completed':
          statusIcon = isMine ? 'phone-outgoing' : 'phone-incoming';
          statusColor = Colors.success;
          statusText = `Cuộc gọi video · ${durationStr}`;
          break;
        case 'missed':
          statusIcon = 'phone-missed';
          statusColor = Colors.danger;
          statusText = isMine ? 'Cuộc gọi nhỡ' : 'Cuộc gọi nhỡ';
          break;
        case 'rejected':
          statusIcon = 'phone-cancel';
          statusColor = Colors.danger;
          statusText = isMine ? 'Đối phương đã từ chối' : 'Bạn đã từ chối cuộc gọi';
          break;
        case 'cancelled':
          statusIcon = 'phone-cancel';
          statusColor = Colors.warning;
          statusText = isMine ? 'Đã hủy cuộc gọi' : 'Cuộc gọi bị hủy';
          break;
        default:
          statusText = 'Cuộc gọi video';
      }

      const timeStr = new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      return (
        <View style={styles.callMessageContainer}>
          <View style={[styles.callMessageCard, { borderLeftColor: statusColor }]}>
            <View style={[styles.callIconCircle, { backgroundColor: statusColor + '18' }]}>
              <Icon name={statusIcon} size={20} color={statusColor} />
            </View>
            <View style={styles.callMessageContent}>
              <Text style={styles.callMessageStatus}>{statusText}</Text>
              <Text style={styles.callMessageTime}>{timeStr}</Text>
            </View>
          </View>
        </View>
      );
    }

    // Default rendering for other message types
    return <Message {...props} />;
  };

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

          <TouchableOpacity 
            style={styles.headerProfile} 
            activeOpacity={0.7}
            onPress={() => {
              if (isGroup) {
                navigation.navigate('GroupSettings', { conversationId, groupName: recipientName });
              }
            }}
          >
            <Avatar
              name={recipientName}
              uri={recipientAvatar}
              size="medium"
              isOnline={recipientPresence.status === 'ONLINE'}
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
                  <Text style={[styles.headerStatus, recipientPresence.status === 'ONLINE' && {color: '#4ADE80'}]}>
                    {getPresenceText()}
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
                  conversationId: conversationId,
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
        renderMessage={renderMessage}
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
                { icon: 'image', label: 'Ảnh', color: '#4CAF50', hint: 'Từ thư viện', onPress: async () => {
                  try {
                    const result = await launchImageLibrary({ mediaType: 'mixed', quality: 0.8 });
                    if (result.assets && result.assets[0]) {
                      const asset = result.assets[0];
                      handleMediaSend({ uri: asset.uri!, fileName: asset.fileName || 'image.jpg', type: asset.type || 'image/jpeg', fileSize: asset.fileSize });
                    }
                  } catch (e) { Alert.alert('Lỗi', 'Không thể mở thư viện ảnh'); }
                }},
                { icon: 'file-document-outline', label: 'Tài liệu', color: '#2196F3', hint: 'PDF, DOCX', onPress: async () => {
                  try {
                    const result = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] });
                    const file = result[0];
                    handleMediaSend({ uri: file.uri, fileName: file.name || 'document', type: file.type || 'application/octet-stream', fileSize: file.size || undefined });
                  } catch (e: any) {
                    if (!DocumentPicker.isCancel(e)) Alert.alert('Lỗi', 'Không thể chọn tài liệu');
                  }
                }},
                { icon: 'camera-outline', label: 'Camera', color: '#FF9800', hint: 'Chụp ảnh', onPress: async () => {
                  try {
                    if (Platform.OS === 'android') {
                      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
                      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        Alert.alert('Quyền bị từ chối', 'Ứng dụng cần quyền Camera để chụp ảnh');
                        return;
                      }
                    }
                    const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
                    if (result.assets && result.assets[0]) {
                      const asset = result.assets[0];
                      handleMediaSend({ uri: asset.uri!, fileName: asset.fileName || 'photo.jpg', type: asset.type || 'image/jpeg', fileSize: asset.fileSize });
                    }
                  } catch (e) { Alert.alert('Lỗi', 'Không thể mở camera'); }
                }},
                { icon: 'video-outline', label: 'Video', color: '#E91E63', hint: 'Quay/Chọn', onPress: async () => {
                  try {
                    const result = await launchImageLibrary({ mediaType: 'video', quality: 0.8 });
                    if (result.assets && result.assets[0]) {
                      const asset = result.assets[0];
                      handleMediaSend({ uri: asset.uri!, fileName: asset.fileName || 'video.mp4', type: asset.type || 'video/mp4', fileSize: asset.fileSize });
                    }
                  } catch (e) { Alert.alert('Lỗi', 'Không thể chọn video'); }
                }},
                { icon: 'sticker-emoji', label: 'Sticker', color: '#9C27B0', hint: 'Emoji', onPress: () => { toggleAttachMenu(); setShowStickerPicker(true); }},
                { icon: 'emoticon-happy-outline', label: 'Emoji', color: '#00BCD4', hint: 'Biểu tượng', onPress: () => { toggleAttachMenu(); setShowStickerPicker(true); }},
              ].map((item, index) => (
                <TouchableOpacity key={index} style={styles.attachMenuItem} onPress={item.onPress}>
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

      {/* Sticker Picker */}
      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={(sticker, type) => handleStickerSend(sticker, type)}
      />

      {/* Upload Indicator */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.uploadText}>Đang tải lên...</Text>
          </View>
        </View>
      )}
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
  // Upload overlay
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  uploadBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
    ...Shadows.lg,
  },
  uploadText: {
    marginTop: 12,
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: Typography.medium as any,
  },
  // Call message styles
  callMessageContainer: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  callMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 3,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minWidth: 220,
    ...Shadows.sm,
  },
  callIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  callMessageContent: {
    flex: 1,
  },
  callMessageStatus: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.semiBold,
    color: Colors.textPrimary,
  },
  callMessageTime: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default ChatScreen;
