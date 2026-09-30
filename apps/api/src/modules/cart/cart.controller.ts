import {
  BadRequestException,
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
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt, queryInt } from "../../common/query-value.js";
import { distinctPositiveIds } from "./cart.helpers.js";
import { CartService } from "./cart.service.js";
import { ComboDiscountService } from "./combo-discount.service.js";

@Controller("api/cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly combo: ComboDiscountService,
  ) {}

  @Get()
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.getCart(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.cart.addToCart(user.id, {
      productId: Number(body.productId ?? 0),
      size: body.size,
      color: body.color,
      quantity: body.quantity === undefined ? 1 : Number(body.quantity),
    });
  }

  @Put(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.cart.updateQuantity(
      user.id,
      pathInt(rawId),
      Number(body.quantity),
    );
    if (!result) throw new NotFoundException();
    return result;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ): Promise<void> {
    const removed = await this.cart.removeFromCart(user.id, pathInt(rawId));
    if (!removed) throw new NotFoundException();
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.cart.clearCart(user.id);
  }

  @Post("remove-many")
  @HttpCode(HttpStatus.OK)
  async removeMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const ids = this.requiredIds(body.itemIds, "Danh sách rỗng");
    return { removed: await this.cart.removeMany(user.id, ids) };
  }

  @Post("move-to-wishlist")
  @HttpCode(HttpStatus.OK)
  async moveToWishlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const ids = this.requiredIds(body.itemIds, "Danh sách rỗng");
    return { moved: await this.cart.moveToWishlist(user.id, ids) };
  }

  @Get("cross-sell")
  crossSell(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") rawLimit?: string,
  ) {
    const limit = Math.max(1, Math.min(20, queryInt(rawLimit, 4, "limit")));
    return this.cart.getCrossSell(user.id, limit);
  }

  @Get("cross-sell-products")
  crossSellProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") rawLimit?: string,
  ) {
    const limit = Math.max(1, Math.min(20, queryInt(rawLimit, 4, "limit")));
    return this.cart.getCrossSellProducts(user.id, limit);
  }

  @Get("combo-discount")
  comboDiscount(@CurrentUser() user: AuthenticatedUser) {
    return this.combo.evaluate(user.id);
  }

  @Post("combo-discount/selected")
  @HttpCode(HttpStatus.OK)
  comboDiscountSelected(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const ids = this.requiredIds(
      body.itemIds,
      "Danh sách sản phẩm checkout rỗng",
    );
    return this.combo.evaluateSelected(user.id, ids);
  }

  @Post("reorder/:orderId")
  @HttpCode(HttpStatus.OK)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") rawOrderId: string,
  ) {
    return this.cart.reorder(user.id, pathInt(rawOrderId));
  }

  private requiredIds(value: unknown, message: string): number[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(message);
    }
    const numeric = value.map((item) => Number(item));
    if (numeric.some((item) => !Number.isSafeInteger(item) || item <= 0)) {
      throw new BadRequestException("Danh sách sản phẩm không hợp lệ");
    }
    const ids = distinctPositiveIds(numeric);
    if (ids.length === 0) throw new BadRequestException(message);
    return ids;
  }
}
