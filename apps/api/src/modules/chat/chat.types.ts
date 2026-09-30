import type { AuthenticatedUser } from "../../auth/authenticated-user.js";

export type ChatStatus = "bot" | "waiting" | "agent" | "closed";
export type ChatSender = "customer" | "bot" | "agent";
export type ChatActor = "customer" | "agent";

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
  authenticated: boolean;
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

export interface MessageDto {
  id: number;
  conversationId: number;
  senderType: ChatSender;
  senderId: number | null;
  content: string;
  attachment: ChatAttachment | null;
  isRead: boolean;
  createdAt: Date | string;
  quickReplies?: QuickReply[] | null;
}

export interface BotReply {
  text: string;
  intent: string;
  attachment?: ChatAttachment | null;
  quickReplies?: QuickReply[] | null;
  shouldHandoff?: boolean;
}

export interface BotContext {
  conversationId: number;
  who: ChatIdentity;
  userText: string;
  productContextId: number | null;
  recentHistory: MessageDto[];
  botFailCount: number;
}

export function identityFromRequest(
  user: AuthenticatedUser | undefined,
  guestId: unknown,
): ChatIdentity {
  if (user && user.claims.user_type !== "staff") {
    return {
      userId: user.id,
      guestId: null,
      displayName: user.name,
      authenticated: true,
    };
  }
  const guest =
    typeof guestId === "string" && guestId.trim()
      ? guestId.trim().slice(0, 64)
      : null;
  return {
    userId: null,
    guestId: guest,
    displayName: null,
    authenticated: false,
  };
}
