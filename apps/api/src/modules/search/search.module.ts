import { Module } from "@nestjs/common";
import { ImageSearchController } from "./image-search.controller.js";
import { ImageEmbeddingIndexerService } from "./image-indexer.service.js";
import { ImageSearchService } from "./image-search.service.js";
import {
  RecommendationsController,
  SearchController,
} from "./search.controller.js";
import { RecommendationService } from "./recommendation.service.js";
import { SearchService } from "./search.service.js";

@Module({
  controllers: [
    SearchController,
    ImageSearchController,
    RecommendationsController,
  ],
  providers: [
    SearchService,
    RecommendationService,
    ImageSearchService,
    ImageEmbeddingIndexerService,
  ],
})
export class SearchModule {}
