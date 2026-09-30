import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { pathInt, queryInt } from "../../common/query-value.js";
import { ProductsService } from "./products.service.js";

@Controller("api/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  getAll(@Query() query: Record<string, unknown>) {
    return this.products.getAll(query);
  }

  @Get("new-arrivals")
  getNewArrivals(@Query("count") rawCount?: string) {
    return this.products.getNewArrivals(queryInt(rawCount, 8, "count"));
  }

  @Get("best-sellers")
  getBestSellers(@Query("count") rawCount?: string) {
    return this.products.getBestSellers(queryInt(rawCount, 8, "count"));
  }

  @Get("sale")
  getSaleProducts(@Query("count") rawCount?: string) {
    return this.products.getSaleProducts(queryInt(rawCount, 8, "count"));
  }

  @Get("slug/:slug")
  async getBySlug(@Param("slug") slug: string) {
    const product = await this.products.getBySlug(slug);
    if (!product) throw new NotFoundException();
    return product;
  }

  @Get(":id/related")
  getRelated(@Param("id") rawId: string, @Query("count") rawCount?: string) {
    return this.products.getRelated(
      pathInt(rawId),
      queryInt(rawCount, 4, "count"),
    );
  }

  @Get(":id")
  async getById(@Param("id") rawId: string) {
    const product = await this.products.getById(pathInt(rawId));
    if (!product) throw new NotFoundException();
    return product;
  }
}
