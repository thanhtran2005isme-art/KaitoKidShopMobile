import { Module } from "@nestjs/common";
import { MigrationModule } from "../migration/migration.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [MigrationModule],
  controllers: [HealthController],
})
export class HealthModule {}
