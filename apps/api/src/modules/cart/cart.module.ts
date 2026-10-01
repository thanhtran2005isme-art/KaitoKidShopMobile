import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller.js";
import { CartReservationSweeperService } from "./cart-reservation-sweeper.service.js";
import { CartService } from "./cart.service.js";
import { ComboDiscountService } from "./combo-discount.service.js";

@Module({
  controllers: [CartController],
  providers: [
    CartService,
    ComboDiscountService,
    CartReservationSweeperService,
  ],
  exports: [CartService, ComboDiscountService],
})
export class CartModule {}
