import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { CouponService } from "./coupon.service.js";

@Controller("api/coupons")
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Post("validate")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  validate(@Body() body: Record<string, unknown>) {
    const code = typeof body.code === "string" ? body.code : "";
    const orderAmount = Number(body.orderAmount ?? 0);
    if (!Number.isFinite(orderAmount)) {
      throw new BadRequestException("orderAmount phải là số");
    }
    return this.coupons.validate(code, orderAmount);
  }
}
