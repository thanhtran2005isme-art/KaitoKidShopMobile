import { Module } from "@nestjs/common";
import { LalamoveShippingService } from "./lalamove-shipping.service.js";
import { ReceiptAwareLalamoveShippingService } from "./lalamove-shipping-receipt-aware.service.js";
import { ShippingController } from "./shipping.controller.js";
import { ShippingService } from "./shipping.service.js";
import { ShippingStatusSimulatorService } from "./shipping-status-simulator.service.js";

@Module({
  controllers: [ShippingController],
  providers: [
    {
      provide: LalamoveShippingService,
      useClass: ReceiptAwareLalamoveShippingService,
    },
    {
      provide: ShippingService,
      useExisting: LalamoveShippingService,
    },
    ShippingStatusSimulatorService,
  ],
  exports: [ShippingService, LalamoveShippingService],
})
export class ShippingModule {}
