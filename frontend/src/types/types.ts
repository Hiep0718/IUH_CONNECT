/**
 * IUH Connect - TypeScript Type Definitions
 */

// ============================================================
// User & Auth Types
// ============================================================

export type UserRole = 'student' | 'lecturer' | 'admin';

export type LecturerStatus = 'available' | 'busy';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  isOnline: boolean;
  lecturerStatus?: LecturerStatus;
  studentId?: string;
  lecturerId?: string;
  department?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// ============================================================
// Message & Chat Types
// ============================================================

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'auto-reply';

export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date | number;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  status?: MessageStatus;
  type?: MessageType;
  isOffline?: boolean;
  image?: string;
  file?: {
    name: string;
    size: number;
    type: string;
    url: string;
  };
  system?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  targetUserId?: string;
  avatar?: string;
  isGroup: boolean;
  participants: User[];
  lastMessage?: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  unreadCount: number;
  isOnline?: boolean;
  lecturerStatus?: LecturerStatus;
  isPinned?: boolean;
}

// ============================================================
// WebSocket Types
// ============================================================

export interface WebSocketMessage {
  senderId: string;
  receiverId: string;
  content: string;
  conversationId: string;
  timestamp: number;
  type?: MessageType;
}

// ============================================================
// Navigation Types
// ============================================================

export type MainTabParamList = {
  Home: undefined;
  ChatList: undefined;
  Contacts: undefined;
  Groups: undefined;
  Profile: undefined;
};

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
  VideoCall: {
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    isIncoming?: boolean;
    token?: string;
    roomName?: string;
  };
  ProfileSettings: undefined;
};

// ============================================================
// Attachment Types
// ============================================================

export interface Attachment {
  name: string;
  uri: string;
  type: string;
  size: number;
}

export type AttachmentType = 'image' | 'file';
