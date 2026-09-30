import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { OnGatewayConnection } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { resolveSocketIdentity } from "./chat-identity.js";
import { ChatService } from "./chat.service.js";
import type { ChatAttachment, ChatIdentity } from "./chat.types.js";

interface SocketData {
  identity?: ChatIdentity;
}

@WebSocketGateway({
  namespace: "/hubs/chat",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chat: ChatService) {}

  handleConnection(client: Socket): void {
    const token =
      client.handshake.auth?.accessToken ??
      client.handshake.query?.access_token;
    const guestId =
      client.handshake.auth?.guestId ??
      client.handshake.query?.guestId;
    (client.data as SocketData).identity = resolveSocketIdentity(
      token,
      guestId,
    );
  }

  @SubscribeMessage("JoinConversation")
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.identity(client);

    if (who.isStaff) {
      this.requirePermission(who, "chat.view");
    } else if (!(await this.chat.isOwner(id, who))) {
      throw new Error("Không có quyền truy cập phiên hội thoại.");
    }

    await client.join(this.room(id));
    return { ok: true };
  }

  @SubscribeMessage("JoinAgentQueue")
  async joinAgentQueue(@ConnectedSocket() client: Socket) {
    const who = this.identity(client);
    this.requirePermission(who, "chat.view");
    await client.join("agents");
    return { ok: true };
  }

  @SubscribeMessage("SendMessage")
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: number;
      text: string;
      attachment?: ChatAttachment | null;
      guestId?: string | null;
    },
  ) {
    const id = this.id(payload?.conversationId);
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return { ok: true };

    let who = this.identity(client);
    if (!who.userId && !who.guestId && payload?.guestId) {
      who = resolveSocketIdentity(null, payload.guestId);
      (client.data as SocketData).identity = who;
    }
    if (who.isStaff) throw new Error("Staff không gửi bằng SendMessage.");

    const result = await this.chat.addCustomerMessage(
      who,
      id,
      text,
      payload?.attachment ?? null,
    );

    await this.server.to(this.room(id)).emit(
      "ReceiveMessage",
      result.customerMessage,
    );
    await this.server.to("agents").emit("ConversationUpdated", id);

    if (result.botMessage) {
      await this.server.to(this.room(id)).emit(
        "ReceiveMessage",
        result.botMessage,
      );
    }
    if (result.handedOff) {
      await this.server.to(this.room(id)).emit("HandoffRequested", id);
      await this.server.to("agents").emit("QueueUpdated", id);
    }

    return { ok: true };
  }

  @SubscribeMessage("AgentSendMessage")
  async agentSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: number;
      text: string;
      attachment?: ChatAttachment | null;
    },
  ) {
    const who = this.identity(client);
    this.requirePermission(who, "chat.reply");
    const id = this.id(payload?.conversationId);
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return { ok: true };

    const message = await this.chat.addAgentMessage(
      who.userId!,
      id,
      text,
      payload?.attachment ?? null,
    );
    await this.server.to(this.room(id)).emit("ReceiveMessage", message);
    await this.server.to("agents").emit("ConversationUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("ClaimConversation")
  async claimConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const who = this.identity(client);
    this.requirePermission(who, "chat.reply");
    const id = this.id(payload?.conversationId);
    const result = await this.chat.claimWithMessage(
      who.userId!,
      id,
      who.displayName,
    );

    if (!result.success) {
      await client.emit("ClaimFailed", id);
      return { ok: false, conflict: true };
    }

    await client.join(this.room(id));
    if (result.systemMessage) {
      await this.server.to(this.room(id)).emit(
        "ReceiveMessage",
        result.systemMessage,
      );
    }
    await this.server.to(this.room(id)).emit("ConversationUpdated", id);
    await this.server.to("agents").emit("QueueUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("RequestHandoff")
  async requestHandoff(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.identity(client);
    if (who.isStaff || !(await this.chat.isOwner(id, who))) {
      throw new Error("Không có quyền.");
    }

    const systemMessage = await this.chat.requestHandoff(id);
    if (systemMessage) {
      await this.server.to(this.room(id)).emit(
        "ReceiveMessage",
        systemMessage,
      );
    }
    await this.server.to(this.room(id)).emit("HandoffRequested", id);
    await this.server.to("agents").emit("QueueUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("EndConversation")
  async endConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { conversationId: number; guestId?: string | null },
  ) {
    const id = this.id(payload?.conversationId);
    let who = this.identity(client);
    if (!who.userId && !who.guestId && payload?.guestId) {
      who = resolveSocketIdentity(null, payload.guestId);
    }

    const ok = await this.chat.closeByCustomer(who, id);
    if (ok) {
      await this.server.to(this.room(id)).emit("ConversationClosed", id);
      await this.server.to("agents").emit("ConversationUpdated", id);
    }
    return { ok };
  }

  @SubscribeMessage("Typing")
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { conversationId: number; isTyping: boolean },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.identity(client);
    if (who.isStaff) {
      this.requirePermission(who, "chat.reply");
    } else if (!(await this.chat.isOwner(id, who))) {
      throw new Error("Không có quyền.");
    }

    await client.to(this.room(id)).emit(
      "TypingChanged",
      id,
      who.isStaff ? "agent" : "customer",
      Boolean(payload?.isTyping),
    );
    return { ok: true };
  }

  @SubscribeMessage("MarkRead")
  async markRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.identity(client);

    if (who.isStaff) {
      this.requirePermission(who, "chat.view");
      await this.chat.markRead(id, "agent");
    } else {
      if (!(await this.chat.isOwner(id, who))) {
        throw new Error("Không có quyền.");
      }
      await this.chat.markRead(id, "customer");
    }

    await this.server.to(this.room(id)).emit(
      "ReadReceipt",
      id,
      who.isStaff ? "Agent" : "Customer",
    );
    return { ok: true };
  }

  private identity(client: Socket): ChatIdentity {
    return (
      (client.data as SocketData).identity ??
      resolveSocketIdentity(null, null)
    );
  }

  private requirePermission(
    who: ChatIdentity,
    permission: string,
  ): void {
    if (
      !who.isStaff ||
      (!who.superAdmin && !who.permissions.includes(permission))
    ) {
      throw new Error("Không có quyền.");
    }
  }

  private id(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error("conversationId không hợp lệ.");
    }
    return parsed;
  }

  private room(id: number): string {
    return "conv:" + id;
  }
}
