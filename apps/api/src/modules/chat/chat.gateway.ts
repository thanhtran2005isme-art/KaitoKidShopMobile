import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { chatIdentityFromAuthorization, canChat } from "./chat-identity.js";
import { ChatService } from "./chat.service.js";
import type { ChatAttachment, ChatIdentity } from "./chat.types.js";

interface SocketData {
  identity?: ChatIdentity;
}

@WebSocketGateway({
  path: "/chatHub",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly chat: ChatService) {}

  handleConnection(client: Socket) {
    const token =
      typeof client.handshake.auth?.accessToken === "string"
        ? client.handshake.auth.accessToken
        : typeof client.handshake.query.access_token === "string"
          ? client.handshake.query.access_token
          : "";
    const guestId =
      typeof client.handshake.auth?.guestId === "string"
        ? client.handshake.auth.guestId
        : typeof client.handshake.query.guestId === "string"
          ? client.handshake.query.guestId
          : null;
    const authorization = token
      ? token.startsWith("Bearer ") ? token : `Bearer ${token}`
      : undefined;
    (client.data as SocketData).identity =
      chatIdentityFromAuthorization(authorization, guestId);
  }

  @SubscribeMessage("JoinConversation")
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const who = this.identity(client);
    if (
      !who.isStaff &&
      !(await this.chat.isOwner(Number(conversationId), who))
    ) {
      throw new Error("Không có quyền truy cập phiên hội thoại.");
    }
    if (
      who.isStaff &&
      !canChat(who, "chat.view") &&
      !canChat(who, "chat.reply")
    ) {
      throw new Error("Không có quyền.");
    }
    await client.join(this.conv(Number(conversationId)));
  }

  @SubscribeMessage("JoinAgentQueue")
  async joinAgents(@ConnectedSocket() client: Socket) {
    const who = this.identity(client);
    if (!canChat(who, "chat.view")) {
      throw new Error("Chỉ nhân viên hỗ trợ mới được vào hàng đợi.");
    }
    await client.join("agents");
  }

  @SubscribeMessage("SendMessage")
  async send(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: {
      conversationId: number;
      text: string;
      attach?: ChatAttachment | null;
      guestId?: string | null;
    },
  ) {
    let who = this.identity(client);
    if (!who.userId && body.guestId && who.guestId !== body.guestId) {
      who = { ...who, guestId: body.guestId };
    }
    const result = await this.chat.addCustomerMessage(
      who,
      Number(body.conversationId),
      body.text ?? "",
      body.attach ?? null,
    );
    this.server.to(this.conv(body.conversationId))
      .emit("ReceiveMessage", result.customerMessage);
    this.server.to("agents")
      .emit("ConversationUpdated", body.conversationId);
    if (result.botMessage) {
      this.server.to(this.conv(body.conversationId))
        .emit("ReceiveMessage", result.botMessage);
    }
    if (result.handedOff) {
      this.server.to(this.conv(body.conversationId))
        .emit("HandoffRequested", body.conversationId);
      this.server.to("agents")
        .emit("QueueUpdated", body.conversationId);
    }
  }

  @SubscribeMessage("AgentSendMessage")
  async agentSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: {
      conversationId: number;
      text: string;
      attach?: ChatAttachment | null;
    },
  ) {
    const who = this.identity(client);
    if (!who.userId || !canChat(who, "chat.reply")) {
      throw new Error("Không có quyền.");
    }
    const msg = await this.chat.addAgentMessage(
      who.userId,
      Number(body.conversationId),
      body.text ?? "",
      body.attach ?? null,
    );
    this.server.to(this.conv(body.conversationId))
      .emit("ReceiveMessage", msg);
    this.server.to("agents")
      .emit("ConversationUpdated", body.conversationId);
  }

  @SubscribeMessage("ClaimConversation")
  async claim(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const who = this.identity(client);
    if (!who.userId || !canChat(who, "chat.reply")) {
      throw new Error("Không có quyền.");
    }
    const result = await this.chat.claim(
      who.userId,
      Number(conversationId),
      who.displayName ?? undefined,
    );
    if (!result.success) {
      client.emit("ClaimFailed", conversationId);
      return;
    }
    await client.join(this.conv(Number(conversationId)));
    if (result.systemMessage) {
      this.server.to(this.conv(Number(conversationId)))
        .emit("ReceiveMessage", result.systemMessage);
    }
    this.server.to(this.conv(Number(conversationId)))
      .emit("ConversationUpdated", conversationId);
    this.server.to("agents").emit("QueueUpdated", conversationId);
  }

  @SubscribeMessage("RequestHandoff")
  async handoff(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const who = this.identity(client);
    const msg = await this.chat.requestHandoff(
      who,
      Number(conversationId),
      null,
    );
    if (msg) {
      this.server.to(this.conv(Number(conversationId)))
        .emit("ReceiveMessage", msg);
    }
    this.server.to(this.conv(Number(conversationId)))
      .emit("HandoffRequested", conversationId);
    this.server.to("agents").emit("QueueUpdated", conversationId);
  }

  @SubscribeMessage("EndConversation")
  async end(
    @ConnectedSocket() client: Socket,
    @MessageBody() body:
      | number
      | { conversationId: number; guestId?: string | null },
  ) {
    const conversationId =
      typeof body === "number" ? body : body.conversationId;
    let who = this.identity(client);
    if (
      typeof body !== "number" &&
      !who.userId &&
      body.guestId
    ) {
      who = { ...who, guestId: body.guestId };
    }
    const ok = await this.chat.closeByCustomer(who, conversationId);
    if (ok) {
      this.server.to(this.conv(conversationId))
        .emit("ConversationClosed", conversationId);
      this.server.to("agents")
        .emit("ConversationUpdated", conversationId);
    }
  }

  @SubscribeMessage("Typing")
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: {
      conversationId: number;
      isTyping: boolean;
    },
  ) {
    const who = this.identity(client);
    client.to(this.conv(body.conversationId)).emit(
      "TypingChanged",
      body.conversationId,
      who.isStaff ? "agent" : "customer",
      Boolean(body.isTyping),
    );
  }

  @SubscribeMessage("MarkRead")
  async markRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: number,
  ) {
    const who = this.identity(client);
    if (
      !who.isStaff &&
      !(await this.chat.isOwner(Number(conversationId), who))
    ) {
      throw new Error("Không có quyền.");
    }
    if (who.isStaff && !canChat(who, "chat.view")) {
      throw new Error("Không có quyền.");
    }
    const actor = who.isStaff ? "Agent" : "Customer";
    await this.chat.markRead(Number(conversationId), actor);
    this.server.to(this.conv(Number(conversationId)))
      .emit("ReadReceipt", conversationId, actor);
  }

  private identity(client: Socket): ChatIdentity {
    return (
      (client.data as SocketData).identity ??
      chatIdentityFromAuthorization(undefined, null)
    );
  }

  private conv(id: number) {
    return `conv:${id}`;
  }
}
