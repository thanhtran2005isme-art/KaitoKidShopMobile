import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { CouponModule } from "../coupons/coupon.module.js";
import { ShippingModule } from "../shipping/shipping.module.js";
import { OrderInventoryService } from "./order-inventory.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [CartModule, CouponModule, ShippingModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderInventoryService],
  exports: [OrdersService, OrderInventoryService],
})
export class OrdersModule {}
