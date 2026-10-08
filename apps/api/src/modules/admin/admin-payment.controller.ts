import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { AdminVietQrService } from "./admin-vietqr.service.js";

@Controller("api/admin/payment")
@UseGuards(JwtAuthGuard)
export class AdminPaymentController {
  constructor(private readonly vietQr: AdminVietQrService) {}

  @Get("banks")
  getBanks(@CurrentUser() user: AuthenticatedUser) {
    assertStaffPermission(user, "settings.view");
    return this.vietQr.getBanks();
  }

  @Post("lookup-account")
  lookupAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "settings.manage");
    return this.vietQr.lookupAccount(body.bankBin, body.accountNumber);
  }
}
