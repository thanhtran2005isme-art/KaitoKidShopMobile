import { Global, Module } from "@nestjs/common";
import { MediaStorageService } from "./media-storage.service.js";
import { MediaFallbackController } from "./media-fallback.controller.js";

@Global()
@Module({
  controllers: [MediaFallbackController],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}
