import { Platform } from 'react-native';

/**
 * CẤU HÌNH ĐỊA CHỈ IP MÁY CHỦ (BACKEND)
 * 
 * 1. Nếu chạy trên máy ảo Android (Emulator) trên cùng 1 máy tính:
 *    - Thường IP là '10.0.2.2'
 * 
 * 2. Nếu chạy trên máy ảo iOS (Simulator):
 *    - Thường IP là 'localhost'
 * 
 * 3. Nếu chạy trên THIẾT BỊ THẬT (điện thoại cắm cáp/wifi) hoặc Expo Go:
 *    - BẠN PHẢI ĐỔI THÀNH IP LAN CỦA MÁY TÍNH ĐANG CHẠY SPRING BOOT
 *    - Ví dụ: '192.168.1.45'
 *    - Cách xem IP: mở cmd gõ `ipconfig` (Windows) hoặc `ifconfig` (Mac)
 */

// Đổi dòng này thành IP LAN của bạn, ví dụ: const SERVER_IP = '192.168.1.45';
// Nếu để 'AUTO', app sẽ tự động chọn 10.0.2.2 cho Android và localhost cho iOS (chỉ chạy được trên máy ảo)
const SERVER_IP: string = '192.168.1.139';
const SERVER_PORT = '8080';

const getHost = () => {
  if (SERVER_IP && SERVER_IP !== 'AUTO') {
    return SERVER_IP;
  }
  return Platform.select({
    android: '10.0.2.2',
    default: 'localhost',
  });
};

export const HOST = getHost();

export const API_URL = `http://${HOST}:${SERVER_PORT}`;
export const WS_URL = `ws://${HOST}:${SERVER_PORT}`;
