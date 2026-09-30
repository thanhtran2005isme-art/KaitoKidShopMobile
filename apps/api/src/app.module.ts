import { Module } from "@nestjs/common";
import { BannersModule } from "./modules/banners/banners.module.js";
import { CategoriesModule } from "./modules/categories/categories.module.js";
import { CollectionsModule } from "./modules/collections/collections.module.js";
import { HomepageBlocksModule } from "./modules/homepage-blocks/homepage-blocks.module.js";
import { LookbooksModule } from "./modules/lookbooks/lookbooks.module.js";
import { ProductsModule } from "./modules/products/products.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { MigrationModule } from "./migration/migration.module.js";

@Module({
  imports: [
    DatabaseModule,
    MigrationModule,
    HealthModule,
    ProductsModule,
    CategoriesModule,
    BannersModule,
    HomepageBlocksModule,
    CollectionsModule,
    LookbooksModule,
  ],
})
export class AppModule {}
