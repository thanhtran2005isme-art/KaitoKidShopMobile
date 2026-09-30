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
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import {
  hasStaffPermission,
  isStaffUser,
} from "../identity/staff-permissions.js";
import { ChatService } from "./chat.service.js";
import type { ChatAttachment } from "./chat.types.js";

@Controller("api/admin/chat")
@UseGuards(JwtAuthGuard)
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  @Get("conversations")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("page") rawPage = "1",
    @Query("pageSize") rawPageSize = "20",
    @Query("assignedStaffId") rawAssigned?: string,
  ) {
    this.require(user, "chat.view");
    return this.chat.listAgent(
      status?.trim() || null,
      this.int(rawPage, 1),
      this.int(rawPageSize, 20),
      rawAssigned ? this.int(rawAssigned, 0) || null : null,
    );
  }

  @Get("conversations/:id")
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    this.require(user, "chat.view");
    const id = pathInt(rawId);
    const conversation = await this.chat.getConversation(id);
    if (!conversation) {
      throw new NotFoundException();
    }
    const messages = await this.chat.getHistoryForAdmin(id, 200, 0);
    return { conversation, messages };
  }

  @Post("conversations/:id/claim")
  async claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    this.require(user, "chat.reply");
    const result = await this.chat.claimWithMessage(
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
    this.require(user, "chat.reply");
    const content =
      typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      throw new BadRequestException({
        message: "Nội dung trống.",
      });
    }
    return this.chat.addAgentMessage(
      user.id,
      pathInt(rawId),
      content,
      this.attachment(body.attachment),
    );
  }

  @Post("conversations/:id/close")
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    this.require(user, "chat.reply");
    await this.chat.closeByAgent(pathInt(rawId));
    return { status: "closed" };
  }

  @Post("conversations/:id/read")
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    this.require(user, "chat.view");
    await this.chat.markRead(pathInt(rawId), "agent");
    return { message: "ok" };
  }

  private require(user: AuthenticatedUser, permission: string): void {
    if (!isStaffUser(user) || !hasStaffPermission(user, permission)) {
      throw new ForbiddenException();
    }
  }

  private int(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  }

  private attachment(value: unknown): ChatAttachment | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (typeof obj.type !== "string" || typeof obj.refId !== "string") return null;
    return {
      type: obj.type,
      refId: obj.refId,
      title: typeof obj.title === "string" ? obj.title : null,
      imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl : null,
      subtitle: typeof obj.subtitle === "string" ? obj.subtitle : null,
      url: typeof obj.url === "string" ? obj.url : null,
    };
  }
}
