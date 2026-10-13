import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { assertStaffPermission } from "../identity/staff-permissions.js";
import { intPath, type JsonRecord } from "./admin-utils.js";
import { AdminOrderAfterSalesService } from "./admin-order-after-sales.service.js";

@Controller("api/admin/order-after-sales")
@UseGuards(JwtAuthGuard)
export class AdminOrderAfterSalesController {
  constructor(private readonly afterSales: AdminOrderAfterSalesService) {}

  @Get("cases")
  list(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    assertStaffPermission(user, "orders.view");
    return this.afterSales.listCases();
  }

  @Get(":id")
  one(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ): Promise<unknown> {
    assertStaffPermission(user, "orders.view");
    return this.afterSales.snapshot(intPath(rawId));
  }

  @Post(":id/decision")
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: JsonRecord,
  ): Promise<unknown> {
    assertStaffPermission(user, "orders.update_status");
    return this.afterSales.decideReturn(
      user,
      intPath(rawId),
      body.decision ?? body.Decision,
      body.note ?? body.Note,
    );
  }

  @Post(":id/receive")
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: JsonRecord,
  ): Promise<unknown> {
    assertStaffPermission(user, "orders.update_status");
    assertStaffPermission(user, "inventory.manage");
    // Nhận hàng hoàn giờ đồng thời credit tiền vào Ví KaitoKid.
    assertStaffPermission(user, "wallet.manage");
    return this.afterSales.receiveReturn(
      user,
      intPath(rawId),
      body.disposition ?? body.Disposition,
      body.note ?? body.Note,
    );
  }

  /** Legacy only: case refund_pending cũ trước khi Ví KaitoKid được triển khai. */
  @Post(":id/refund-completed")
  refundCompleted(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: JsonRecord,
  ): Promise<unknown> {
    assertStaffPermission(user, "wallet.manage");
    return this.afterSales.markRefundCompleted(
      user,
      intPath(rawId),
      body.reference ?? body.Reference,
    );
  }
}
