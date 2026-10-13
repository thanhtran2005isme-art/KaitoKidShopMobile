import "dotenv/config";
import "reflect-metadata";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { isCorsOriginAllowed, parseCorsOrigins } from "./common/cors.js";
import {
  registerLegacyMediaFallback,
  resolveSharedWebPublicRoot,
} from "./media/legacy-media.js";

function isSwaggerEnabled(): boolean {
  const explicit = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function configureSwagger(app: NestExpressApplication): boolean {
  if (!isSwaggerEnabled()) return false;

  const config = new DocumentBuilder()
    .setTitle("KaitoKidShop Node API")
    .setDescription(
      "Danh sách REST API của KaitoKidShop. Swagger khai báo JWT toàn cục để Try it out có thể gửi access token tới endpoint được bảo vệ; endpoint public vẫn có thể gọi mà không cần token.",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập access token KaitoKid, không cần tự thêm tiền tố Bearer.",
      },
      "kaitokid-jwt",
    )
    .addSecurityRequirements("kaitokid-jwt")
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}.${methodKey}`,
  });

  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
    customSiteTitle: "KaitoKid API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: "none",
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  return true;
}

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

  const swaggerEnabled = configureSwagger(app);
  const port = Number(process.env.PORT ?? 5300);
  await app.listen(port, "0.0.0.0");

  if (swaggerEnabled) {
    console.log(`[SWAGGER] UI: http://localhost:${port}/docs`);
    console.log(`[SWAGGER] JSON: http://localhost:${port}/docs-json`);
  }
}

void bootstrap();
