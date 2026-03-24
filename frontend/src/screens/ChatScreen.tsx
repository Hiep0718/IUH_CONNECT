import React, {useState, useEffect, useCallback, useRef} from 'react';
import {GiftedChat, IMessage} from 'react-native-gifted-chat';
import {SafeAreaView, StyleSheet, Alert, Platform} from 'react-native';

// ============================================================
// MOCK CONFIG — Replace with real values from AsyncStorage/auth
// ============================================================
const MOCK_JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE';
const CURRENT_USER_ID = 'user1';
const RECEIVER_ID = 'user2';
const CONVERSATION_ID = 'conv-001';

const GATEWAY_WS_URL = Platform.select({
  android: `ws://10.0.2.2:8080/ws/chat?token=${MOCK_JWT_TOKEN}`,
  ios: `ws://localhost:8080/ws/chat?token=${MOCK_JWT_TOKEN}`,
  default: `ws://localhost:8080/ws/chat?token=${MOCK_JWT_TOKEN}`,
});

// ============================================================
// ChatScreen Component
// ============================================================
const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // -------------------- WebSocket Lifecycle --------------------
  useEffect(() => {
    const ws = new WebSocket(GATEWAY_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        const incomingMessage: IMessage = {
          _id: `${data.conversationId}-${data.timestamp}`,
          text: data.content,
          createdAt: new Date(data.timestamp),
          user: {
            _id: data.senderId,
            name: data.senderId,
          },
        };

        // Append message to GiftedChat (prepend for newest-first)
        setMessages(previousMessages =>
          GiftedChat.append(previousMessages, [incomingMessage]),
        );
      } catch (e) {
        console.error('❌ Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error: Event) => {
      console.error('❌ WebSocket error:', error);
      Alert.alert(
        'Connection Error',
        'Failed to connect to chat server. Please check your network.',
      );
    };

    ws.onclose = (event: WebSocketCloseEvent) => {
      console.log(`🔌 WebSocket closed [code=${event.code}]`);
    };

    // Cleanup: close WebSocket on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        console.log('🧹 WebSocket closed on unmount');
      }
    };
  }, []);

  // -------------------- Send Message --------------------
  const onSend = useCallback((newMessages: IMessage[] = []) => {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      Alert.alert('Not Connected', 'WebSocket is not connected.');
      return;
    }

    newMessages.forEach(msg => {
      const payload = {
        senderId: CURRENT_USER_ID,
        receiverId: RECEIVER_ID,
        content: msg.text,
        conversationId: CONVERSATION_ID,
      };

      ws.send(JSON.stringify(payload));
      console.log('📤 Message sent:', payload);
    });
  }, []);

  // -------------------- Render --------------------
  return (
    <SafeAreaView style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={newMessages => onSend(newMessages)}
        user={{
          _id: CURRENT_USER_ID,
          name: 'Me',
        }}
        placeholder="Type a message..."
        alwaysShowSend
        scrollToBottom
        renderUsernameOnMessage
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default ChatScreen;
