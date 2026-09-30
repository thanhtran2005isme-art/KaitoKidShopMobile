import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const origins = parseOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 5300);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
