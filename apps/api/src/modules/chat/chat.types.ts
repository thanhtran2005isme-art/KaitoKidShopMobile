export type ChatStatus = "bot" | "waiting" | "agent" | "closed";
export type SenderType = "customer" | "bot" | "agent";

export interface ChatAttachment {
  type: string;
  refId: string;
  title?: string | null;
  imageUrl?: string | null;
  subtitle?: string | null;
  url?: string | null;
}

export interface QuickReply {
  label: string;
  payload: string;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  senderType: SenderType;
  senderId: number | null;
  content: string;
  attachment: ChatAttachment | null;
  isRead: boolean;
  createdAt: Date | string;
  quickReplies?: QuickReply[] | null;
}

export interface ConversationDto {
  id: number;
  status: ChatStatus;
  userId: number | null;
  guestId: string | null;
  displayName: string | null;
  assignedStaffId: number | null;
  productContextId: number | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | string;
  unreadForCustomer: number;
  unreadForAgent: number;
  createdAt: Date | string;
}

export interface ChatIdentity {
  userId: number | null;
  guestId: string | null;
  displayName: string | null;
  isStaff: boolean;
  superAdmin: boolean;
  permissions: string[];
}

export interface BotReply {
  text: string;
  intent: string;
  quickReplies: QuickReply[];
  attachment: ChatAttachment | null;
  shouldHandoff: boolean;
}
