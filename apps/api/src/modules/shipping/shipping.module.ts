import { Module } from "@nestjs/common";
import { ShippingController } from "./shipping.controller.js";
import { ShippingService } from "./shipping.service.js";
import { ShippingStatusSimulatorService } from "./shipping-status-simulator.service.js";

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, ShippingStatusSimulatorService],
  exports: [ShippingService],
})
export class ShippingModule {}
