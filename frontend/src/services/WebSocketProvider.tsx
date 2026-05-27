import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import Sound from 'react-native-sound';
import NetInfo from '@react-native-community/netinfo';
import { WS_URL } from '../config/env';
import InAppNotification, { InAppNotificationData } from '../components/InAppNotification';
import { triggerAutoLogout } from './authService';
import { offlineQueue } from './offlineQueue';
import { CALL_INVITE_EVENT } from './notificationService';

type MessageHandler = (data: any) => void;

interface WebSocketContextType {
  sendMessage: (data: object) => void;
  addListener: (id: string, handler: MessageHandler) => void;
  removeListener: (id: string) => void;
  isConnected: boolean;
  wasReconnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: () => {},
  addListener: () => {},
  removeListener: () => {},
  isConnected: false,
  wasReconnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

let globalRingtone: Sound | null = null;
try {
  globalRingtone = new Sound('ringtone.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      console.log('Failed to load global ringtone', error);
      globalRingtone = null;
    }
  });
} catch (error) {
  console.log('Failed to initialize ringtone', error);
}

interface WebSocketProviderProps {
  token: string;
  currentUser: string;
  children: React.ReactNode;
  navigationRef?: any;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  token,
  currentUser,
  children,
  navigationRef,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, MessageHandler>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const isMountedRef = useRef(false);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [wasReconnected, setWasReconnected] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<any>(null);

  // ── Exponential backoff with jitter ──
  const MAX_RECONNECT_DELAY = 30000;
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptsRef.current;
    return Math.min(
      1000 * Math.pow(2, attempt) + Math.random() * 1000,
      MAX_RECONNECT_DELAY,
    );
  }, []);

  // ── In-app notification state ──
  const [notification, setNotification] = useState<InAppNotificationData | null>(null);
  const notificationQueue = useRef<InAppNotificationData[]>([]);
  const isShowingNotification = useRef(false);

  const showNotification = useCallback((data: InAppNotificationData) => {
    if (isShowingNotification.current) {
      // Xếp hàng nếu đang hiện thông báo khác
      notificationQueue.current.push(data);
      return;
    }
    isShowingNotification.current = true;
    setNotification(data);
  }, []);

  const handleNotificationDismiss = useCallback(() => {
    isShowingNotification.current = false;
    setNotification(null);

    // Hiện thông báo tiếp theo trong hàng đợi
    if (notificationQueue.current.length > 0) {
      const next = notificationQueue.current.shift()!;
      setTimeout(() => showNotification(next), 300);
    }
  }, [showNotification]);

  // ── Start/Stop heartbeat ──
  const startHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 10000); // Every 10 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);
  }, []);

  // ── Global handler for incoming call ──
  const handleGlobalIncomingCall = useCallback(
    (data: any) => {
      const callerName = data.senderName || data.senderId || 'Nguoi dung';

      if (globalRingtone && globalRingtone.isLoaded()) {
        globalRingtone.setNumberOfLoops(-1);
        globalRingtone.play();
      }

      setIncomingCallData(data);
    },
    [navigationRef],
  );

  const handleRejectCall = useCallback(() => {
    if (globalRingtone && globalRingtone.isLoaded()) {
      try {
        globalRingtone.pause();
        globalRingtone.setCurrentTime(0);
      } catch {}
    }

    if (incomingCallData) {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'CALL_SIGNAL',
            signalType: 'CALL_REJECT',
            receiverId: incomingCallData.senderId,
            meetingId: incomingCallData.meetingId,
          }),
        );
      }
    }
    setIncomingCallData(null);
  }, [incomingCallData]);

  const handleAcceptCall = useCallback(() => {
    if (globalRingtone && globalRingtone.isLoaded()) {
      try {
        globalRingtone.pause();
        globalRingtone.setCurrentTime(0);
      } catch {}
    }

    if (incomingCallData) {
      const callerName = incomingCallData.senderName || incomingCallData.senderId || 'Nguoi dung';
      navigationRef?.current?.navigate('Meeting', {
        callerId: incomingCallData.senderId,
        callerName,
        isIncoming: true,
        roomName: incomingCallData.roomName,
        meetingId: incomingCallData.meetingId,
        conversationId: incomingCallData.conversationId || `${incomingCallData.senderId}-${currentUser}`,
      });
    }
    setIncomingCallData(null);
  }, [incomingCallData, navigationRef, currentUser]);

  // ── Global handler for contact events (friend requests/acceptances) ──
  const handleGlobalContactEvent = useCallback(
    (data: any) => {
      const eventType = data.eventType;
      const senderName = data.senderFullName || data.senderUsername || 'Người dùng';

      if (eventType === 'FRIEND_REQUEST_SENT') {
        // Chỉ hiện thông báo cho người nhận
        if (data.senderUsername === currentUser) return;
        
        showNotification({
          id: `contact-${Date.now()}`,
          title: '👋 Lời mời kết bạn mới',
          body: `${senderName} đã gửi lời mời kết bạn cho bạn`,
          senderName: senderName,
          type: 'contact',
          onPress: () => {
            navigationRef?.current?.navigate('MainTabs', { screen: 'Contacts' });
          },
        });
      } else if (eventType === 'FRIEND_REQUEST_ACCEPTED') {
        // Người nhận lời mời là người bấm chấp nhận -> Người gửi ban đầu mới cần nhận thông báo
        // data.senderUsername: Người gửi lời mời ban đầu
        // data.receiverUsername: Người vừa bấm chấp nhận
        // Do đó, nếu mình là người bấm chấp nhận thì không hiện thông báo cho mình.
        if (data.receiverUsername === currentUser) return;
        
        const acceptorName = data.receiverFullName || data.receiverUsername || 'Người dùng';
        
        showNotification({
          id: `contact-${Date.now()}`,
          title: '🎉 Đã trở thành bạn bè',
          body: `${acceptorName} đã chấp nhận lời mời kết bạn của bạn`,
          senderName: acceptorName,
          type: 'contact',
          onPress: () => {
            navigationRef?.current?.navigate('Chat', {
              conversationId: `${data.receiverUsername}-${data.senderUsername}`,
              recipientName: acceptorName,
              recipientId: data.receiverUsername,
              isOnline: true,
            });
          },
        });
      }
    },
    [navigationRef, showNotification],
  );

  const connect = useCallback(() => {
    const currentSocket = wsRef.current;
    if (
      currentSocket?.readyState === WebSocket.OPEN ||
      currentSocket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    clearTimeout(reconnectTimeoutRef.current);

    try {
      const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws || !isMountedRef.current) {
          return;
        }

        console.log('✅ [WSProvider] WebSocket connected');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setWasReconnected(true);
        startHeartbeat();

        // Flush offline message queue
        offlineQueue.flush((payload) => {
          ws.send(JSON.stringify(payload));
        }).then(count => {
          if (count > 0) {
            console.log(`✅ [WSProvider] Flushed ${count} offline messages`);
          }
        });

        // Cleanup expired queued messages
        offlineQueue.cleanup();
      };

      ws.onmessage = event => {
        if (wsRef.current !== ws || !isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          
          // Ignore heartbeat PONG responses
          if (data.type === 'PONG') {
            return;
          }

          if (data.type === 'SESSION_REVOKED') {
            console.log('🚫 [WSProvider] Session revoked due to new login');
            triggerAutoLogout('SESSION_REVOKED');
            return;
          }

          // ── Handle CALL_SIGNAL globally ──
          if (data.type === 'CALL_SIGNAL') {
            if (data.signalType === 'CALL_INVITE') {
              handleGlobalIncomingCall(data);
            } else if (data.signalType === 'CALL_END' || data.signalType === 'CALL_REJECT') {
              if (globalRingtone && globalRingtone.isLoaded()) {
                try {
                  globalRingtone.pause();
                  globalRingtone.setCurrentTime(0);
                } catch {}
              }
              setIncomingCallData(null);
            }
          }

          // ── Handle CONTACT_EVENT globally ──
          if (data.type === 'CONTACT_EVENT') {
            handleGlobalContactEvent(data);
          }

          // ── Handle MEETING message → in-app notification (không reo chuông) ──
          if (!data.type && data.messageType === 'MEETING' && data.senderId && data.senderId !== currentUser && data.conversationId) {
            const senderLabel = data.senderName || data.senderId;
            showNotification({
              id: `meeting-${Date.now()}`,
              title: '📹 Cuộc họp nhóm',
              body: `${senderLabel} đã bắt đầu cuộc họp nhóm. Tham gia ngay!`,
              senderName: senderLabel,
              senderAvatar: data.senderAvatar,
              type: 'chat',
              onPress: () => {
                navigationRef?.current?.navigate('Chat', {
                  conversationId: data.conversationId,
                  recipientName: senderLabel,
                  recipientId: data.senderId,
                  isOnline: true,
                  isGroup: true,
                });
              },
            });
          }

          // ── Handle CHAT MESSAGE → in-app notification ──
          if (!data.type && data.messageType !== 'MEETING' && data.senderId && data.senderId !== currentUser && data.conversationId) {
            const senderLabel = data.senderName || data.senderId;
            const msgPreview = data.messageType === 'IMAGE' ? '📷 Hình ảnh'
              : data.messageType === 'VIDEO' ? '🎬 Video'
              : data.messageType === 'FILE' ? '📎 Tệp đính kèm'
              : data.messageType === 'STICKER' ? '😄 Sticker'
              : data.messageType === 'AUTO_REPLY' ? '🤖 ' + (data.content || 'Phản hồi tự động')
              : data.content || 'Tin nhắn mới';

            showNotification({
              id: `chat-${Date.now()}`,
              title: senderLabel,
              body: msgPreview,
              senderName: senderLabel,
              senderAvatar: data.senderAvatar,
              type: 'chat',
              icon: data.senderAvatar ? undefined : 'chat',
              onPress: () => {
                navigationRef?.current?.navigate('Chat', {
                  conversationId: data.conversationId,
                  recipientName: senderLabel,
                  recipientId: data.senderId,
                  isOnline: true,
                });
              },
            });
          }

          // ── Broadcast to all registered listeners (screens) ──
          listenersRef.current.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error('[WSProvider] Listener error:', error);
            }
          });
        } catch (error) {
          console.error('[WSProvider] Parse error:', error);
        }
      };

      ws.onerror = error => {
        if (!isMountedRef.current) {
          return;
        }

        console.error('[WSProvider] WebSocket error:', error);
        setIsConnected(false);
        stopHeartbeat();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        if (!isMountedRef.current) {
          return;
        }

        console.log('🔌 [WSProvider] WebSocket disconnected');
        setIsConnected(false);
        stopHeartbeat();

        if (!shouldReconnectRef.current) {
          return;
        }

        // Exponential backoff reconnect
        const delay = getReconnectDelay();
        reconnectAttemptsRef.current++;
        console.log(`🔄 [WSProvider] Reconnect in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && shouldReconnectRef.current) {
            connect();
          }
        }, delay);
      };
    } catch (error) {
      console.error('[WSProvider] Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, [handleGlobalIncomingCall, handleGlobalContactEvent, showNotification, currentUser, token, startHeartbeat, stopHeartbeat, getReconnectDelay]);

  useEffect(() => {
    isMountedRef.current = true;
    shouldReconnectRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      stopHeartbeat();

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // ── NetInfo: detect network changes at OS level ──
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentSocket = wsRef.current;
      const isActuallyConnected = currentSocket?.readyState === WebSocket.OPEN;
      
      if (state.isConnected && !isActuallyConnected && shouldReconnectRef.current && isMountedRef.current) {
        console.log('📶 [WSProvider] Network restored — reconnecting immediately');
        reconnectAttemptsRef.current = 0;
        clearTimeout(reconnectTimeoutRef.current);
        connect();
      }
    });
    return () => unsubscribe();
  }, [connect]);

  // ── FCM CALL_INVITE fallback: lắng nghe event từ FCM khi app foreground ──
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(CALL_INVITE_EVENT, (data: any) => {
      console.log('📞 [WSProvider] Received CALL_INVITE from FCM fallback:', data);
      // Chỉ hiện nếu chưa có cuộc gọi đang hiển thị
      if (!incomingCallData) {
        handleGlobalIncomingCall({
          type: 'CALL_SIGNAL',
          signalType: 'CALL_INVITE',
          senderId: data.senderId,
          senderName: data.senderId,
          roomName: data.roomName,
          meetingId: data.meetingId,
          conversationId: data.conversationId,
        });
      }
    });
    return () => subscription.remove();
  }, [handleGlobalIncomingCall, incomingCallData]);

  const sendMessage = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return;
    }

    // Queue tin nhắn để gửi lại khi online
    offlineQueue.enqueue(data);
  }, []);

  const addListener = useCallback((id: string, handler: MessageHandler) => {
    listenersRef.current.set(id, handler);
  }, []);

  const removeListener = useCallback((id: string) => {
    listenersRef.current.delete(id);
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, addListener, removeListener, isConnected, wasReconnected }}
    >
      <View style={styles.providerContainer}>
        {children}
        <InAppNotification
          notification={notification}
          onDismiss={handleNotificationDismiss}
        />
        
        {/* Modal thông báo cuộc gọi đến */}
        <Modal visible={!!incomingCallData} transparent animationType="slide">
          <View style={styles.callModalContainer}>
            <View style={styles.callModalContent}>
              <Text style={styles.callModalTitle}>Cuộc gọi đến</Text>
              <Text style={styles.callModalSubtitle}>
                {(incomingCallData?.senderName || incomingCallData?.senderId || 'Người dùng')} đang gọi video cho bạn
              </Text>
              <View style={styles.callModalActions}>
                <TouchableOpacity style={[styles.callBtn, styles.rejectBtn]} onPress={handleRejectCall}>
                  <Text style={styles.callBtnText}>Từ chối</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAcceptCall}>
                  <Text style={styles.callBtnText}>Nghe máy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </WebSocketContext.Provider>
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
  },
  callModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  callModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  callModalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  callModalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  callBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#FF3B30',
  },
  acceptBtn: {
    backgroundColor: '#34C759',
  },
  callBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
