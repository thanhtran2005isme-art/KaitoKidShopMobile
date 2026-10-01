import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { pathInt } from "../../common/query-value.js";
import { LookbooksService } from "./lookbooks.service.js";

@Controller("api/lookbooks")
export class LookbooksController {
  constructor(private readonly lookbooks: LookbooksService) {}

  @Get()
  getAll(@Query("season") season?: string, @Query("style") style?: string) {
    return this.lookbooks.getAll(season, style);
  }

  @Get("filters")
  getFilters() {
    return this.lookbooks.getFilters();
  }

  @Get(":id")
  async getById(@Param("id") rawId: string) {
    const lookbook = await this.lookbooks.getById(pathInt(rawId));
    if (!lookbook) throw new NotFoundException();
    return lookbook;
  }
}
