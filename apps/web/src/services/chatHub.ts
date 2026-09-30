/**
 * Realtime chat transport.
 *
 * Mặc định vẫn dùng SignalR/C# để rollback an toàn trong coexistence.
 * Khi runtime parity Node PASS, đặt VITE_CHAT_TRANSPORT=socketio và
 * VITE_CHAT_HUB_URL=http://localhost:5300/hubs/chat để cutover realtime.
 *
 * Public class API giữ nguyên để ChatContext/AdminChat không cần rewrite.
 */
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { io, type Socket } from 'socket.io-client';
import type { ChatAttachment, ChatMessage } from './chatService';
import { getOrCreateGuestId } from '../utils/guestId';

const TRANSPORT =
  ((import.meta.env.VITE_CHAT_TRANSPORT as string) || 'signalr').toLowerCase();

const DEFAULT_HUB_URL =
  TRANSPORT === 'socketio'
    ? 'http://localhost:5300/hubs/chat'
    : 'http://localhost:5265/hubs/chat';

const HUB_URL =
  (import.meta.env.VITE_CHAT_HUB_URL as string) || DEFAULT_HUB_URL;

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

type CompatState =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Disconnecting'
  | 'Reconnecting';

export class ChatHubClient {
  private signalR: HubConnection | null = null;
  private socket: Socket | null = null;
  private events: ChatHubEvents = {};
  private readonly getToken: () => string | null;
  private socketState: CompatState = 'Disconnected';

  constructor(getToken: () => string | null) {
    this.getToken = getToken;

    if (TRANSPORT === 'socketio') {
      this.socket = io(HUB_URL, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: (cb) => {
          cb({
            accessToken: this.getToken() ?? '',
            guestId: getOrCreateGuestId(),
          });
        },
      });
      this.bindSocket();
    } else {
      this.signalR = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => this.getToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();
      this.bindSignalR();
    }
  }

  setEvents(events: ChatHubEvents) {
    this.events = { ...this.events, ...events };
  }

  get state(): CompatState | HubConnectionState {
    return this.signalR ? this.signalR.state : this.socketState;
  }

  async start(): Promise<void> {
    if (this.signalR) {
      if (this.signalR.state === HubConnectionState.Disconnected) {
        await this.signalR.start();
      }
      return;
    }

    const socket = this.socket;
    if (!socket || socket.connected) return;
    this.socketState = 'Connecting';
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        this.socketState = 'Connected';
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        this.socketState = 'Disconnected';
        reject(error);
      };
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };
      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
      socket.connect();
    });
  }

  async stop(): Promise<void> {
    if (this.signalR) {
      await this.signalR.stop();
      return;
    }
    this.socket?.disconnect();
    this.socketState = 'Disconnected';
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
    if (this.signalR) {
      return this.signalR.invoke(
        'SendMessage',
        conversationId,
        text,
        attach ?? null,
        guestId ?? null,
      );
    }
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
    if (this.signalR) {
      return this.signalR.invoke(
        'EndConversation',
        conversationId,
        guestId ?? null,
      );
    }
    return this.invoke('EndConversation', {
      conversationId,
      guestId: guestId ?? null,
    });
  }

  typing(conversationId: number, isTyping: boolean) {
    if (this.signalR) {
      return this.signalR.invoke('Typing', conversationId, isTyping);
    }
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
    if (this.signalR) {
      return this.signalR.invoke(
        'AgentSendMessage',
        conversationId,
        text,
        attach ?? null,
      );
    }
    return this.invoke('AgentSendMessage', {
      conversationId,
      text,
      attachment: attach ?? null,
    });
  }

  private invoke(event: string, payload: unknown): Promise<void> {
    if (this.signalR) {
      if (event === 'JoinConversation') {
        return this.signalR.invoke(
          event,
          (payload as { conversationId: number }).conversationId,
        );
      }
      if (event === 'RequestHandoff' || event === 'MarkRead') {
        return this.signalR.invoke(
          event,
          (payload as { conversationId: number }).conversationId,
        );
      }
      if (event === 'JoinAgentQueue') {
        return this.signalR.invoke(event);
      }
      if (event === 'ClaimConversation') {
        return this.signalR.invoke(
          event,
          (payload as { conversationId: number }).conversationId,
        );
      }
      return this.signalR.invoke(event, payload);
    }

    const socket = this.socket;
    if (!socket?.connected) {
      return Promise.reject(new Error('Realtime socket chưa kết nối.'));
    }
    return new Promise<void>((resolve, reject) => {
      socket.timeout(10_000).emit(
        event,
        payload,
        (error: Error | null, response?: { ok?: boolean; reason?: string }) => {
          if (error) {
            reject(error);
            return;
          }
          if (response?.ok === false) {
            reject(new Error(response.reason || 'Realtime command failed.'));
            return;
          }
          resolve();
        },
      );
    });
  }

  private bindSignalR() {
    const connection = this.signalR!;
    connection.on('ReceiveMessage', (m: ChatMessage) =>
      this.events.onReceiveMessage?.(m));
    connection.on('ConversationUpdated', (id: number) =>
      this.events.onConversationUpdated?.(id));
    connection.on(
      'TypingChanged',
      (id: number, role: string, isTyping: boolean) =>
        this.events.onTypingChanged?.(id, role, isTyping),
    );
    connection.on('ReadReceipt', (id: number, by: string) =>
      this.events.onReadReceipt?.(id, by));
    connection.on('QueueUpdated', (id: number) =>
      this.events.onQueueUpdated?.(id));
    connection.on('HandoffRequested', (id: number) =>
      this.events.onHandoffRequested?.(id));
    connection.on('ConversationClosed', (id: number) =>
      this.events.onConversationClosed?.(id));
    connection.on('ClaimFailed', (id: number) =>
      this.events.onClaimFailed?.(id));
    connection.onreconnected(() => this.events.onReconnected?.());
  }

  private bindSocket() {
    const socket = this.socket!;
    socket.on('connect', () => {
      const wasReconnect =
        this.socketState === 'Reconnecting' ||
        this.socketState === 'Disconnected';
      this.socketState = 'Connected';
      if (wasReconnect) this.events.onReconnected?.();
    });
    socket.on('disconnect', () => {
      this.socketState = 'Disconnected';
    });
    socket.io.on('reconnect_attempt', () => {
      this.socketState = 'Reconnecting';
    });
    socket.on('ReceiveMessage', (m: ChatMessage) =>
      this.events.onReceiveMessage?.(m));
    socket.on('ConversationUpdated', (id: number) =>
      this.events.onConversationUpdated?.(id));
    socket.on(
      'TypingChanged',
      (id: number, role: string, isTyping: boolean) =>
        this.events.onTypingChanged?.(id, role, isTyping),
    );
    socket.on('ReadReceipt', (id: number, by: string) =>
      this.events.onReadReceipt?.(id, by));
    socket.on('QueueUpdated', (id: number) =>
      this.events.onQueueUpdated?.(id));
    socket.on('HandoffRequested', (id: number) =>
      this.events.onHandoffRequested?.(id));
    socket.on('ConversationClosed', (id: number) =>
      this.events.onConversationClosed?.(id));
    socket.on('ClaimFailed', (id: number) =>
      this.events.onClaimFailed?.(id));
  }
}
