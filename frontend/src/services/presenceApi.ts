import { API_URL } from '../config/env';
import { authFetch } from './authService';

/**
 * Presence API — Work Status Management (UC10)
 * Only available for LECTURER accounts.
 */

export interface WorkStatusInfo {
  userId: string;
  workStatus: 'BUSY' | 'AVAILABLE' | 'NONE';
  autoReplyEnabled: boolean;
  autoReplyMessage: string | null;
}

/**
 * Set the lecturer's work status.
 * @param token - JWT access token
 * @param status - 'BUSY' or 'AVAILABLE'
 * @param autoReplyMessage - Message to auto-reply (only when BUSY)
 */
export const setWorkStatus = async (
  token: string,
  status: 'BUSY' | 'AVAILABLE',
  autoReplyMessage?: string,
): Promise<WorkStatusInfo> => {
  const response = await authFetch(`${API_URL}/api/v1/presence/work-status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({status, autoReplyMessage}),
  });

  if (!response.ok) {
    throw new Error(`Failed to set work status: ${response.status}`);
  }

  return response.json();
};

/**
 * Clear the lecturer's work status (back to normal ONLINE).
 */
export const clearWorkStatus = async (token: string): Promise<void> => {
  const response = await authFetch(`${API_URL}/api/v1/presence/work-status`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to clear work status: ${response.status}`);
  }
};

/**
 * Get the work status of a specific user.
 */
export const getWorkStatus = async (
  token: string,
  userId: string,
): Promise<WorkStatusInfo> => {
  const response = await authFetch(
    `${API_URL}/api/v1/presence/work-status/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get work status: ${response.status}`);
  }

  return response.json();
};

/**
 * Pre-defined auto-reply message templates for lecturers.
 */
export const AUTO_REPLY_TEMPLATES = [
  'Tôi đang bận họp, sẽ phản hồi sau.',
  'Hiện tại tôi không thể trả lời, vui lòng liên hệ sau.',
  'Tôi đang trong giờ giảng dạy, sẽ trả lời khi rảnh.',
  'Xin vui lòng gửi email nếu có vấn đề gấp. Tôi sẽ phản hồi tin nhắn sớm nhất có thể.',
];
