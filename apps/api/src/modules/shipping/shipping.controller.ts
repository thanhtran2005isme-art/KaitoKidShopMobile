import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { queryOptionalInt } from "../../common/query-value.js";
import { ShippingService } from "./shipping.service.js";

@Controller("api/shipping")
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get("providers")
  getProviders() {
    return this.shipping.getProviders();
  }

  @Post("quote")
  @HttpCode(HttpStatus.OK)
  quote(@Body() body: Record<string, unknown>) {
    const weightGram = Number(body.weightGram ?? 500);
    const orderValue = Number(body.orderValue ?? 0);
    const toDistrictId =
      body.toDistrictId === undefined || body.toDistrictId === null
        ? null
        : Number(body.toDistrictId);

    if (!Number.isSafeInteger(weightGram)) {
      throw new BadRequestException("weightGram phải là số nguyên");
    }
    if (!Number.isFinite(orderValue)) {
      throw new BadRequestException("orderValue phải là số");
    }
    if (toDistrictId !== null && !Number.isSafeInteger(toDistrictId)) {
      throw new BadRequestException("toDistrictId phải là số nguyên");
    }

    return this.shipping.quote({
      provider: typeof body.provider === "string" ? body.provider : "mock",
      toProvince: typeof body.toProvince === "string" ? body.toProvince : "",
      toDistrict: typeof body.toDistrict === "string" ? body.toDistrict : "",
      toWard: typeof body.toWard === "string" ? body.toWard : null,
      toAddress: typeof body.toAddress === "string" ? body.toAddress : null,
      weightGram,
      orderValue,
      deliverOption:
        typeof body.deliverOption === "string" ? body.deliverOption : "none",
      toDistrictId,
      toWardCode:
        typeof body.toWardCode === "string" ? body.toWardCode : null,
    });
  }

  @Get("track/:orderCode")
  @UseGuards(JwtAuthGuard)
  async track(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderCode") orderCode: string,
  ) {
    const result = await this.shipping.track(user.id, orderCode);
    if (!result) throw new NotFoundException("Không tìm thấy đơn hàng");
    return result;
  }

  @Get("ghn/locations")
  async ghnLocations(
    @Query("provinceId") rawProvinceId?: string,
    @Query("districtId") rawDistrictId?: string,
  ) {
    const provinceId = queryOptionalInt(rawProvinceId, "provinceId");
    const districtId = queryOptionalInt(rawDistrictId, "districtId");
    try {
      return await this.shipping.ghnLocations(provinceId, districtId);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "GHN master-data error",
      );
    }
  }
}
