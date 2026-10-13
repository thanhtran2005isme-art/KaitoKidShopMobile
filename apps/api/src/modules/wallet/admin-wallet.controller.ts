import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { WalletService } from "./wallet.service.js";

function actor(user: AuthenticatedUser): string {
  return user.name?.trim() || `Staff #${user.id}`;
}

@Controller("api/admin/wallet")
@UseGuards(JwtAuthGuard)
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("withdrawals")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
  ) {
    assertStaffPermission(user, "wallet.view");
    return this.wallet.listAdminWithdrawals(status);
  }

  @Post("withdrawals/:id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "wallet.manage");
    return this.wallet.approveWithdrawal(pathInt(rawId), actor(user), body.note);
  }

  @Post("withdrawals/:id/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "wallet.manage");
    return this.wallet.rejectWithdrawal(pathInt(rawId), actor(user), body.reason);
  }

  @Post("withdrawals/:id/complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "wallet.manage");
    return this.wallet.completeWithdrawal(
      pathInt(rawId),
      actor(user),
      body.reference,
      body.note,
    );
  }
}
