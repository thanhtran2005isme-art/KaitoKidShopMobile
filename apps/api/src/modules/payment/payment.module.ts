import { Module } from "@nestjs/common";
import { CouponModule } from "../coupons/coupon.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { ShippingModule } from "../shipping/shipping.module.js";
import { PaymentController } from "./payment.controller.js";
import { PaymentExpirySweeperService } from "./payment-expiry-sweeper.service.js";
import { PaymentService } from "./payment.service.js";

@Module({
  imports: [CouponModule, OrdersModule, ShippingModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentExpirySweeperService],
})
export class PaymentModule {}
