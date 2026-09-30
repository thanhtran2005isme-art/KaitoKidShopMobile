export const CHAT_STATUS = {
  BOT: "bot",
  WAITING: "waiting",
  AGENT: "agent",
  CLOSED: "closed",
} as const;

export const CHAT_SENDER = {
  CUSTOMER: "customer",
  BOT: "bot",
  AGENT: "agent",
} as const;

export type ChatActor = "Customer" | "Bot" | "Agent";

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

export interface ChatIdentity {
  userId: number | null;
  guestId: string | null;
  displayName: string | null;
  isStaff: boolean;
  permissions: string[];
  superAdmin: boolean;
}

export interface ConversationRow {
  id: unknown;
  userId: unknown;
  guestId: string | null;
  displayName: string | null;
  status: string;
  assignedStaffId: unknown;
  productContextId: unknown;
  lastMessagePreview: string | null;
  lastMessageAt: Date | string;
  unreadForCustomer: unknown;
  unreadForAgent: unknown;
  createdAt: Date | string;
}

export interface MessageRow {
  id: unknown;
  conversationId: unknown;
  senderType: string;
  senderId: unknown;
  content: string;
  attachmentType: string | null;
  attachmentRefId: string | null;
  attachmentData: string | null;
  isRead: unknown;
  createdAt: Date | string;
}

export interface BotReply {
  text: string;
  intent: string;
  quickReplies: QuickReply[];
  attachment: ChatAttachment | null;
  shouldHandoff: boolean;
}
