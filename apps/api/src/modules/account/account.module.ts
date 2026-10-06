import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { WalletModule } from "../wallet/wallet.module.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";

@Module({
  imports: [CartModule, WalletModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
