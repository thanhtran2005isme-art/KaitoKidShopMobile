import "dotenv/config";
import "reflect-metadata";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { isCorsOriginAllowed, parseCorsOrigins } from "./common/cors.js";
import {
  registerLegacyMediaFallback,
  resolveSharedWebPublicRoot,
} from "./media/legacy-media.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Admin settings có thể chứa QR ngân hàng dạng data URL/base64. Giới hạn mặc
  // định ~100 KB của Express sẽ trả 413 trước khi request tới controller.
  // Giữ một ngưỡng hữu hạn để hỗ trợ payload cấu hình thực tế mà không mở vô hạn.
  app.useBodyParser("json", { limit: "16mb" });

  const origins = parseCorsOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isCorsOriginAllowed(origin, origins));
    },
    credentials: true,
  });

  const publicRoot = resolve(process.env.PUBLIC_ROOT ?? join(process.cwd(), "public"));
  app.useStaticAssets(publicRoot);

  const sharedWebPublicRoot = resolveSharedWebPublicRoot();
  if (sharedWebPublicRoot !== publicRoot && existsSync(sharedWebPublicRoot)) {
    app.useStaticAssets(sharedWebPublicRoot);
  }

  // Static middleware chạy trước. Chỉ khi file legacy thật sự không tồn tại
  // mới trả placeholder tương thích API.Customer C# cho /products/* và /lookbook/*.
  registerLegacyMediaFallback(app);

  const port = Number(process.env.PORT ?? 5300);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
