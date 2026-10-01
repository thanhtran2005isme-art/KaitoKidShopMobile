import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { pathInt } from "../../common/query-value.js";
import { CollectionsService } from "./collections.service.js";

@Controller("api/collections")
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  getAll() {
    return this.collections.getAll();
  }

  @Get(":id")
  async getById(@Param("id") rawId: string) {
    const collection = await this.collections.getById(pathInt(rawId));
    if (!collection) throw new NotFoundException();
    return collection;
  }
}
