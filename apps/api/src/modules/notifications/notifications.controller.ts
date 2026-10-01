import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt, queryInt } from "../../common/query-value.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("api/notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    const page = queryInt(rawPage, 1, "page");
    const pageSize = queryInt(rawPageSize, 20, "pageSize");
    if (page < 1 || pageSize < 1) throw new BadRequestException("page và pageSize phải lớn hơn 0");
    return this.notifications.getMine(user.id, page, pageSize);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Put("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Put(":id/read")
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    if (!(await this.notifications.markRead(user.id, pathInt(rawId)))) throw new NotFoundException();
    return { message: "ok" };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    if (!(await this.notifications.remove(user.id, pathInt(rawId)))) throw new NotFoundException();
  }
}
