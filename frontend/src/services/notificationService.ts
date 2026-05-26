import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { API_URL } from '../config/env';
import { authFetch } from './authService';
import notifee, { AndroidImportance, AndroidCategory, EventType } from '@notifee/react-native';
import { DeviceEventEmitter } from 'react-native';

const messagingInstance = getMessaging(getApp());

// ── Event name để giao tiếp giữa FCM handler và WebSocketProvider ──
export const CALL_INVITE_EVENT = 'FCM_CALL_INVITE';

export const requestUserPermission = async () => {
  if (Platform.OS === 'ios') {
    const authStatus = await requestPermission(messagingInstance);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
    }

    return enabled;
  }

  return true;
};

export const getFCMToken = async () => {
  try {
    const token = await getToken(messagingInstance);
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token', error);
    return null;
  }
};

export const sendFCMTokenToBackend = async (token: string, userJwt: string) => {
  try {
    const response = await authFetch(`${API_URL}/api/v1/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({ fcmToken: token }),
    });

    if (response.ok) {
      console.log('FCM Token successfully registered with backend');
    } else {
      console.error('Failed to register FCM Token with backend', response.status);
    }
  } catch (error) {
    console.error('Error sending FCM Token to backend', error);
  }
};

/**
 * Hiển thị Notifee notification cho cuộc gọi đến.
 * Dùng cho cả background lẫn killed state.
 */
async function displayCallNotification(data: Record<string, string>) {
  try {
    // Tạo/đảm bảo channel tồn tại
    const channelId = await notifee.createChannel({
      id: 'call_channel',
      name: 'Cuộc gọi đến',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });

    const callerName = data.senderId || 'Người dùng';

    await notifee.displayNotification({
      title: '📞 Cuộc gọi đến',
      body: `${callerName} đang gọi video cho bạn`,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,
        sound: 'default',
        vibrationPattern: [300, 500, 300, 500],
        // Full-screen intent: hiện notification dạng heads-up / full-screen trên lock screen
        fullScreenAction: {
          id: 'default',
        },
        pressAction: {
          id: 'default',
        },
        // Giữ notification cho đến khi user tương tác
        autoCancel: true,
        ongoing: false,
      },
      data: data,
    });

    console.log('📞 [Notifee] Displayed incoming call notification for:', callerName);
  } catch (error) {
    console.error('❌ [Notifee] Failed to display call notification:', error);
  }
}

export const setupNotificationListeners = () => {
  // Tạo sẵn channel
  if (Platform.OS === 'android') {
    (async () => {
      await notifee.createChannel({
        id: 'call_channel',
        name: 'Cuộc gọi đến',
        importance: AndroidImportance.HIGH,
        vibration: true,
        sound: 'default',
      });
      await notifee.createChannel({
        id: 'default_channel',
        name: 'Thông báo chung',
        importance: AndroidImportance.DEFAULT,
      });
    })();
  }

  // Handle app opened from a killed state by tapping the Notifee notification
  notifee.getInitialNotification().then(initialNotification => {
    if (initialNotification) {
      console.log('📬 [Notifee] App opened by notification:', initialNotification.notification.data);
      const data = initialNotification.notification.data;
      if (data?.type === 'CALL_INVITE') {
        // Đợi 1.5s để app và WebSocketProvider mount xong
        setTimeout(() => {
          DeviceEventEmitter.emit(CALL_INVITE_EVENT, data);
        }, 1500);
      }
    }
  });

  // Handle tapping the Notifee notification when app is in foreground/background
  const unsubscribeNotifeeForeground = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data?.type === 'CALL_INVITE') {
      DeviceEventEmitter.emit(CALL_INVITE_EVENT, detail.notification.data);
    }
  });

  const unsubscribeFCM = onMessage(messagingInstance, async remoteMessage => {
    console.log('📬 [FCM] Foreground message arrived:', JSON.stringify(remoteMessage));

    const data = remoteMessage.data as Record<string, string> | undefined;

    if (data?.type === 'CALL_INVITE') {
      // ★ Cuộc gọi đến khi app đang foreground.
      // WebSocket thường xử lý nhưng FCM là fallback đảm bảo.
      // Emit event để WebSocketProvider hiện Modal nếu chưa có.
      console.log('📞 [FCM] CALL_INVITE received in foreground, emitting event');
      DeviceEventEmitter.emit(CALL_INVITE_EVENT, data);
      return;
    }

    if (data?.type === 'CONTACT_EVENT') {
      console.log('📬 [FCM] Contact event in foreground (handled by WebSocket):', data.eventType);
    } else {
      console.log('📬 [FCM] Chat message in foreground (handled by WebSocket)');
    }
  });

  return () => {
    unsubscribeFCM();
    unsubscribeNotifeeForeground();
  };
};

export const registerBackgroundMessageHandler = () => {
  setBackgroundMessageHandler(messagingInstance, async remoteMessage => {
    console.log('📬 [FCM] Background/Killed message received:', JSON.stringify(remoteMessage));

    const data = remoteMessage.data as Record<string, string> | undefined;

    if (data?.type === 'CALL_INVITE') {
      // ★ Cuộc gọi đến khi app bị background hoặc killed.
      // Dùng Notifee để hiển thị full-screen incoming call notification.
      console.log('📞 [FCM] CALL_INVITE in background/killed, displaying Notifee notification');
      await displayCallNotification(data);
      return;
    }

    // Tin nhắn thường: Android OS đã tự hiện notification từ FCM notification payload.
    // Không cần xử lý thêm.
  });
};
