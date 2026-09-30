import { Controller, Get, Query } from "@nestjs/common";
import { HomepageBlocksService } from "./homepage-blocks.service.js";

@Controller("api/homepage-blocks")
export class HomepageBlocksController {
  constructor(private readonly blocks: HomepageBlocksService) {}

  @Get()
  get(@Query("type") type?: string) {
    return this.blocks.get(type);
  }
}
