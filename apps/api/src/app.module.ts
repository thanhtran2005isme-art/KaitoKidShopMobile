import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { MigrationModule } from "./migration/migration.module.js";

@Module({
  imports: [DatabaseModule, MigrationModule, HealthModule],
})
export class AppModule {}
