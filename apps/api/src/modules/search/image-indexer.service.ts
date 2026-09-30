import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ImageSearchService } from "./image-search.service.js";

@Injectable()
export class ImageEmbeddingIndexerService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageEmbeddingIndexerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly image: ImageSearchService) {}

  onModuleInit() {
    if (!/^(1|true|yes)$/i.test(
      process.env.IMAGE_INDEXER_ENABLED ?? "false",
    )) {
      return;
    }
    const seconds = Math.max(
      60,
      Number(process.env.IMAGE_REINDEX_INTERVAL_SECONDS ?? 600),
    );
    setTimeout(() => void this.tick(), 5000).unref();
    this.timer = setInterval(
      () => void this.tick(),
      seconds * 1000,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const changed = await this.image.reindex();
      if (changed) {
        this.logger.log(`Reindexed ${changed} product image embeddings`);
      }
    } catch (error) {
      this.logger.error(
        "Image embedding indexer failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
