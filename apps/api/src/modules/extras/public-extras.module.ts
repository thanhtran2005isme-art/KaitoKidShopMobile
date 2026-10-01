import { Module } from "@nestjs/common";
import {
  AttributesController,
  NewsletterController,
  ProductExtrasController,
} from "./public-extras.controller.js";
import { SitemapController } from "./sitemap.controller.js";

@Module({
  controllers: [
    AttributesController,
    NewsletterController,
    ProductExtrasController,
    SitemapController,
  ],
})
export class PublicExtrasModule {}
