import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { WS_URL } from '../config/env';

// ============================================================
// Types
// ============================================================

type MessageHandler = (data: any) => void;

interface WebSocketContextType {
  /** Gửi message qua WebSocket (auto-serialize JSON) */
  sendMessage: (data: object) => void;
  /** Đăng ký listener nhận message từ WS */
  addListener: (id: string, handler: MessageHandler) => void;
  /** Hủy đăng ký listener */
  removeListener: (id: string) => void;
  /** Trạng thái kết nối */
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: () => {},
  addListener: () => {},
  removeListener: () => {},
  isConnected: false,
});

/** Hook để dùng WebSocket từ bất kỳ component nào */
export const useWebSocket = () => useContext(WebSocketContext);

// ============================================================
// Provider
// ============================================================

interface WebSocketProviderProps {
  token: string;
  children: React.ReactNode;
  /** Navigation ref để điều hướng từ global scope */
  navigationRef?: any;
}

/**
 * WebSocketProvider — mount DUY NHẤT 1 WebSocket cho toàn app authenticated.
 *
 * - Quản lý kết nối + auto reconnect
 * - Cho phép nhiều component subscribe qua addListener/removeListener
 * - Xử lý incoming call toàn cục (không phụ thuộc vào ChatScreen)
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  token,
  children,
  navigationRef,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, MessageHandler>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(true);

  // ---- Connect ----
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [WSProvider] WebSocket connected');
        if (isMountedRef.current) setIsConnected(true);
      };

      ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // === Global incoming call handler ===
          if (
            data.type === 'CALL_SIGNAL' &&
            data.signalType === 'CALL_INVITE'
          ) {
            handleGlobalIncomingCall(data);
          }

          // Broadcast tới tất cả listeners
          listenersRef.current.forEach(handler => {
            try {
              handler(data);
            } catch (e) {
              console.error('[WSProvider] Listener error:', e);
            }
          });
        } catch (e) {
          console.error('[WSProvider] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('🔌 [WSProvider] WebSocket disconnected');
        if (isMountedRef.current) {
          setIsConnected(false);
          // Auto reconnect sau 3 giây
          reconnectTimeout.current = setTimeout(() => {
            if (isMountedRef.current) connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        if (isMountedRef.current) setIsConnected(false);
      };
    } catch (e) {
      console.error('[WSProvider] Failed to create WebSocket:', e);
      if (isMountedRef.current) setIsConnected(false);
    }
  }, [token]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // tránh reconnect khi unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // ---- Send ----
  const sendMessage = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ [WSProvider] WS not connected, message queued/dropped');
    }
  }, []);

  // ---- Listeners ----
  const addListener = useCallback((id: string, handler: MessageHandler) => {
    listenersRef.current.set(id, handler);
  }, []);

  const removeListener = useCallback((id: string) => {
    listenersRef.current.delete(id);
  }, []);

  // ---- Global incoming call ----
  const handleGlobalIncomingCall = (data: any) => {
    const callerName = data.senderName || data.senderId || 'Người dùng';

    Alert.alert(
      '📞 Cuộc gọi đến',
      `${callerName} đang gọi video cho bạn`,
      [
        {
          text: 'Từ chối',
          style: 'cancel',
          onPress: () => {
            // Gửi CALL_REJECT
            sendMessage({
              type: 'CALL_SIGNAL',
              signalType: 'CALL_REJECT',
              receiverId: data.senderId,
              meetingId: data.meetingId,
            });
          },
        },
        {
          text: '✅ Nghe máy',
          onPress: () => {
            if (navigationRef?.current) {
              navigationRef.current.navigate('Meeting', {
                callerId: data.senderId,
                callerName: callerName,
                isIncoming: true,
                roomName: data.roomName,
                meetingId: data.meetingId,
              });
            }
          },
        },
      ],
    );
  };

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, addListener, removeListener, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
