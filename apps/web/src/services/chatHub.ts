/**
 * Socket.IO realtime client cho Node Chat Gateway.
 * Giữ nguyên public API của ChatHubClient cũ để ChatContext/AdminChat không phải đổi UI.
 */
import { io, type Socket } from 'socket.io-client';
import type { ChatAttachment, ChatMessage } from './chatService';
import { getOrCreateGuestId } from '../utils/guestId';

const HUB_URL =
  (import.meta.env.VITE_CHAT_HUB_URL as string) ||
  'http://localhost:5300/hubs/chat';

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

export class ChatHubClient {
  private readonly socket: Socket;
  private events: ChatHubEvents = {};
  private readonly getToken: () => string | null;
  private connectedOnce = false;

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
    this.socket = io(HUB_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        accessToken: getToken() ?? '',
        guestId: getOrCreateGuestId(),
      },
      reconnection: true,
    });

    this.socket.on('ReceiveMessage', (msg: ChatMessage) =>
      this.events.onReceiveMessage?.(msg));
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
    this.socket.io.on('reconnect_attempt', () => {
      this.socket.auth = {
        accessToken: this.getToken() ?? '',
        guestId: getOrCreateGuestId(),
      };
    });

    this.socket.on('connect', () => {
      if (this.connectedOnce) this.events.onReconnected?.();
      this.connectedOnce = true;
    });
  }

  setEvents(events: ChatHubEvents) {
    this.events = { ...this.events, ...events };
  }

  get state(): 'Connected' | 'Disconnected' {
    return this.socket.connected ? 'Connected' : 'Disconnected';
  }

  async start(): Promise<void> {
    if (this.socket.connected) return;

    this.socket.auth = {
      accessToken: this.getToken() ?? '',
      guestId: getOrCreateGuestId(),
    };

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
  }

  async stop(): Promise<void> {
    this.socket.disconnect();
  }

  joinConversation(conversationId: number) {
    return this.invoke('JoinConversation', { conversationId });
  }

  sendMessage(
    conversationId: number,
    text: string,
    attach?: ChatAttachment,
    guestId?: string,
  ) {
    return this.invoke('SendMessage', {
      conversationId,
      text,
      attachment: attach ?? null,
      guestId: guestId ?? null,
    });
  }

  requestHandoff(conversationId: number) {
    return this.invoke('RequestHandoff', { conversationId });
  }

  endConversation(conversationId: number, guestId?: string) {
    return this.invoke('EndConversation', {
      conversationId,
      guestId: guestId ?? null,
    });
  }

  typing(conversationId: number, isTyping: boolean) {
    return this.invoke('Typing', { conversationId, isTyping });
  }

  markRead(conversationId: number) {
    return this.invoke('MarkRead', { conversationId });
  }

  joinAgentQueue() {
    return this.invoke('JoinAgentQueue', {});
  }

  claimConversation(conversationId: number) {
    return this.invoke('ClaimConversation', { conversationId });
  }

  agentSendMessage(
    conversationId: number,
    text: string,
    attach?: ChatAttachment,
  ) {
    return this.invoke('AgentSendMessage', {
      conversationId,
      text,
      attachment: attach ?? null,
    });
  }

  private async invoke(event: string, payload: unknown): Promise<void> {
    const result = await this.socket
      .timeout(10_000)
      .emitWithAck(event, payload) as
      | { ok?: boolean; conflict?: boolean }
      | undefined;

    if (result?.conflict || result?.ok === false) {
      throw new Error('Realtime operation failed');
    }
  }
}
