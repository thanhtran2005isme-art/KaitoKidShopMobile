import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { LegacyDatabaseAuditService } from "../migration/legacy-database-audit.service.js";

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const audit = await app.get(LegacyDatabaseAuditService).audit();
    console.log(JSON.stringify(audit, null, 2));

    if (!audit.compatible) {
      console.error(
        "DB chưa đạt contract backend Node: thiếu bảng hoặc canonical RBAC permission. Dừng cutover và xử lý migration trước.",
      );
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
