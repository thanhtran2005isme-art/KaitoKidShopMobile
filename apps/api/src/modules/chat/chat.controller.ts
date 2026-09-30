import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import {
  assertStaffPermission,
  hasStaffPermission,
} from "../identity/staff-permissions.js";
import { chatIdentityFromAuthorization } from "./chat-identity.js";
import { ChatBotService } from "./chat-bot.service.js";
import { ChatService } from "./chat.service.js";
import type { ChatAttachment } from "./chat.types.js";

interface RequestLike {
  headers: { authorization?: string };
}

function customerIdentity(
  req: RequestLike,
  guestId?: string | null,
) {
  return chatIdentityFromAuthorization(
    req.headers.authorization,
    guestId,
  );
}

@Controller("api/chat")
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
  createOrGet(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    return this.chat.getOrCreate(
      customerIdentity(
        req,
        typeof body.guestId === "string" ? body.guestId : null,
      ),
      body.productContextId === null || body.productContextId === undefined
        ? null
        : Number(body.productContextId),
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
      customerIdentity(req, guestId),
      pathInt(rawId),
      Number(rawTake ?? 50),
      Number(rawBefore ?? 0),
    );
  }

  @Post("messages")
  send(
    @Req() req: RequestLike,
    @Body() body: Record<string, unknown>,
  ) {
    const content =
      typeof body.content === "string" ? body.content : "";
    return this.chat.addCustomerMessage(
      customerIdentity(
        req,
        typeof body.guestId === "string" ? body.guestId : null,
      ),
      Number(body.conversationId),
      content,
      this.attachment(body.attachment),
    );
  }

  @Post("conversations/:id/handoff")
  async handoff(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") queryGuestId?: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const guestId =
      queryGuestId ??
      (typeof body.guestId === "string" ? body.guestId : null);
    const systemMessage = await this.chat.requestHandoff(
      customerIdentity(req, guestId),
      pathInt(rawId),
      typeof body.reason === "string" ? body.reason : null,
    );
    return { status: "waiting", systemMessage };
  }

  @Post("conversations/:id/end")
  async end(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") queryGuestId?: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const guestId =
      queryGuestId ??
      (typeof body.guestId === "string" ? body.guestId : null);
    const ok = await this.chat.closeByCustomer(
      customerIdentity(req, guestId),
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
      customerIdentity(req, guestId),
    );
  }

  @Post("conversations/:id/read")
  async read(
    @Req() req: RequestLike,
    @Param("id") rawId: string,
    @Query("guestId") guestId?: string,
  ) {
    const id = pathInt(rawId);
    const who = customerIdentity(req, guestId);
    if (!(await this.chat.isOwner(id, who))) {
      throw new ForbiddenException();
    }
    await this.chat.markRead(id, "Customer");
    return { message: "ok" };
  }

  private attachment(value: unknown): ChatAttachment | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const obj = value as Record<string, unknown>;
    if (
      typeof obj.type !== "string" ||
      typeof obj.refId !== "string"
    ) {
      return null;
    }
    return {
      type: obj.type,
      refId: obj.refId,
      title: typeof obj.title === "string" ? obj.title : null,
      imageUrl:
        typeof obj.imageUrl === "string" ? obj.imageUrl : null,
      subtitle:
        typeof obj.subtitle === "string" ? obj.subtitle : null,
      url: typeof obj.url === "string" ? obj.url : null,
    };
  }
}

@Controller("api/admin/chat")
@UseGuards(JwtAuthGuard)
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get("conversations")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
    @Query("assignedStaffId") rawAssigned?: string,
  ) {
    assertStaffPermission(user, "chat.view");
    return this.chat.listForAgent({
      status,
      page: Number(rawPage ?? 1),
      pageSize: Number(rawPageSize ?? 20),
      assignedStaffId:
        rawAssigned === undefined ? null : Number(rawAssigned),
    });
  }

  @Get("conversations/:id")
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    assertStaffPermission(user, "chat.view");
    const id = pathInt(rawId);
    const conversation = await this.chat.getConversation(id);
    if (!conversation) throw new NotFoundException();

    const owner = conversation.userId
      ? {
          userId: conversation.userId,
          guestId: null,
          displayName: conversation.displayName,
          isStaff: false,
          permissions: [],
          superAdmin: false,
        }
      : {
          userId: null,
          guestId: conversation.guestId,
          displayName: null,
          isStaff: false,
          permissions: [],
          superAdmin: false,
        };
    const messages = await this.chat.getHistory(owner, id, 200, 0);
    return { conversation, messages };
  }

  @Post("conversations/:id/claim")
  async claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
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
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "chat.reply");
    const content =
      typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      throw new BadRequestException({ message: "Nội dung trống." });
    }
    return this.chat.addAgentMessage(
      user.id,
      pathInt(rawId),
      content,
      null,
    );
  }

  @Post("conversations/:id/close")
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    if (
      !hasStaffPermission(user, "chat.manage") &&
      !hasStaffPermission(user, "chat.reply")
    ) {
      assertStaffPermission(user, "chat.manage");
    }
    await this.chat.close(pathInt(rawId));
    return { status: "closed" };
  }

  @Post("conversations/:id/read")
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    assertStaffPermission(user, "chat.view");
    await this.chat.markRead(pathInt(rawId), "Agent");
    return { message: "ok" };
  }
}
