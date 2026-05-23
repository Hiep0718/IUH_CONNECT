# 1. Bổ sung cho Mục 4.4: Hiện thực Frontend (React Native)

Dưới đây là các đoạn mã cốt lõi chứng minh cách ứng dụng Mobile tương tác với Backend, bao gồm kết nối WebSocket, xử lý Offline, và WebRTC.

### A. Kết nối WebSocket (Sử dụng WebSocket thuần của React Native)
Ứng dụng không dùng Socket.io hay STOMP, mà dùng **WebSocket thuần** (Native WebSocket) được bọc trong một React Context (`WebSocketProvider.tsx`) để quản lý toàn cục:

```typescript
// Trích xuất từ: frontend/src/services/WebSocketProvider.tsx
import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { WS_URL } from '../config/env';
import { offlineQueue } from './offlineQueue';

// Khởi tạo kết nối WebSocket
const connect = useCallback(() => {
  try {
    const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [WSProvider] WebSocket connected');
      setIsConnected(true);
      
      // Flush offline message queue khi có mạng lại
      offlineQueue.flush((payload) => {
        ws.send(JSON.stringify(payload));
      });
    };

    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      // Xử lý dữ liệu nhận được (tin nhắn, sự kiện cuộc gọi...)
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Logic Exponential Backoff Reconnect ở đây...
    };
  } catch (error) {
    setIsConnected(false);
  }
}, [token]);

// NetInfo: Lắng nghe thay đổi mạng ở cấp độ hệ điều hành (OS Level)
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && !isConnected) {
      console.log('📶 [WSProvider] Network restored — reconnecting immediately');
      connect();
    }
  });
  return () => unsubscribe();
}, [isConnected, connect]);
```

### B. Xử lý Offline (Store-and-Forward)
Khi gửi tin nhắn mà mất mạng, dữ liệu sẽ được lưu tạm vào điện thoại qua `AsyncStorage`.

```typescript
// Trích xuất từ: frontend/src/services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_message_queue';

export const offlineQueue = {
  // Đưa tin nhắn vào hàng đợi
  async enqueue(payload: object): Promise<string> {
    const id = `queue_${Date.now()}`;
    const queue = await this.getAll();
    queue.push({ id, payload, createdAt: Date.now(), retryCount: 0 });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return id;
  },

  // Đẩy tin nhắn đi khi có mạng (flush)
  async flush(sendFn: (payload: object) => void): Promise<number> {
    const queue = await this.getAll();
    if (queue.length === 0) return 0;

    let sent = 0;
    for (const item of queue) {
      try {
        sendFn(item.payload);
        await this.dequeue(item.id); // Xóa khỏi hàng đợi sau khi gửi thành công
        sent++;
      } catch (error) {
        break; // Lỗi mạng lại thì ngừng flush
      }
    }
    return sent;
  },
};
```

### C. Tích hợp WebRTC/Jitsi (Qua WebView)
Hệ thống sử dụng server Jitsi mã nguồn mở và nhúng (embed) vào App thông qua `react-native-webview`.

```tsx
// Trích xuất từ: frontend/src/screens/MeetingScreen.tsx
import { WebView } from 'react-native-webview';

const JITSI_SERVER = 'https://meet.ffmuc.net';

const openJitsiMeeting = async (room: string) => {
  // Cấu hình ẩn toolbar, ẩn thanh chrome extension để tối ưu UI cho Mobile
  const url = `${JITSI_SERVER}/${room}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup","fullscreen","tileview","chat"]`;
  
  setJitsiUrl(url);
  setShowWebView(true);
};

// ... trong hàm render ...
{showWebView && (
  <WebView
    source={{ uri: jitsiUrl }}
    style={{ flex: 1 }}
    javaScriptEnabled={true}
    domStorageEnabled={true}
    allowsInlineMediaPlayback={true}
    mediaPlaybackRequiresUserAction={false}
    mediaCapturePermissionGrantType="grant"
  />
)}
```

---

# 2. Bổ sung cho Mục 4.5: Triển khai Hệ thống (Deployment Configuration)

Để hệ thống (đặc biệt là WebRTC/Jitsi) hoạt động được trên môi trường Production, bắt buộc phải có HTTPS. Dưới đây là cấu hình **Nginx Reverse Proxy** và kịch bản khởi tạo **Docker Swarm**.

### A. Cấu hình Nginx Reverse Proxy (SSL/HTTPS)
Tạo file `nginx.conf` đặt tại server có IP Public (ví dụ EC2). Nginx sẽ đứng ra nhận request HTTPS và đẩy về API Gateway hoặc Frontend tùy theo đường dẫn.

```nginx
# nginx.conf
server {
    listen 80;
    server_name api.iuhconnect.com;
    
    # Redirect HTTP sang HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.iuhconnect.com;

    # Đường dẫn tới chứng chỉ SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.iuhconnect.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.iuhconnect.com/privkey.pem;

    # Cấu hình proxy cho HTTP (REST API)
    location / {
        proxy_pass http://localhost:8080; # Trỏ về API Gateway
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cấu hình proxy cho WebSocket (Cực kỳ quan trọng cho Chat/WebRTC)
    location /ws/ {
        proxy_pass http://localhost:8080/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        
        # Tránh việc WebSocket bị timeout
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### B. Các câu lệnh khởi tạo và triển khai Docker Swarm

Các bước chạy trực tiếp trên Server (Linux/Ubuntu/CentOS):

**Bước 1: Khởi tạo cụm Swarm**
```bash
docker swarm init --advertise-addr <IP_PRIVATE_CUA_SERVER>
```
*(Nếu hệ thống có nhiều máy chủ, lệnh này sẽ sinh ra một chuỗi `docker swarm join --token...` để bạn dán vào các máy chủ con (worker nodes) để gom chúng lại thành 1 cụm)*

**Bước 2: Triển khai hệ thống bằng cấu hình đã viết sẵn**
Giả sử toàn bộ mã nguồn backend và file `docker-compose.yml` đang nằm trong thư mục `/opt/iuhconnect`:
```bash
cd /opt/iuhconnect
docker stack deploy -c docker-compose.yml iuhconnect_stack
```

**Bước 3: Kiểm tra trạng thái triển khai**
```bash
# Xem danh sách các services đang chạy và số lượng Replicas
docker service ls

# Xem logs của API Gateway để đảm bảo hệ thống đã boot lên thành công
docker service logs iuhconnect_stack_api-gateway -f
```
