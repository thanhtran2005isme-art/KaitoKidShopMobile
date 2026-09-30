import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { PrismaService } from "../../database/prisma.service.js";
import { ImageEmbedder } from "./image-embedder.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";

interface EmbeddingRow {
  id: unknown;
  productId: unknown;
  vector: string;
  model: string;
  sourceHash: string;
}

interface ProductImageRow {
  id: unknown;
  image: string | null;
}

function toId(value: unknown): number {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function deserialize(raw: string): number[] | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === "number")
    ) {
      return value;
    }
  } catch {
    // ignore corrupt legacy vector
  }
  return null;
}

@Injectable()
export class ImageEmbeddingIndexer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ImageEmbeddingIndexer.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedder: ImageEmbedder,
    private readonly store: ImageEmbeddingStore,
  ) {}

  async onModuleInit() {
    await this.embedder.init();
    await this.loadExisting();

    const enabled = /^(1|true|yes)$/i.test(
      process.env.IMAGE_SEARCH_INDEXER_ENABLED ?? "false",
    );
    if (!enabled) {
      this.logger.log(
        "Image embedding indexer disabled during C#/Node coexistence; existing DB vectors were still loaded.",
      );
      return;
    }

    const interval = Math.max(
      60,
      Number(
        process.env.IMAGE_SEARCH_REINDEX_INTERVAL_SECONDS ?? 600,
      ) || 600,
    );
    this.timer = setInterval(
      () => void this.reindex(),
      interval * 1000,
    );
    this.timer.unref();
    setTimeout(() => void this.reindex(), 5_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async loadExisting() {
    const rows = await this.prisma.$queryRawUnsafe<EmbeddingRow[]>(
      `SELECT Id AS id, SanPhamId AS productId,
              Vector AS vector, Model AS model, NguonHash AS sourceHash
       FROM SanPhamEmbedding
       WHERE Model = ?`,
      this.embedder.modelName,
    ).catch(() => []);

    const entries: Array<[number, number[]]> = [];
    for (const row of rows) {
      const id = toId(row.productId);
      const vector = deserialize(row.vector);
      if (id && vector) entries.push([id, vector]);
    }
    this.store.replaceAll(entries);
    this.logger.log(
      `Loaded ${entries.length} existing image embeddings from MariaDB.`,
    );
  }

  async reindex() {
    if (this.running || !this.embedder.ready) return 0;
    this.running = true;
    try {
      const products =
        await this.prisma.$queryRawUnsafe<ProductImageRow[]>(
          `SELECT Id AS id, HinhAnh AS image
           FROM SanPham
           WHERE TrangThai = 'active'
           ORDER BY Id`,
        );
      const existing =
        await this.prisma.$queryRawUnsafe<EmbeddingRow[]>(
          `SELECT Id AS id, SanPhamId AS productId,
                  Vector AS vector, Model AS model,
                  NguonHash AS sourceHash
           FROM SanPhamEmbedding
           WHERE Model = ?`,
          this.embedder.modelName,
        );
      const byProduct = new Map(
        existing.map((row) => [toId(row.productId), row]),
      );
      const activeIds = new Set(products.map((row) => toId(row.id)));
      let processed = 0;

      for (const product of products) {
        const id = toId(product.id);
        if (!id) continue;
        const hash = this.hash(product.image ?? "");
        const current = byProduct.get(id);
        if (current?.sourceHash === hash) {
          if (!this.store.contains(id)) {
            const vector = deserialize(current.vector);
            if (vector) this.store.upsert(id, vector);
          }
          continue;
        }

        const bytes = await this.fetchImage(product.image);
        if (!bytes) continue;
        const vector = await this.embedder.embed(bytes);
        if (!vector?.length) continue;

        const json = JSON.stringify(Array.from(vector));
        if (current) {
          await this.prisma.$executeRawUnsafe(
            `UPDATE SanPhamEmbedding
             SET SoChieu = ?, Vector = ?, Model = ?,
                 NguonHash = ?, NgayCapNhat = ?
             WHERE Id = ?`,
            vector.length,
            json,
            this.embedder.modelName,
            hash,
            new Date(),
            toId(current.id),
          );
        } else {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO SanPhamEmbedding
               (SanPhamId, SoChieu, Vector, Model,
                NguonHash, NgayCapNhat)
             VALUES (?, ?, ?, ?, ?, ?)`,
            id,
            vector.length,
            json,
            this.embedder.modelName,
            hash,
            new Date(),
          );
        }
        this.store.upsert(id, vector);
        processed += 1;
      }

      for (const current of existing) {
        const productId = toId(current.productId);
        if (productId && !activeIds.has(productId)) {
          await this.prisma.$executeRawUnsafe(
            "DELETE FROM SanPhamEmbedding WHERE Id = ?",
            toId(current.id),
          );
          this.store.remove(productId);
        }
      }

      if (processed > 0) {
        this.logger.log(
          `Reindexed ${processed} product image embeddings; store=${this.store.count}.`,
        );
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  private hash(input: string) {
    return createHash("sha256")
      .update(input, "utf8")
      .digest("hex")
      .toUpperCase();
  }

  private async fetchImage(
    raw: string | null,
  ): Promise<Buffer | null> {
    if (!raw?.trim()) return null;
    const value = raw.trim();
    try {
      if (/^https?:\/\//i.test(value)) {
        return this.download(value);
      }

      const relative = value.replace(/^\/+/, "");
      const publicRoots = [
        resolve(process.env.PUBLIC_ROOT ?? join(process.cwd(), "public")),
        resolve(process.cwd(), "../../apps/web/public"),
        resolve(process.cwd(), "apps/web/public"),
      ];
      const localCandidates = isAbsolute(value)
        ? [value]
        : publicRoots.map((root) => join(root, relative));
      for (const local of localCandidates) {
        try {
          return await readFile(local);
        } catch {
          // thử candidate tiếp theo
        }
      }

      const base = process.env.IMAGE_SEARCH_PUBLIC_ASSET_BASE_URL?.trim();
      if (base) {
        return this.download(
          `${base.replace(/\/+$/, "")}/${relative}`,
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  private async download(url: string): Promise<Buffer | null> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
}
