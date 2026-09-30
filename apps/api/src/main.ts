import "dotenv/config";
import "reflect-metadata";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = parseOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });

  const publicRoot = resolve(
    process.env.PUBLIC_ROOT ?? join(process.cwd(), "public"),
  );
  app.useStaticAssets(publicRoot);

  // Parity API.Customer: local/dev media cũ đang nằm trong apps/web/public.
  const sharedWebPublicRoot = resolve(
    process.env.SHARED_WEB_PUBLIC_ROOT ??
      join(process.cwd(), "..", "web", "public"),
  );
  if (sharedWebPublicRoot !== publicRoot) {
    app.useStaticAssets(sharedWebPublicRoot);
  }

  const port = Number(process.env.PORT ?? 5300);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
