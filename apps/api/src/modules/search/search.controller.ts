import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImageSearchService } from "./image-search.service.js";
import { SearchService } from "./search.service.js";

@Controller("api/search")
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly imageSearch: ImageSearchService,
  ) {}

  @Get()
  search(@Query() query: Record<string, unknown>) {
    return this.searchService.search(query);
  }

  @Get("suggestions")
  suggestions(
    @Query("q") q = "",
    @Query("limit") rawLimit = "6",
  ) {
    const limit = Number(rawLimit);
    return this.searchService.suggestions(
      q,
      Number.isSafeInteger(limit) ? limit : 6,
    );
  }

  @Get("by-image/status")
  status() {
    return this.imageSearch.status();
  }

  @Post("by-image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: Math.max(
          1,
          Number(
            process.env.IMAGE_SEARCH_MAX_UPLOAD_BYTES ?? 8 * 1024 * 1024,
          ) || 8 * 1024 * 1024,
        ),
      },
    }),
  )
  async byImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("limit") rawLimit = "48",
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ message: "Chưa chọn ảnh." });
    }
    const contentType = (file.mimetype ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new BadRequestException({
        message: "Chỉ chấp nhận tệp ảnh (JPG/PNG/WebP).",
      });
    }
    const limit = Number(rawLimit);
    return this.imageSearch.search(
      file.buffer,
      Number.isSafeInteger(limit) ? limit : 48,
    );
  }
}
