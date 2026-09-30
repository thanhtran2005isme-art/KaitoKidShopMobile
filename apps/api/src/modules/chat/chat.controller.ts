import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { pathInt } from "../../common/query-value.js";
import { resolveChatIdentity } from "./chat-identity.js";
import { ChatBotService } from "./chat-bot.service.js";
import { ChatService } from "./chat.service.js";
import type { ChatAttachment } from "./chat.types.js";

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
    @Headers("authorization") authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const who = resolveChatIdentity(
      authorization,
      typeof body.guestId === "string" ? body.guestId : null,
    );
    const productContextId = this.optionalPositiveInt(body.productContextId);
    return this.chat.getOrCreate(who, productContextId);
  }

  @Get("conversations/:id/messages")
  history(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") rawId: string,
    @Query("guestId") guestId?: string,
    @Query("take") rawTake = "50",
    @Query("beforeId") rawBefore = "0",
  ) {
    const who = resolveChatIdentity(authorization, guestId);
    return this.chat.history(
      who,
      pathInt(rawId),
      this.safeInt(rawTake, 50, 1, 200),
      this.safeInt(rawBefore, 0, 0, Number.MAX_SAFE_INTEGER),
    );
  }

  @Post("messages")
  send(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const content =
      typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      throw new BadRequestException({ message: "Nội dung trống." });
    }
    const who = resolveChatIdentity(
      authorization,
      typeof body.guestId === "string" ? body.guestId : null,
    );
    return this.chat.addCustomerMessage(
      who,
      this.requiredPositiveInt(body.conversationId, "conversationId"),
      content,
      this.attachment(body.attachment),
    );
  }

  @Post("conversations/:id/handoff")
  async handoff(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") rawId: string,
    @Query("guestId") queryGuestId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const id = pathInt(rawId);
    const guestId =
      queryGuestId ??
      (typeof body.guestId === "string" ? body.guestId : undefined);
    const who = resolveChatIdentity(authorization, guestId);
    if (!(await this.chat.isOwner(id, who))) {
      throw new ForbiddenException();
    }
    const systemMessage = await this.chat.requestHandoff(id);
    return { status: "waiting", systemMessage };
  }

  @Post("conversations/:id/end")
  async end(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") rawId: string,
    @Query("guestId") queryGuestId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const guestId =
      queryGuestId ??
      (typeof body.guestId === "string" ? body.guestId : undefined);
    const who = resolveChatIdentity(authorization, guestId);
    const ok = await this.chat.closeByCustomer(who, pathInt(rawId));
    if (!ok) {
      throw new NotFoundException();
    }
    return { status: "closed" };
  }

  @Get("conversations")
  listMine(
    @Headers("authorization") authorization: string | undefined,
    @Query("guestId") guestId?: string,
  ) {
    return this.chat.listMine(resolveChatIdentity(authorization, guestId));
  }

  @Post("conversations/:id/read")
  async read(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") rawId: string,
    @Query("guestId") guestId?: string,
  ) {
    const id = pathInt(rawId);
    const who = resolveChatIdentity(authorization, guestId);
    if (!(await this.chat.isOwner(id, who))) {
      throw new ForbiddenException();
    }
    await this.chat.markRead(id, "customer");
    return { message: "ok" };
  }

  private attachment(value: unknown): ChatAttachment | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (typeof obj.type !== "string" || typeof obj.refId !== "string") {
      return null;
    }
    return {
      type: obj.type,
      refId: obj.refId,
      title: typeof obj.title === "string" ? obj.title : null,
      imageUrl: typeof obj.imageUrl === "string" ? obj.imageUrl : null,
      subtitle: typeof obj.subtitle === "string" ? obj.subtitle : null,
      url: typeof obj.url === "string" ? obj.url : null,
    };
  }

  private requiredPositiveInt(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException({ message: field + " không hợp lệ." });
    }
    return parsed;
  }

  private optionalPositiveInt(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    return this.requiredPositiveInt(value, "productContextId");
  }

  private safeInt(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }
}
