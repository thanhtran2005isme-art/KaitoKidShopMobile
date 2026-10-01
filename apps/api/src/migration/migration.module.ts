import { Module } from "@nestjs/common";
import { LegacyDatabaseAuditService } from "./legacy-database-audit.service.js";

@Module({
  providers: [LegacyDatabaseAuditService],
  exports: [LegacyDatabaseAuditService],
})
export class MigrationModule {}
