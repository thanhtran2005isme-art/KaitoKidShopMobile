import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import { AddressesService } from "./addresses.service.js";

@Controller("api/addresses")
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.getAll(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.addresses.create(user.id, body);
  }

  @Put(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.addresses.update(user.id, pathInt(rawId), body);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    if (!(await this.addresses.remove(user.id, pathInt(rawId)))) throw new NotFoundException();
  }

  @Put(":id/default")
  async setDefault(@CurrentUser() user: AuthenticatedUser, @Param("id") rawId: string) {
    if (!(await this.addresses.setDefault(user.id, pathInt(rawId)))) throw new NotFoundException();
    return { message: "Đã đặt làm địa chỉ mặc định" };
  }
}
