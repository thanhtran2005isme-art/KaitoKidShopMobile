import { Controller, Get, Query } from "@nestjs/common";
import { queryString } from "../../common/query-value.js";
import { BannersService } from "./banners.service.js";

@Controller("api/banners")
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  getActive(@Query("position") position?: string, @Query("type") type?: string) {
    return this.banners.getActive(
      queryString(position) ?? "homepage",
      queryString(type),
    );
  }
}
