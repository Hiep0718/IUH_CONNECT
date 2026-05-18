import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import Sound from 'react-native-sound';
import { WS_URL } from '../config/env';

type MessageHandler = (data: any) => void;

interface WebSocketContextType {
  sendMessage: (data: object) => void;
  addListener: (id: string, handler: MessageHandler) => void;
  removeListener: (id: string) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  sendMessage: () => {},
  addListener: () => {},
  removeListener: () => {},
  isConnected: false,
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
  children: React.ReactNode;
  navigationRef?: any;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  token,
  children,
  navigationRef,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, MessageHandler>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(false);
  const shouldReconnectRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

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
        setIsConnected(true);
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

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

        if (!shouldReconnectRef.current) {
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && shouldReconnectRef.current) {
            connect();
          }
        }, 3000);
      };
    } catch (error) {
      console.error('[WSProvider] Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, [handleGlobalIncomingCall, token]);

  useEffect(() => {
    isMountedRef.current = true;
    shouldReconnectRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return;
    }

    console.warn('[WSProvider] WebSocket is not connected');
  }, []);

  const addListener = useCallback((id: string, handler: MessageHandler) => {
    listenersRef.current.set(id, handler);
  }, []);

  const removeListener = useCallback((id: string) => {
    listenersRef.current.delete(id);
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, addListener, removeListener, isConnected }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
