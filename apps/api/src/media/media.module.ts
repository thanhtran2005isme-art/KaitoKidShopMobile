import { Global, Module } from "@nestjs/common";
import { MediaStorageService } from "./media-storage.service.js";

@Global()
@Module({
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}
