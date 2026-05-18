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
    const response = await fetch(`${API_URL}/api/v1/users/fcm-token`, {
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
  return onMessage(messagingInstance, async remoteMessage => {
    console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
  });
};

export const registerBackgroundMessageHandler = () => {
  setBackgroundMessageHandler(messagingInstance, async remoteMessage => {
    console.log('Message handled in the background!', remoteMessage);
  });
};
