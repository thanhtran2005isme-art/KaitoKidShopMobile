import { Module } from "@nestjs/common";
import { AdminWalletController } from "./admin-wallet.controller.js";
import { WalletController } from "./wallet.controller.js";
import { WalletService } from "./wallet.service.js";

@Module({
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
