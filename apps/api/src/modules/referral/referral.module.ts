import { Module } from "@nestjs/common";
import { ReferralController } from "./referral.controller.js";
import { ReferralService } from "./referral.service.js";

@Module({
  controllers: [ReferralController],
  providers: [ReferralService],
})
export class ReferralModule {}
