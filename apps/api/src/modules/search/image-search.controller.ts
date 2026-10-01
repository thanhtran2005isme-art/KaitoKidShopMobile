import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImageSearchService } from "./image-search.service.js";

@Controller("api/search")
export class ImageSearchController {
  constructor(private readonly image: ImageSearchService) {}

  @Post("by-image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  async byImage(
    @UploadedFile()
    file: Express.Multer.File | undefined,
    @Query("limit") rawLimit = "48",
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ message: "Chưa chọn ảnh." });
    }
    if (!file.mimetype?.toLowerCase().startsWith("image/")) {
      throw new BadRequestException({
        message: "Chỉ chấp nhận tệp ảnh (JPG/PNG/WebP).",
      });
    }
    const max = Number(
      process.env.IMAGE_SEARCH_MAX_UPLOAD_BYTES ??
        8 * 1024 * 1024,
    );
    if (file.size > max) {
      throw new BadRequestException({
        message: "Ảnh vượt quá dung lượng cho phép.",
      });
    }
    return this.image.search(file.buffer, Number(rawLimit));
  }
}
