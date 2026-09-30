import {
  Controller,
  Get,
  Query,
  Req,
} from "@nestjs/common";
import { chatIdentityFromAuthorization } from "../chat/chat-identity.js";
import { ImageSearchService } from "./image-search.service.js";
import { RecommendationService } from "./recommendation.service.js";
import { SearchService } from "./search.service.js";

interface RequestLike {
  headers: { authorization?: string };
}

@Controller("api/search")
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly image: ImageSearchService,
  ) {}

  @Get()
  searchAll(@Query() query: Record<string, unknown>) {
    return this.search.search(query);
  }

  @Get("suggestions")
  suggestions(
    @Query("q") q = "",
    @Query("limit") rawLimit = "6",
  ) {
    return this.search.suggestions(q, Number(rawLimit));
  }

  @Get("by-image/status")
  async imageStatus() {
    return { ready: await this.image.isReady() };
  }
}

@Controller("api/recommendations")
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationService,
  ) {}

  @Get("for-me")
  getForMe(
    @Req() req: RequestLike,
    @Query("limit") rawLimit = "12",
  ) {
    const who = chatIdentityFromAuthorization(
      req.headers.authorization,
      null,
    );
    return this.recommendations.forMe(
      who.userId,
      Number(rawLimit),
    );
  }
}
