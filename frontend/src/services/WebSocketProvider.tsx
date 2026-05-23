import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import Sound from 'react-native-sound';
import NetInfo from '@react-native-community/netinfo';
import { WS_URL } from '../config/env';
import InAppNotification, { InAppNotificationData } from '../components/InAppNotification';
import { triggerAutoLogout } from './authService';
import { offlineQueue } from './offlineQueue';

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

      Alert.alert(
        'Cuoc goi den',
        `${callerName} dang goi video cho ban`,
        [
          {
            text: 'Tu choi',
            style: 'cancel',
            onPress: () => {
              if (globalRingtone && globalRingtone.isLoaded()) {
                try {
                  globalRingtone.stop();
                } catch {}
              }

              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'CALL_SIGNAL',
                    signalType: 'CALL_REJECT',
                    receiverId: data.senderId,
                    meetingId: data.meetingId,
                  }),
                );
              }
            },
          },
          {
            text: 'Nghe may',
            onPress: () => {
              if (globalRingtone && globalRingtone.isLoaded()) {
                try {
                  globalRingtone.stop();
                } catch {}
              }

              navigationRef?.current?.navigate('Meeting', {
                callerId: data.senderId,
                callerName,
                isIncoming: true,
                roomName: data.roomName,
                meetingId: data.meetingId,
                conversationId: data.conversationId || `${data.senderId}-${currentUser}`,
              });
            },
          },
        ],
        {
          onDismiss: () => {
            if (globalRingtone && globalRingtone.isLoaded()) {
              try {
                globalRingtone.stop();
              } catch {}
            }
          },
        },
      );
    },
    [navigationRef],
  );

  // ── Global handler for contact events (friend requests/acceptances) ──
  const handleGlobalContactEvent = useCallback(
    (data: any) => {
      const eventType = data.eventType;
      const senderName = data.senderFullName || data.senderUsername || 'Người dùng';

      if (eventType === 'FRIEND_REQUEST_SENT') {
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
        showNotification({
          id: `contact-${Date.now()}`,
          title: '🎉 Đã trở thành bạn bè',
          body: `${senderName} đã chấp nhận lời mời kết bạn của bạn`,
          senderName: senderName,
          type: 'contact',
          onPress: () => {
            navigationRef?.current?.navigate('Chat', {
              conversationId: `${data.receiverUsername}-${data.senderUsername}`,
              recipientName: senderName,
              recipientId: data.senderUsername,
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
                  globalRingtone.stop();
                } catch {}
              }
            }
          }

          // ── Handle CONTACT_EVENT globally ──
          if (data.type === 'CONTACT_EVENT') {
            handleGlobalContactEvent(data);
          }

          // ── Handle CHAT MESSAGE → in-app notification ──
          if (!data.type && data.senderId && data.senderId !== currentUser && data.conversationId) {
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
              type: 'chat',
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
      </View>
    </WebSocketContext.Provider>
  );
};

const styles = StyleSheet.create({
  providerContainer: {
    flex: 1,
  },
});
