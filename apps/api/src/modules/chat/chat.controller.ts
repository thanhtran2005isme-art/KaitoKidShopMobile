import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "../../auth/optional-jwt-auth.guard.js";
import { pathInt, queryInt } from "../../common/query-value.js";
import {
  assertStaffPermission,
  isStaffUser,
} from "../identity/staff-permissions.js";
import { ChatBotService } from "./chat-bot.service.js";
import { ChatService } from "./chat.service.js";
import {
  identityFromRequest,
  type ChatAttachment,
} from "./chat.types.js";

interface RequestLike {
  user?: AuthenticatedUser;
}

@Controller("api/chat")
@UseGuards(OptionalJwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly bot: ChatBotService,
  ) {}

  @Get("bot-mode")
  botMode() {
    return this.bot.mode();
  }

  @Post("conversations")
  async createOrGet(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    const who = identityFromRequest(req.user, body.guestId);
    if (!who.authenticated && !who.guestId) {
      throw new BadRequestException({
        message: "Thiếu định danh khách (guestId).",
      });
    }
    const productContextId =
      body.productContextId === null ||
      body.productContextId === undefined
        ? null
        : Number(body.productContextId);
    return this.chat.getOrCreate(
      who,
      Number.isSafeInteger(productContextId) && productContextId! > 0
        ? productContextId
        : null,
    );
  }

  @Get("conversations/:id/messages")
  getMessages(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") guestId?: string,
    @Query("take") rawTake?: string,
    @Query("beforeId") rawBefore?: string,
  ) {
    return this.chat.getHistory(
      identityFromRequest(req.user, guestId),
      pathInt(rawId),
      queryInt(rawTake, 50, "take"),
      queryInt(rawBefore, 0, "beforeId"),
    );
  }

  @Post("messages")
  send(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    return this.chat.addCustomerMessage(
      identityFromRequest(req.user, body.guestId),
      Number(body.conversationId),
      typeof body.content === "string" ? body.content : "",
      (body.attachment as ChatAttachment | null | undefined) ?? null,
    );
  }

  @Post("conversations/:id/handoff")
  async handoff(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") queryGuest?: string,
    @Body() body: Record<string, unknown>,
  ) {
    const id = pathInt(rawId);
    const who = identityFromRequest(
      req.user,
      queryGuest ?? body.guestId,
    );
    if (!(await this.chat.isOwner(id, who))) throw new ForbiddenException();
    const systemMessage = await this.chat.requestHandoff(
      id,
      typeof body.reason === "string" ? body.reason : null,
    );
    return { status: "waiting", systemMessage };
  }

  @Post("conversations/:id/end")
  async end(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") queryGuest?: string,
    @Body() body: Record<string, unknown>,
  ) {
    const ok = await this.chat.closeByCustomer(
      identityFromRequest(req.user, queryGuest ?? body.guestId),
      pathInt(rawId),
    );
    if (!ok) throw new NotFoundException();
    return { status: "closed" };
  }

  @Get("conversations")
  list(
    @Req() req: RequestLike,
    @Query("guestId") guestId?: string,
  ) {
    return this.chat.listForCustomer(
      identityFromRequest(req.user, guestId),
    );
  }

  @Post("conversations/:id/read")
  async read(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") guestId?: string,
  ) {
    const id = pathInt(rawId);
    const who = identityFromRequest(req.user, guestId);
    if (!(await this.chat.isOwner(id, who))) throw new ForbiddenException();
    await this.chat.markRead(id, "customer");
    return { message: "ok" };
  }
}

@Controller("api/admin/chat")
@UseGuards(JwtAuthGuard)
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get("conversations")
  list(
    @Req() req: RequestLike,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("assignedStaffId") assignedStaffId?: string,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.view");
    return this.chat.listForAgent({
      status,
      page: queryInt(page, 1, "page"),
      pageSize: queryInt(pageSize, 20, "pageSize"),
      assignedStaffId: assignedStaffId
        ? pathInt(assignedStaffId)
        : null,
    });
  }

  @Get("conversations/:id")
  async detail(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.view");
    const id = pathInt(rawId);
    const conversation = await this.chat.getConversation(id);
    if (!conversation) throw new NotFoundException();
    const messages = await this.chat.getHistoryForAgent(id, 200, 0);
    return { conversation, messages };
  }

  @Post("conversations/:id/claim")
  async claim(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.reply");
    const result = await this.chat.claim(
      user.id,
      pathInt(rawId),
      user.name,
    );
    if (!result.success) {
      throw new ConflictException({
        message: "Phiên đã được nhân viên khác nhận.",
      });
    }
    return {
      status: "agent",
      assignedStaffId: user.id,
      systemMessage: result.systemMessage,
    };
  }

  @Post("conversations/:id/reply")
  reply(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.reply");
    return this.chat.addAgentMessage(
      user.id,
      pathInt(rawId),
      typeof body.content === "string" ? body.content : "",
      (body.attachment as ChatAttachment | null | undefined) ?? null,
    );
  }

  @Post("conversations/:id/close")
  async close(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.reply");
    await this.chat.close(pathInt(rawId));
    return { status: "closed" };
  }

  @Post("conversations/:id/read")
  async read(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
  ) {
    const user = this.staff(req);
    assertStaffPermission(user, "chat.view");
    await this.chat.markRead(pathInt(rawId), "agent");
    return { message: "ok" };
  }

  private staff(req: RequestLike): AuthenticatedUser {
    const user = req.user;
    if (!user || !isStaffUser(user)) throw new ForbiddenException();
    return user;
  }
}
