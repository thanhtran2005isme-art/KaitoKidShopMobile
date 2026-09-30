import { Module } from "@nestjs/common";
import { ImageEmbedder } from "./image-embedder.service.js";
import { ImageEmbeddingIndexer } from "./image-embedding-indexer.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";
import { ImageSearchService } from "./image-search.service.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    ImageEmbeddingStore,
    ImageEmbedder,
    ImageSearchService,
    ImageEmbeddingIndexer,
  ],
})
export class SearchModule {}
