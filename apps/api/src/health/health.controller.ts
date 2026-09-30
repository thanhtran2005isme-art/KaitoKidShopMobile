import { Controller, Get } from "@nestjs/common";
import { LegacyDatabaseAuditService } from "../migration/legacy-database-audit.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseAudit: LegacyDatabaseAuditService) {}

  @Get()
  async getHealth() {
    const database = await this.databaseAudit.audit();
    return {
      status: database.compatible ? "ok" : "degraded",
      service: "KaitoKid Node API migration",
      database: {
        expectedTables: database.expectedTableCount,
        actualTables: database.actualTableCount,
        missingTables: database.missingTables,
      },
    };
  }
}
