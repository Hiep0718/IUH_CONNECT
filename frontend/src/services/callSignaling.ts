/**
 * Call signaling utilities cho meeting.
 * Tạo payload CALL_SIGNAL chuẩn để gửi qua WebSocket.
 */

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

/** Type guard — kiểm tra data có phải CALL_SIGNAL không */
export const isCallSignal = (data: any): data is CallSignal => {
  return data && data.type === 'CALL_SIGNAL';
};

/** Tạo CALL_INVITE payload */
export const createCallInvite = (
  receiverId: string,
  roomName: string,
): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_INVITE',
  receiverId,
  roomName,
  timestamp: Date.now(),
});

/** Tạo CALL_ACCEPT payload */
export const createCallAccept = (
  receiverId: string,
  meetingId?: string,
  roomName?: string,
): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_ACCEPT',
  receiverId,
  meetingId,
  roomName,
  timestamp: Date.now(),
});

/** Tạo CALL_REJECT payload */
export const createCallReject = (
  receiverId: string,
  meetingId?: string,
): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_REJECT',
  receiverId,
  meetingId,
  timestamp: Date.now(),
});

/** Tạo CALL_END payload */
export const createCallEnd = (
  receiverId: string,
  meetingId?: string,
): CallSignal => ({
  type: 'CALL_SIGNAL',
  signalType: 'CALL_END',
  receiverId,
  meetingId,
  timestamp: Date.now(),
});
