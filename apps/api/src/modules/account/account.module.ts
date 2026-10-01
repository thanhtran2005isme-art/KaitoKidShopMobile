import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";

@Module({
  imports: [CartModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
