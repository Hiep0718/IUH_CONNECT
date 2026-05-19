import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_URL } from '../config/env';

// ── Event Emitter đơn giản cho auto-logout ──
type LogoutListener = () => void;
const logoutListeners: Set<LogoutListener> = new Set();

export const onAuthExpired = (listener: LogoutListener) => {
  logoutListeners.add(listener);
  return () => {
    logoutListeners.delete(listener);
  };
};

let isLoggingOut = false;

export const triggerAutoLogout = async (reason?: string) => {
  if (isLoggingOut) return; // Tránh gọi nhiều lần liên tiếp
  isLoggingOut = true;

  console.log('⏰ [AuthService] Auto logging out, reason:', reason || 'Token expired');

  // Xóa session khỏi AsyncStorage
  try {
    await AsyncStorage.multiRemove(['@auth_token', '@auth_username']);
  } catch (e) {
    console.log('Failed to clear session on auto-logout', e);
  }

  // Thông báo cho user
  Alert.alert(
    reason === 'SESSION_REVOKED' ? 'Đăng xuất' : 'Phiên đăng nhập hết hạn',
    reason === 'SESSION_REVOKED' 
      ? 'Tài khoản của bạn đã được đăng nhập ở một nơi khác.' 
      : 'Vui lòng đăng nhập lại để tiếp tục sử dụng.',
    [{ text: 'OK' }],
  );

  // Gọi tất cả listeners (App.tsx sẽ reset state)
  logoutListeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.error('Logout listener error:', e);
    }
  });

  // Reset sau 2 giây để có thể trigger lại nếu cần
  setTimeout(() => {
    isLoggingOut = false;
  }, 2000);
};

// ── Giải mã JWT payload (không cần thư viện bên ngoài) ──
const decodeBase64Url = (str: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  
  if (str.length % 4 === 1) return '';
  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

export const decodeJwtPayload = (token: string): any | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    let decoded = '';

    // Check if atob is globally available
    if (typeof atob === 'function') {
      decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    } else {
      decoded = decodeBase64Url(payload);
    }
    
    // handle uri encoded string
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch (e) {
    console.log('Failed to decode JWT', e);
    return null;
  }
};

// ── Kiểm tra token đã hết hạn chưa ──
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true;

  // payload.exp là Unix timestamp (giây), so sánh với thời gian hiện tại
  const nowInSeconds = Math.floor(Date.now() / 1000);
  // Cho phép buffer 30 giây để tránh edge case
  return payload.exp <= nowInSeconds + 30;
};

// ── authFetch: wrapper bọc fetch() để tự phát hiện 401 ──
export const authFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const response = await fetch(url, options);

  if (response.status === 401 || response.status === 403) {
    // Token hết hạn hoặc không hợp lệ
    triggerAutoLogout();
  }

  return response;
};

// ── Hàm tạo headers có Authorization ──
export const authHeaders = (token: string, extraHeaders?: Record<string, string>): Record<string, string> => {
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
};
