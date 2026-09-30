import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { AdminShippingService } from "./admin-shipping.service.js";

@Controller("api/admin/shipping")
@UseGuards(JwtAuthGuard)
export class AdminShippingController {
  constructor(private readonly shipping: AdminShippingService) {}

  @Get("config")
  config(@CurrentUser() user: AuthenticatedUser) {
    assertStaffPermission(user, "settings.view");
    return this.shipping.getConfig(true);
  }

  @Put("config")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "settings.manage");
    await this.shipping.updateConfig(body);
    return { message: "Đã cập nhật cấu hình vận chuyển." };
  }

  @Post("test/:provider")
  @HttpCode(HttpStatus.OK)
  async test(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
  ) {
    assertStaffPermission(user, "settings.manage");
    const result = await this.shipping.testProvider(provider);
    if ("badRequest" in result && result.badRequest) {
      throw new BadRequestException({
        ok: false,
        message: result.message,
      });
    }
    return result;
  }

  @Get("ghn/districts")
  async districts(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query("provinceId") rawProvince?: string,
  ) {
    assertStaffPermission(user, "settings.manage");
    const provinceId =
      rawProvince === undefined ? undefined : Number(rawProvince);
    const result = await this.shipping.ghnMaster(provinceId);
    if ("badRequest" in result && result.badRequest) {
      throw new BadRequestException({ error: result.error });
    }
    const payload = result as {
      status: number;
      contentType: string;
      body: string;
    };
    return res
      .status(payload.status)
      .type(payload.contentType)
      .send(payload.body);
  }

  @Get("history")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("provider") provider?: string,
    @Query("status") status?: string,
    @Query("page") rawPage = "1",
    @Query("pageSize") rawPageSize = "20",
  ) {
    assertStaffPermission(user, "orders.view");
    return this.shipping.history({
      search,
      provider,
      status,
      page: Number(rawPage) || 1,
      pageSize: Number(rawPageSize) || 20,
    });
  }

  @Get("overview")
  overview(@CurrentUser() user: AuthenticatedUser) {
    assertStaffPermission(user, "orders.view");
    return this.shipping.overview();
  }
}
