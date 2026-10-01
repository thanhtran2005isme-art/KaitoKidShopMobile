import { Module } from "@nestjs/common";
import { CouponController } from "./coupon.controller.js";
import { CouponService } from "./coupon.service.js";

@Module({
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
