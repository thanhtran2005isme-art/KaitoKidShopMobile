import { Module } from "@nestjs/common";
import { HardenedLalamoveShippingService } from "./lalamove-shipping-hardened.service.js";
import { LalamoveShippingService } from "./lalamove-shipping.service.js";
import { ShippingController } from "./shipping.controller.js";
import { ShippingService } from "./shipping.service.js";
import { ShippingStatusSimulatorService } from "./shipping-status-simulator.service.js";

@Module({
  controllers: [ShippingController],
  providers: [
    {
      provide: LalamoveShippingService,
      useClass: HardenedLalamoveShippingService,
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
