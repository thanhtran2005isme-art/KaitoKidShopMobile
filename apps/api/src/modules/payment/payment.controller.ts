import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { PaymentService } from "./payment.service.js";

@Controller("api/payment")
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  @Get("config")
  getConfig() {
    return this.payment.getConfig();
  }

  @Get("instructions/:orderCode")
  @UseGuards(JwtAuthGuard)
  async instructions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    const result = await this.payment.getInstructions(user.id, orderCode);
    if (!result) throw new NotFoundException("Không tìm thấy đơn hàng");
    return result;
  }

  @Get("status/:orderCode")
  @UseGuards(JwtAuthGuard)
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    const result = await this.payment.getStatus(user.id, orderCode);
    if (!result) throw new NotFoundException("Không tìm thấy đơn hàng");
    return result;
  }

  @Post("mark-paid/:orderCode")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    if ((user.role ?? "").toLowerCase() !== "admin") {
      throw new ForbiddenException();
    }
    const result = await this.payment.markPaid(orderCode);
    if (!result) throw new NotFoundException("Không tìm thấy đơn hàng");
    return result;
  }

  @Post("cancel/:orderCode")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    const result = await this.payment.cancelByCustomer(user.id, orderCode);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Post("simulate-paid/:orderCode")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    const wrapped = await this.payment.simulatePaid(user.id, orderCode);
    if (wrapped.hidden) throw new NotFoundException();
    if (!wrapped.result) throw new NotFoundException();
    return wrapped.result;
  }
}
