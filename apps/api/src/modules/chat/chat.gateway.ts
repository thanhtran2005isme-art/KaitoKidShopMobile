import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { authenticatedUserFromToken } from "../../auth/jwt-auth.guard.js";
import {
  hasStaffPermission,
  isStaffUser,
} from "../identity/staff-permissions.js";
import { ChatService } from "./chat.service.js";
import {
  identityFromRequest,
  type ChatAttachment,
  type ChatIdentity,
} from "./chat.types.js";

const SOCKET_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

interface ChatSocketData {
  user?: AuthenticatedUser;
  guestId?: string | null;
}

type ChatSocket = Socket<any, any, any, ChatSocketData>;

@WebSocketGateway({
  namespace: "/hubs/chat",
  cors: {
    origin: SOCKET_ORIGINS.length > 0 ? SOCKET_ORIGINS : false,
    credentials: true,
  },
  transports: ["websocket", "polling"],
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chat: ChatService) {}

  handleConnection(client: ChatSocket) {
    const auth = client.handshake.auth as Record<string, unknown>;
    const query = client.handshake.query;
    const token =
      typeof auth?.accessToken === "string"
        ? auth.accessToken
        : typeof query.access_token === "string"
          ? query.access_token
          : "";
    const guestId =
      typeof auth?.guestId === "string"
        ? auth.guestId
        : typeof query.guestId === "string"
          ? query.guestId
          : null;

    if (token.trim()) {
      try {
        client.data.user = authenticatedUserFromToken(token.trim());
      } catch {
        client.data.user = undefined;
      }
    }
    client.data.guestId = guestId?.trim().slice(0, 64) || null;
  }

  @SubscribeMessage("JoinConversation")
  async joinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    if (this.staffCanView(client)) {
      await client.join(this.convRoom(id));
      return { ok: true };
    }

    const who = this.customerIdentity(client);
    if (!(await this.chat.isOwner(id, who))) {
      throw new WsException("Không có quyền truy cập hội thoại.");
    }
    await client.join(this.convRoom(id));
    return { ok: true };
  }

  @SubscribeMessage("JoinAgentQueue")
  async joinAgentQueue(@ConnectedSocket() client: ChatSocket) {
    const user = this.staff(client, "chat.view");
    if (!user) throw new WsException("Không có quyền.");
    await client.join("agents");
    return { ok: true };
  }

  @SubscribeMessage("SendMessage")
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: {
      conversationId: number;
      text: string;
      attachment?: ChatAttachment | null;
      guestId?: string | null;
    },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.customerIdentity(client, payload?.guestId);
    const result = await this.chat.addCustomerMessage(
      who,
      id,
      typeof payload?.text === "string" ? payload.text : "",
      payload?.attachment ?? null,
    );

    this.server.to(this.convRoom(id)).emit(
      "ReceiveMessage",
      result.customerMessage,
    );
    this.server.to("agents").emit("ConversationUpdated", id);

    if (result.botMessage) {
      this.server.to(this.convRoom(id)).emit(
        "ReceiveMessage",
        result.botMessage,
      );
    }
    if (result.handedOff) {
      this.server.to(this.convRoom(id)).emit("HandoffRequested", id);
      this.server.to("agents").emit("QueueUpdated", id);
    }
    return { ok: true };
  }

  @SubscribeMessage("AgentSendMessage")
  async agentSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: {
      conversationId: number;
      text: string;
      attachment?: ChatAttachment | null;
    },
  ) {
    const user = this.staff(client, "chat.reply");
    const id = this.id(payload?.conversationId);
    const message = await this.chat.addAgentMessage(
      user.id,
      id,
      typeof payload?.text === "string" ? payload.text : "",
      payload?.attachment ?? null,
    );
    this.server.to(this.convRoom(id)).emit("ReceiveMessage", message);
    this.server.to("agents").emit("ConversationUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("ClaimConversation")
  async claimConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const user = this.staff(client, "chat.reply");
    const id = this.id(payload?.conversationId);
    const result = await this.chat.claim(user.id, id, user.name);
    if (!result.success) {
      client.emit("ClaimFailed", id);
      return { ok: false, reason: "claimed" };
    }

    await client.join(this.convRoom(id));
    if (result.systemMessage) {
      this.server.to(this.convRoom(id)).emit(
        "ReceiveMessage",
        result.systemMessage,
      );
    }
    this.server.to(this.convRoom(id)).emit("ConversationUpdated", id);
    this.server.to("agents").emit("QueueUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("RequestHandoff")
  async requestHandoff(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    const who = this.customerIdentity(client);
    if (!(await this.chat.isOwner(id, who))) {
      throw new WsException("Không có quyền.");
    }
    const message = await this.chat.requestHandoff(id, null);
    if (message) {
      this.server.to(this.convRoom(id)).emit("ReceiveMessage", message);
    }
    this.server.to(this.convRoom(id)).emit("HandoffRequested", id);
    this.server.to("agents").emit("QueueUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("EndConversation")
  async endConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: { conversationId: number; guestId?: string | null },
  ) {
    const id = this.id(payload?.conversationId);
    const ok = await this.chat.closeByCustomer(
      this.customerIdentity(client, payload?.guestId),
      id,
    );
    if (!ok) throw new WsException("Không tìm thấy hội thoại.");
    this.server.to(this.convRoom(id)).emit("ConversationClosed", id);
    this.server.to("agents").emit("ConversationUpdated", id);
    return { ok: true };
  }

  @SubscribeMessage("Typing")
  async typing(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: { conversationId: number; isTyping: boolean },
  ) {
    const id = this.id(payload?.conversationId);
    const user = client.data.user;
    const staff = Boolean(user && isStaffUser(user));
    if (staff) {
      this.staff(client, "chat.reply");
    } else if (!(await this.chat.isOwner(id, this.customerIdentity(client)))) {
      throw new WsException("Không có quyền.");
    }
    client.to(this.convRoom(id)).emit(
      "TypingChanged",
      id,
      staff ? "agent" : "customer",
      Boolean(payload?.isTyping),
    );
    return { ok: true };
  }

  @SubscribeMessage("MarkRead")
  async markRead(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const id = this.id(payload?.conversationId);
    const user = client.data.user;
    if (user && isStaffUser(user)) {
      this.staff(client, "chat.view");
      await this.chat.markRead(id, "agent");
      this.server.to(this.convRoom(id)).emit("ReadReceipt", id, "Agent");
    } else {
      const who = this.customerIdentity(client);
      if (!(await this.chat.isOwner(id, who))) {
        throw new WsException("Không có quyền.");
      }
      await this.chat.markRead(id, "customer");
      this.server.to(this.convRoom(id)).emit("ReadReceipt", id, "Customer");
    }
    return { ok: true };
  }

  private customerIdentity(
    client: ChatSocket,
    guestOverride?: string | null,
  ): ChatIdentity {
    const guest = guestOverride?.trim() || client.data.guestId || null;
    return identityFromRequest(client.data.user, guest);
  }

  private staff(client: ChatSocket, permission: string): AuthenticatedUser {
    const user = client.data.user;
    if (!user || !isStaffUser(user) || !hasStaffPermission(user, permission)) {
      throw new WsException("Không có quyền.");
    }
    return user;
  }

  private staffCanView(client: ChatSocket): boolean {
    const user = client.data.user;
    return Boolean(
      user &&
      isStaffUser(user) &&
      hasStaffPermission(user, "chat.view"),
    );
  }

  private convRoom(id: number) {
    return `conv:${id}`;
  }

  private id(value: unknown): number {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new WsException("conversationId không hợp lệ.");
    }
    return id;
  }
}
