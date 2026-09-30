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

interface UploadFile {
  buffer: Buffer;
  mimetype: string;
}

@Controller("api/search")
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly image: ImageSearchService,
  ) {}

  @Get()
  search(@Query() query: Record<string, unknown>) {
    return this.searchService.search(query);
  }

  @Get("suggestions")
  suggestions(
    @Query("q") q = "",
    @Query("limit") raw = "6",
  ) {
    if (!q.trim() || q.trim().length < 2) {
      return { suggestions: [], products: [] };
    }
    const n = Number(raw);
    return this.searchService.suggestions(
      q,
      Number.isFinite(n) ? Math.max(1, Math.min(20, Math.trunc(n))) : 6,
    );
  }

  @Get("by-image/status")
  status() {
    return { ready: this.image.ready };
  }

  @Post("by-image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  async byImage(
    @UploadedFile() file: UploadFile | undefined,
    @Query("limit") raw = "48",
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ message: "Chưa chọn ảnh." });
    }
    if (!file.mimetype?.toLowerCase().startsWith("image/")) {
      throw new BadRequestException({
        message: "Chỉ chấp nhận tệp ảnh (JPG/PNG/WebP).",
      });
    }
    const n = Number(raw);
    return this.image.search(
      file.buffer,
      Number.isFinite(n) ? Math.trunc(n) : 48,
    );
  }
}
