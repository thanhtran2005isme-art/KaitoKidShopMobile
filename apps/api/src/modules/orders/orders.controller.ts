import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import { OrdersService } from "./orders.service.js";

@Controller("api/orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.orders.createOrder(user.id, body);
  }

  @Get()
  getMyOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.getOrdersByUser(user.id);
  }

  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    const result = await this.orders.getOrderById(user.id, pathInt(rawId));
    if (!result) throw new NotFoundException();
    return result;
  }

  @Put(":id/cancel")
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    const result = await this.orders.cancelOrder(user.id, pathInt(rawId));
    if (!result) throw new BadRequestException("Không thể hủy đơn hàng");
    return { message: "Đã hủy đơn hàng" };
  }
}
