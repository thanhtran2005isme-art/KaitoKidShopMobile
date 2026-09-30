import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt, queryInt } from "../../common/query-value.js";
import { MediaStorageService } from "../../media/media-storage.service.js";
import { ReviewsService } from "./reviews.service.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

interface UploadedFileLike {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

@Controller("api/reviews")
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly media: MediaStorageService,
  ) {}

  @Get("product/:productId")
  getByProduct(@Param("productId") rawId: string) {
    return this.reviews.getByProduct(pathInt(rawId));
  }

  @Get("featured")
  featured(@Query("limit") rawLimit?: string) {
    return this.reviews.featured(queryInt(rawLimit, 6, "limit"));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    return this.reviews.create(user.id, user.name ?? "Khách hàng", body);
  }

  @Post(":id/helpful")
  @HttpCode(HttpStatus.OK)
  async helpful(@Param("id") rawId: string) {
    if (!(await this.reviews.markHelpful(pathInt(rawId)))) throw new NotFoundException();
    return { message: "Cảm ơn bạn đã đánh giá hữu ích" };
  }

  @Post("upload")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 30 * 1024 * 1024 } }))
  async upload(@UploadedFiles() files?: UploadedFileLike[]) {
    if (!files || files.length === 0) throw new BadRequestException("Chưa chọn tệp");

    for (const file of files) {
      const ext = this.media.extensionFromName(file.originalname);
      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isVideo = VIDEO_EXTENSIONS.has(ext);
      if (!isImage && !isVideo) {
        throw new BadRequestException(`Định dạng ${ext} không được hỗ trợ.`);
      }
      if (isImage && file.size > 5 * 1024 * 1024) {
        throw new BadRequestException(`Ảnh ${file.originalname} vượt quá 5MB.`);
      }
      if (isVideo && file.size > 30 * 1024 * 1024) {
        throw new BadRequestException(`Video ${file.originalname} vượt quá 30MB.`);
      }
    }

    const urls: string[] = [];
    for (const file of files) {
      urls.push(await this.media.save(
        "reviews",
        file.buffer,
        this.media.extensionFromName(file.originalname),
      ));
    }
    return { urls };
  }
}
