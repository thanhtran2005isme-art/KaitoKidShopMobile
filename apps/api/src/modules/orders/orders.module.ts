import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { CouponModule } from "../coupons/coupon.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { ShippingModule } from "../shipping/shipping.module.js";
import { WalletModule } from "../wallet/wallet.module.js";
import { OrderAfterSalesService } from "./order-after-sales.service.js";
import { OrderInventoryService } from "./order-inventory.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [CartModule, CouponModule, IdentityModule, ShippingModule, WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderInventoryService, OrderAfterSalesService],
  exports: [OrdersService, OrderInventoryService, OrderAfterSalesService],
})
export class OrdersModule {}
