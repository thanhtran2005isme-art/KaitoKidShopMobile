import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { pathInt } from "../../common/query-value.js";
import { CategoriesService } from "./categories.service.js";

@Controller("api/categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  getAll() {
    return this.categories.getAll();
  }

  @Get(":id")
  async getById(@Param("id") rawId: string) {
    const category = await this.categories.getById(pathInt(rawId));
    if (!category) throw new NotFoundException();
    return category;
  }
}
