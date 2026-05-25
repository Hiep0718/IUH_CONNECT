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

const messagingInstance = getMessaging(getApp());

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

export const setupNotificationListeners = () => {
  // Tạo sẵn channel cho cuộc gọi đến để hệ thống Android tự xử lý Push Notification (bật pop-up Heads-up)
  if (Platform.OS === 'android') {
    (async () => {
      await notifee.createChannel({
        id: 'call_channel',
        name: 'Cuộc gọi đến',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });
      await notifee.createChannel({
        id: 'default_channel',
        name: 'Thông báo chung',
        importance: AndroidImportance.DEFAULT,
      });
    })();
  }

  return onMessage(messagingInstance, async remoteMessage => {
    console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));

    // Khi app đang foreground, WebSocket đã xử lý in-app notification banner.
    // FCM foreground message chỉ cần log, KHÔNG hiện Alert chặn màn hình.
    // Push notification chỉ hiện khi app ở background/killed (do hệ thống xử lý).
    const data = remoteMessage.data;
    if (data?.type === 'CONTACT_EVENT') {
      console.log('📬 [FCM] Contact event in foreground (handled by WebSocket):', data.eventType);
    } else {
      console.log('📬 [FCM] Chat message in foreground (handled by WebSocket)');
    }
  });
};

export const registerBackgroundMessageHandler = () => {
  setBackgroundMessageHandler(messagingInstance, async remoteMessage => {
    console.log('Message handled in the background!', remoteMessage);
    // Khi Backend gửi { notification, android: { channel_id } }, hệ thống Android sẽ tự động vẽ Notification
    // dựa trên cái channel_id mà ta đã tạo ở setupNotificationListeners.
    // Không cần dùng JS Notifee để vẽ lại nữa (tránh trùng lặp và tránh lỗi do App bị kill).
  });
};

