import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { queryInt } from "../../common/query-value.js";
import { MediaStorageService } from "../../media/media-storage.service.js";
import { AccountService } from "./account.service.js";

interface UploadedFileLike {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

@Controller("api/account")
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly media: MediaStorageService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.account.getProfile(user.id);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Put()
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.account.updateProfile(user.id, {
      name: typeof body.name === "string" ? body.name : body.name === null ? null : undefined,
      phone: typeof body.phone === "string" ? body.phone : body.phone === null ? null : undefined,
      avatar: typeof body.avatar === "string" ? body.avatar : body.avatar === null ? null : undefined,
      birthday:
        typeof body.birthday === "string" || body.birthday instanceof Date
          ? body.birthday
          : body.birthday === null
            ? null
            : undefined,
    });
    if (!result) throw new NotFoundException();
    return result;
  }

  @Post("avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedFileLike,
  ) {
    if (!file || file.size === 0) throw new BadRequestException("Chưa chọn file.");
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException("Ảnh tối đa 5MB.");

    const contentType = (file.mimetype ?? "").toLowerCase();
    const ext = contentType === "image/png"
      ? ".png"
      : contentType === "image/webp"
        ? ".webp"
        : contentType === "image/jpeg" || contentType === "image/jpg"
          ? ".jpg"
          : null;
    if (!ext) throw new BadRequestException("Chỉ chấp nhận JPEG/PNG/WebP.");

    const url = await this.media.save("avatars", file.buffer, ext, String(user.id));
    const updated = await this.account.setAvatar(user.id, url);
    if (!updated) {
      await this.media.removePublicFile(url);
      throw new NotFoundException();
    }

    await this.media.removePublicFile(updated.oldAvatar);
    return { url };
  }

  @Get("points-history")
  getPointsHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") rawPage?: string,
    @Query("pageSize") rawPageSize?: string,
  ) {
    const page = queryInt(rawPage, 1, "page");
    const pageSize = queryInt(rawPageSize, 20, "pageSize");
    if (page < 1 || pageSize < 1) throw new BadRequestException("page và pageSize phải lớn hơn 0");
    return this.account.getPointsHistory(user.id, page, pageSize);
  }

  @Post("redeem")
  @HttpCode(HttpStatus.OK)
  async redeem(@CurrentUser() user: AuthenticatedUser, @Body() body: { points?: unknown }) {
    const result = await this.account.redeemPoints(user.id, Number(body.points));
    if (!result) throw new NotFoundException();
    return result;
  }

  @Get("vouchers")
  async vouchers(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.account.getMyVouchers(user.id);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.account.deleteAccount(user.id, body.confirm);
    if (!result) throw new NotFoundException();

    await this.media.removePublicFile(result.oldAvatar);
    return {
      message:
        "Đã hủy tài khoản và xử lý dữ liệu cá nhân theo chính sách lưu trữ đơn hàng.",
    };
  }

  @Post("birthday-voucher")
  @HttpCode(HttpStatus.OK)
  async birthdayVoucher(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.account.claimBirthdayVoucher(user.id);
    if (!result) throw new NotFoundException();
    return result;
  }
}
