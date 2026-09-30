/**
 * Adapter realtime chat cho NestJS Socket.IO.
 * Giữ nguyên public API ChatHubClient để ChatContext/AdminChat không phải đổi UI.
 */
import { io, type Socket } from 'socket.io-client';
import { getOrCreateGuestId } from '../utils/guestId';
import type { ChatAttachment, ChatMessage } from './chatService';

const HUB_URL =
  (import.meta.env.VITE_CHAT_HUB_URL as string) ||
  (import.meta.env.VITE_NODE_API_URL as string) ||
  'http://localhost:5300';

const HUB_PATH =
  (import.meta.env.VITE_CHAT_HUB_PATH as string) || '/chatHub';

export type ChatHubEvents = {
  onReceiveMessage?: (msg: ChatMessage) => void;
  onConversationUpdated?: (conversationId: number) => void;
  onTypingChanged?: (
    conversationId: number,
    role: string,
    isTyping: boolean,
  ) => void;
  onReadReceipt?: (conversationId: number, by: string) => void;
  onQueueUpdated?: (conversationId: number) => void;
  onHandoffRequested?: (conversationId: number) => void;
  onConversationClosed?: (conversationId: number) => void;
  onClaimFailed?: (conversationId: number) => void;
  onReconnected?: () => void;
};

export type ChatHubState =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected';

export class ChatHubClient {
  private readonly socket: Socket;
  private events: ChatHubEvents = {};
  private connectedOnce = false;

  constructor(private readonly getToken: () => string | null) {
    this.socket = io(HUB_URL, {
      path: HUB_PATH,
      autoConnect: false,
      reconnection: true,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('ReceiveMessage', (m: ChatMessage) =>
      this.events.onReceiveMessage?.(m));
    this.socket.on('ConversationUpdated', (id: number) =>
      this.events.onConversationUpdated?.(id));
    this.socket.on(
      'TypingChanged',
      (id: number, role: string, isTyping: boolean) =>
        this.events.onTypingChanged?.(id, role, isTyping),
    );
    this.socket.on('ReadReceipt', (id: number, by: string) =>
      this.events.onReadReceipt?.(id, by));
    this.socket.on('QueueUpdated', (id: number) =>
      this.events.onQueueUpdated?.(id));
    this.socket.on('HandoffRequested', (id: number) =>
      this.events.onHandoffRequested?.(id));
    this.socket.on('ConversationClosed', (id: number) =>
      this.events.onConversationClosed?.(id));
    this.socket.on('ClaimFailed', (id: number) =>
      this.events.onClaimFailed?.(id));

    this.socket.on('connect', () => {
      if (this.connectedOnce) this.events.onReconnected?.();
      this.connectedOnce = true;
    });
  }

  setEvents(events: ChatHubEvents) {
    this.events = { ...this.events, ...events };
  }

  get state(): ChatHubState {
    if (this.socket.connected) return 'Connected';
    if (this.socket.active) return 'Connecting';
    return 'Disconnected';
  }

  async start(): Promise<void> {
    if (this.socket.connected) return;

    this.socket.auth = {
      accessToken: this.getToken() ?? '',
      guestId: getOrCreateGuestId(),
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Socket.IO connect timeout'));
      }, 10_000);

      const cleanup = () => {
        window.clearTimeout(timeout);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
  }

  async stop(): Promise<void> {
    this.socket.disconnect();
  }

  private async emit(event: string, payload?: unknown): Promise<void> {
    if (!this.socket.connected) {
      throw new Error('Chat realtime chưa kết nối');
    }
    await this.socket.timeout(10_000).emitWithAck(event, payload);
  }

  joinConversation(conversationId: number) {
    return this.emit('JoinConversation', conversationId);
  }

  sendMessage(
    conversationId: number,
    text: string,
    attach?: ChatAttachment,
    guestId?: string,
  ) {
    return this.emit('SendMessage', {
      conversationId,
      text,
      attach: attach ?? null,
      guestId: guestId ?? null,
    });
  }

  requestHandoff(conversationId: number) {
    return this.emit('RequestHandoff', conversationId);
  }

  endConversation(conversationId: number, guestId?: string) {
    return this.emit('EndConversation', {
      conversationId,
      guestId: guestId ?? null,
    });
  }

  typing(conversationId: number, isTyping: boolean) {
    return this.emit('Typing', { conversationId, isTyping });
  }

  markRead(conversationId: number) {
    return this.emit('MarkRead', conversationId);
  }

  joinAgentQueue() {
    return this.emit('JoinAgentQueue');
  }

  claimConversation(conversationId: number) {
    return this.emit('ClaimConversation', conversationId);
  }

  agentSendMessage(
    conversationId: number,
    text: string,
    attach?: ChatAttachment,
  ) {
    return this.emit('AgentSendMessage', {
      conversationId,
      text,
      attach: attach ?? null,
    });
  }
}
