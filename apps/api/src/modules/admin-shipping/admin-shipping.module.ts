import { Module } from "@nestjs/common";
import { AdminShippingController } from "./admin-shipping.controller.js";
import { AdminShippingService } from "./admin-shipping.service.js";

@Module({
  controllers: [AdminShippingController],
  providers: [AdminShippingService],
})
export class AdminShippingModule {}
