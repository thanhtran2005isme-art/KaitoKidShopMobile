import { Module } from "@nestjs/common";
import { CouponModule } from "../coupons/coupon.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { ShippingModule } from "../shipping/shipping.module.js";
import { WalletModule } from "../wallet/wallet.module.js";
import { PayOsService } from "./payos.service.js";
import { PaymentController } from "./payment.controller.js";
import { PaymentExpirySweeperService } from "./payment-expiry-sweeper.service.js";
import { PaymentService } from "./payment.service.js";

@Module({
  imports: [CouponModule, IdentityModule, OrdersModule, ShippingModule, WalletModule],
  controllers: [PaymentController],
  providers: [PayOsService, PaymentService, PaymentExpirySweeperService],
})
export class PaymentModule {}
