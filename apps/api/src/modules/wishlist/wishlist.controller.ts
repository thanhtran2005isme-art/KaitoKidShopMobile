import {
  ConflictException,
  Controller,
  Delete,
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
import { pathInt } from "../../common/query-value.js";
import { WishlistService } from "./wishlist.service.js";

@Controller("api/wishlist")
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlist.getAll(user.id);
  }

  @Post(":productId")
  @HttpCode(HttpStatus.OK)
  async add(@CurrentUser() user: AuthenticatedUser, @Param("productId") rawId: string) {
    const item = await this.wishlist.add(user.id, pathInt(rawId));
    if (!item) throw new ConflictException("Sản phẩm đã có trong danh sách yêu thích");
    return item;
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("productId") rawId: string) {
    if (!(await this.wishlist.remove(user.id, pathInt(rawId)))) throw new NotFoundException();
  }
}
