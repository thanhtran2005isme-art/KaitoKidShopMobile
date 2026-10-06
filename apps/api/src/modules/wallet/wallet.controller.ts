import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { queryInt } from "../../common/query-value.js";
import { WalletService } from "./wallet.service.js";

@Controller("api/wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.getSummary(user.id);
  }

  @Get("transactions")
  transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    return this.wallet.listTransactions(
      user.id,
      queryInt(rawPage, 1, "page"),
      queryInt(rawPageSize, 20, "pageSize"),
    );
  }

  @Get("withdrawals")
  withdrawals(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.listMyWithdrawals(user.id);
  }

  @Post("withdrawals")
  createWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.wallet.createWithdrawal(user.id, {
      amount: body.amount,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountHolder: body.accountHolder,
      note: body.note,
    });
  }
}
