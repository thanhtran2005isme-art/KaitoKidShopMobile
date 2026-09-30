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
      console.error("DB thiếu bảng thuộc contract C# cũ. Dừng migration Node và xử lý schema trước.");
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
