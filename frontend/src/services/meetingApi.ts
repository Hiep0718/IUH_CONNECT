/**
 * Meeting REST API helpers.
 */

import { API_URL } from '../config/env';

/**
 * Tạo handoff token để chuyển cuộc họp sang desktop.
 * Backend lấy userId từ JWT — không cần truyền userId.
 */
export const createHandoffToken = async (
  meetingId: string,
  authToken: string,
): Promise<{ handoffToken: string; meetingUrl: string }> => {
  const res = await fetch(
    `${API_URL}/api/v1/meetings/${meetingId}/handoff-token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create handoff token: ${res.status}`);
  }

  return res.json();
};
