import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";
import { ImageEmbedderService } from "./image-embedder.service.js";
import { ImageSearchService } from "./image-search.service.js";
import { ImageEmbeddingIndexerService } from "./image-embedding-indexer.service.js";

@Module({
  controllers:[SearchController],
  providers:[SearchService,ImageEmbeddingStore,ImageEmbedderService,ImageSearchService,ImageEmbeddingIndexerService],
  exports:[SearchService,ImageSearchService],
})
export class SearchModule {}
