import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { LegacyDatabaseAuditService } from "../migration/legacy-database-audit.service.js";

const LEGACY_ONLY_SURFACES = [
  "API.Admin: /api/admin/products + inventory + orders + customers + reports + settings + CMS CRUD",
  "API.Customer AdminShipping: /api/admin/shipping",
  "API.Customer Attributes: /api/attributes",
  "API.Customer Newsletter: /api/newsletter",
  "API.Customer ProductExtras/Q&A: product extras routes",
  "API.Customer Recommendations: /api/recommendations",
  "API.Customer Sitemap: sitemap routes",
  "API.Admin public FlashSales controller",
] as const;

function enabled(name: string): boolean {
  return /^(1|true|yes)$/i.test(process.env[name] ?? "false");
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const database =
      await app.get(LegacyDatabaseAuditService).audit();
    const finalCutoverRequested = enabled("NODE_FINAL_CUTOVER");
    const nodeWriters = {
      cartReservationSweeper: enabled("CART_SWEEPER_ENABLED"),
      paymentExpirySweeper: enabled("PAYMENT_SWEEPER_ENABLED"),
      chatIdleSweeper: enabled("CHAT_SWEEPER_ENABLED"),
      imageEmbeddingIndexer: enabled("IMAGE_SEARCH_INDEXER_ENABLED"),
      shippingSimulator: enabled("SHIPPING_SIMULATOR_ENABLED"),
    };
    const enabledWriters = Object.entries(nodeWriters)
      .filter(([, value]) => value)
      .map(([name]) => name);

    // Trong coexistence, C# vẫn sở hữu các background write-jobs.
    const dualWriterRisk =
      !finalCutoverRequested && enabledWriters.length > 0;

    // Không được tuyên bố tắt toàn bộ C# khi vẫn còn route chưa mirror.
    const finalCutoverReady =
      finalCutoverRequested &&
      database.compatible &&
      !dualWriterRisk &&
      LEGACY_ONLY_SURFACES.length === 0;

    const result = {
      phase: 9,
      database,
      finalCutoverRequested,
      nodeWriters,
      coexistenceSafe: database.compatible && !dualWriterRisk,
      legacyOnlySurfaceCount: LEGACY_ONLY_SURFACES.length,
      legacyOnlySurfaces: LEGACY_ONLY_SURFACES,
      finalCutoverReady,
      decision:
        finalCutoverReady
          ? "READY_TO_DISABLE_CSHARP"
          : finalCutoverRequested
            ? "BLOCKED_DO_NOT_DISABLE_CSHARP"
            : "COEXISTENCE_KEEP_CSHARP_AS_ROLLBACK",
    };

    console.log(JSON.stringify(result, null, 2));

    if (!database.compatible) {
      console.error(
        "Database contract không tương thích. Dừng cutover.",
      );
      process.exitCode = 1;
    } else if (dualWriterRisk) {
      console.error(
        "Coexistence đang bật Node background writer; có nguy cơ C# + Node cùng ghi. Tắt các *_ENABLED trước.",
      );
      process.exitCode = 1;
    } else if (finalCutoverRequested && !finalCutoverReady) {
      console.error(
        "NODE_FINAL_CUTOVER=true nhưng vẫn còn legacy-only API. Không được tắt C#.",
      );
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
