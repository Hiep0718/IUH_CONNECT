# Meeting Feature Implementation Plan — Part 2: Frontend

## BƯỚC 12: Tạo WebSocketProvider (mount WS ở cấp App)

**File**: `frontend/src/services/WebSocketProvider.tsx`

Đây là core change quan trọng nhất — WS duy nhất cho toàn app, truyền qua Context.

```tsx
import React, { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
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

interface Props {
  token: string;
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<Props> = ({ token, children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, MessageHandler>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Global WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Broadcast tới tất cả listeners đã đăng ký
        listenersRef.current.forEach((handler) => {
          try { handler(data); } catch (e) { console.error('Listener error:', e); }
        });
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('🔌 Global WebSocket disconnected');
      setIsConnected(false);
      // Auto reconnect sau 3s
      reconnectTimeout.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // tránh reconnect khi unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ WS not connected, message not sent');
    }
  }, []);

  const addListener = useCallback((id: string, handler: MessageHandler) => {
    listenersRef.current.set(id, handler);
  }, []);

  const removeListener = useCallback((id: string) => {
    listenersRef.current.delete(id);
  }, []);

  return (
    <WebSocketContext.Provider value={{ sendMessage, addListener, removeListener, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

**Cách hoạt động**:
- `ChatScreen` gọi `addListener('chat', handler)` để nhận chat messages
- `ChatScreen` cũng nhận `CALL_SIGNAL` từ listener → popup incoming call
- `MeetingScreen` gọi `addListener('meeting', handler)` để nhận call signals
- Không screen nào tự mở WS riêng nữa

---

## BƯỚC 13: Tạo callSignaling service

**File**: `frontend/src/services/callSignaling.ts`

```ts
// Utility functions cho meeting signaling — dùng sendMessage từ WebSocketProvider

export interface CallSignal {
  type: 'CALL_SIGNAL';
  signalType: string;
  meetingId?: string;
  roomName?: string;
  senderId?: string;
  senderName?: string;
  receiverId: string;
  timestamp?: number;
}

export const createCallInvite = (receiverId: string, roomName: string): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_INVITE',
  receiverId,
  roomName,
  timestamp: Date.now(),
});

export const createCallAccept = (receiverId: string, meetingId?: string, roomName?: string): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_ACCEPT',
  receiverId,
  meetingId,
  roomName,
  timestamp: Date.now(),
});

export const createCallReject = (receiverId: string, meetingId?: string): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_REJECT',
  receiverId,
  meetingId,
  timestamp: Date.now(),
});

export const createCallEnd = (receiverId: string, meetingId?: string): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_END',
  receiverId,
  meetingId,
  timestamp: Date.now(),
});

export const isCallSignal = (data: any): data is CallSignal => {
  return data && data.type === 'CALL_SIGNAL';
};
```

---

## BƯỚC 14: Tạo meetingApi service

**File**: `frontend/src/services/meetingApi.ts`

```ts
import { API_URL } from '../config/env';

export const createHandoffToken = async (meetingId: string, userId: string, token: string) => {
  const res = await fetch(`${API_URL}/api/v1/meetings/${meetingId}/handoff-token?userId=${userId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to create handoff token');
  return res.json(); // { handoffToken, meetingUrl }
};
```

---

## BƯỚC 15: Cập nhật types

**File**: `frontend/src/types/types.ts`

Thêm vào cuối file (trước dòng cuối):

```ts
// ============================================================
// Meeting Types
// ============================================================

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Chat: {
    conversationId: string;
    recipientName: string;
    recipientAvatar?: string;
    recipientId: string;
    isOnline?: boolean;
    lecturerStatus?: LecturerStatus;
    isGroup?: boolean;
  };
  Meeting: {                    // ĐỔI TÊN từ VideoCall
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    isIncoming?: boolean;
    roomName?: string;
    meetingId?: string;
  };
  ProfileSettings: undefined;
};
```

**Lưu ý**: Xóa block `VideoCall` cũ, thay bằng `Meeting`. Bỏ field `token` vì không cần truyền token qua navigation nữa (WS đã mount ở App level).

---

## BƯỚC 16: Refactor ChatScreen

**File**: `frontend/src/screens/ChatScreen.tsx`

**Thay đổi chính**:
1. Bỏ tự quản lý WS → dùng `useWebSocket()`
2. Tách call signaling ra listener riêng
3. Nút video call navigate tới `Meeting` thay vì `VideoCall`

```tsx
// THAY ĐỔI IMPORTS - bỏ WS_URL, thêm:
import { useWebSocket } from '../services/WebSocketProvider';
import { isCallSignal } from '../services/callSignaling';

// TRONG COMPONENT - bỏ wsRef, thay bằng:
const { sendMessage, addListener, removeListener, isConnected: wsConnected } = useWebSocket();

// Bỏ toàn bộ useEffect WS cũ (dòng 126-206), thay bằng:
useEffect(() => {
  const handler = (data: any) => {
    // Handle incoming call
    if (isCallSignal(data) && data.signalType === 'CALL_INVITE') {
      Alert.alert(
        '📞 Cuộc gọi đến',
        `${data.senderName || data.senderId} đang gọi video cho bạn`,
        [
          { text: 'Từ chối', style: 'cancel' },
          {
            text: '✅ Nghe máy',
            onPress: () => {
              navigation.navigate('Meeting', {
                callerId: data.senderId,
                callerName: data.senderName || data.senderId,
                isIncoming: true,
                roomName: data.roomName,
                meetingId: data.meetingId,
              });
            },
          },
        ],
      );
      return;
    }

    // Handle chat message (bỏ qua các CALL_SIGNAL khác)
    if (isCallSignal(data)) return;

    // Normal chat message — giữ nguyên logic cũ
    if (data.conversationId === conversationId) {
      const incomingMessage = {
        _id: `${data.conversationId}-${data.timestamp}-${Date.now()}`,
        text: data.content,
        createdAt: new Date(data.timestamp || Date.now()),
        user: { _id: data.senderId, name: data.senderId },
        status: 'delivered',
      };
      setMessages((prev) => GiftedChat.append(prev, [incomingMessage]));
    }
  };

  addListener('chat-' + conversationId, handler);
  return () => removeListener('chat-' + conversationId);
}, [conversationId]);

// SỬA onSend — dùng sendMessage thay vì wsRef:
const onSend = useCallback((newMessages: IMessage[] = []) => {
  // ... giữ setMessages logic ...
  newMessages.forEach((msg) => {
    sendMessage({
      senderId: currentUser,
      receiverId: recipientId,
      content: msg.text,
      conversationId: conversationId,
    });
  });
  // ... giữ setTimeout delivery/read ...
}, [sendMessage, currentUser, recipientId, conversationId]);

// SỬA isOffline — dùng wsConnected:
// Bỏ state isOffline local, dùng: const isOffline = !wsConnected;

// SỬA NÚT VIDEO CALL (dòng 451-465):
onPress={() => {
  const roomName = `IUHConnect_${recipientId}_${Date.now()}`;
  navigation.navigate('Meeting', {
    callerId: recipientId,
    callerName: recipientName,
    callerAvatar: recipientAvatar,
    roomName: roomName,
  });
}}
```

---

## BƯỚC 17: Tạo MeetingScreen (thay VideoCallScreen)

**File**: `frontend/src/screens/MeetingScreen.tsx`

**Thay đổi so với VideoCallScreen cũ**:
1. Bỏ tự mở WS → dùng `useWebSocket()`
2. Dùng `CALL_SIGNAL` thay vì `WEBRTC`
3. Thêm nút "Mở trên máy tính" (GĐ6)

```tsx
// Thay đổi cốt lõi - sketch:
import { useWebSocket } from '../services/WebSocketProvider';
import { createCallInvite, createCallAccept, createCallEnd, isCallSignal } from '../services/callSignaling';

const MeetingScreen = ({ navigation, route }) => {
  const { callerId, callerName, callerAvatar, isIncoming = false, roomName: initialRoomName, meetingId: initialMeetingId } = route.params;
  const { sendMessage, addListener, removeListener } = useWebSocket();
  const roomNameRef = useRef(initialRoomName || '');
  const meetingIdRef = useRef(initialMeetingId || '');

  // BỎ TOÀN BỘ WS setup cũ (dòng 80-178 của VideoCallScreen)
  // Thay bằng:

  useEffect(() => {
    if (!isIncoming) {
      // === CALLER ===
      if (!roomNameRef.current) {
        roomNameRef.current = `IUHConnect_${callerId}_${Date.now()}`;
      }
      sendMessage(createCallInvite(callerId, roomNameRef.current));
      setCallStatus('Đang gọi...');
    } else {
      // === CALLEE ===
      sendMessage(createCallAccept(callerId, meetingIdRef.current, roomNameRef.current));
      setTimeout(() => openJitsiMeeting(roomNameRef.current), 500);
    }

    const handler = (data: any) => {
      if (!isCallSignal(data)) return;
      if (data.signalType === 'CALL_ACCEPT') {
        setCallStatus('Đối phương đã nghe máy!');
        if (data.meetingId) meetingIdRef.current = data.meetingId;
        setTimeout(() => openJitsiMeeting(roomNameRef.current), 500);
      } else if (data.signalType === 'CALL_END' || data.signalType === 'CALL_REJECT') {
        Alert.alert('Cuộc gọi kết thúc', 'Đối phương đã kết thúc cuộc gọi.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    };

    addListener('meeting', handler);
    return () => removeListener('meeting');
  }, []);

  const handleEndCall = () => {
    sendMessage(createCallEnd(callerId, meetingIdRef.current));
    navigation.goBack();
  };

  // Giữ nguyên: openJitsiMeeting, animations, UI render
  // Chỉ bỏ wsRef và mọi logic ws.send/ws.close
};
```

---

## BƯỚC 18: Sửa App.tsx

**Thay đổi**:
1. Wrap authenticated screens bằng `WebSocketProvider`
2. Đổi route `VideoCall` → `Meeting`

```tsx
// Thêm import
import { WebSocketProvider } from './src/services/WebSocketProvider';
import MeetingScreen from './src/screens/MeetingScreen';
// Bỏ: import VideoCallScreen

// Trong return, wrap phần authenticated:
{!token ? (
  <Stack.Screen name="Login">...</Stack.Screen>
) : (
  <WebSocketProvider token={token}>
    <>
      <Stack.Screen name="MainTabs" ...>...</Stack.Screen>

      <Stack.Screen name="Chat" ...>
        {(props) => (
          <ChatScreen {...props} currentUser={currentUser} token={token} />
        )}
      </Stack.Screen>

      <Stack.Screen name="Meeting" options={{ animation: 'slide_from_bottom', gestureEnabled: false }}>
        {(props) => <MeetingScreen {...props} />}
      </Stack.Screen>

      <Stack.Screen name="ProfileSettings" ...>...</Stack.Screen>
    </>
  </WebSocketProvider>
)}
```

> **Lưu ý**: `WebSocketProvider` phải nằm BÊN TRONG `Stack.Navigator` nhưng BÊN NGOÀI các `Stack.Screen`. Nếu React Navigation không cho wrap như vậy, đặt `WebSocketProvider` bọc cả `NavigationContainer`.

---

## BƯỚC 19: Cleanup (GĐ7)

### Checklist xóa code cũ

| # | File | Hành động |
|---|------|-----------|
| 1 | `frontend/src/screens/VideoCallScreen.tsx` | **XÓA FILE** (đã thay bằng MeetingScreen) |
| 2 | `frontend/App.tsx` | Bỏ import VideoCallScreen, bỏ route VideoCall |
| 3 | `frontend/src/screens/ChatScreen.tsx` | Bỏ `import { WS_URL }`, bỏ `wsRef`, bỏ useEffect WS cũ |
| 4 | `frontend/src/types/types.ts` | Bỏ `VideoCall` khỏi `RootStackParamList` |
| 5 | `backend/.../dto/WebRTCSignalingMessage.java` | **XÓA FILE** khi đã test xong CALL_SIGNAL |
| 6 | `backend/.../handler/ChatWebSocketHandler.java` | Bỏ branch `else if ("WEBRTC".equals(type))` |

---

## Tóm tắt thứ tự implement

```
BACKEND (Bước 1-11):
 1. CallSignalType.java           (tạo mới)
 2. CallSignalDto.java            (tạo mới)
 3. MeetingStatus.java            (tạo mới)
 4. MeetingSession.java           (tạo mới)
 5. MeetingSessionService.java    (tạo mới)
 6. CallSignalService.java        (tạo mới)
 7. ChatWebSocketHandler.java     (SỬA — thêm CALL_SIGNAL branch)
 8. SignalingRedisSubscriber.java  (SỬA — parse JsonNode)
 9. HandoffTokenResponse.java     (tạo mới)
    MeetingJoinInfoResponse.java  (tạo mới)
    MeetingController.java        (tạo mới)
10. api-gateway application.yml   (SỬA — thêm route)
11. static/meeting/join/index.html (tạo mới)

FRONTEND (Bước 12-18):
12. WebSocketProvider.tsx          (tạo mới — QUAN TRỌNG NHẤT)
13. callSignaling.ts              (tạo mới)
14. meetingApi.ts                  (tạo mới)
15. types.ts                      (SỬA — VideoCall → Meeting)
16. ChatScreen.tsx                 (SỬA — dùng useWebSocket)
17. MeetingScreen.tsx              (tạo mới, based on VideoCallScreen)
18. App.tsx                        (SỬA — wrap WebSocketProvider, đổi route)

CLEANUP (Bước 19):
19. Xóa VideoCallScreen.tsx, WebRTCSignalingMessage.java
```

## Test milestones

**Milestone 1** (sau bước 18):
- Mobile A bấm gọi → Mobile B hiện popup → B accept → cả 2 mở Jitsi

**Milestone 2** (sau bước 11):
- Từ MeetingScreen bấm "Mở trên máy tính"
- Gọi API tạo handoff token → hiện link
- Mở link trên browser desktop → thấy trang join → bấm vào Jitsi

**Milestone 3** (sau cleanup):
- Chạy clean, không còn `WEBRTC` type, không duplicate WS
