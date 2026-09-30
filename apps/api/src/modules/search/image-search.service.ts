import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaService } from "../../database/prisma.service.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";
import { PRODUCT_SELECT } from "./search.service.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

interface EmbeddingRow {
  productId: unknown;
  vector: string;
  model: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);
  private session: any = null;
  private vectors = new Map<number, number[]>();
  private loading = false;

  constructor(private readonly prisma: PrismaService) {}

  async isReady() {
    await this.ensureLoaded();
    return Boolean(this.session) && this.vectors.size > 0;
  }

  async search(bytes: Buffer, rawLimit = 48) {
    await this.ensureLoaded();
    if (!this.session) {
      return {
        ready: false,
        total: 0,
        items: [],
        message:
          "Tìm kiếm bằng hình ảnh chưa sẵn sàng (chưa cấu hình mô hình nhận diện). Vui lòng thử lại sau.",
      };
    }
    if (this.vectors.size === 0) {
      return {
        ready: false,
        total: 0,
        items: [],
        message:
          "Hệ thống đang lập chỉ mục hình ảnh sản phẩm. Vui lòng thử lại sau ít phút.",
      };
    }
    const query = await this.embed(bytes);
    if (!query.length) {
      return {
        ready: true,
        total: 0,
        items: [],
        message: "Không đọc được ảnh. Hãy thử ảnh khác (JPG/PNG/WebP).",
      };
    }

    const min = Number(process.env.IMAGE_SEARCH_MIN_SIMILARITY ?? 0.15);
    const limit = Math.max(
      1,
      Math.min(
        Number(process.env.IMAGE_SEARCH_MAX_RESULTS ?? 48),
        rawLimit || 48,
      ),
    );
    const hits = [...this.vectors.entries()]
      .map(([productId, vector]) => ({
        productId,
        similarity: cosineSimilarity(query, vector),
      }))
      .filter((x) => x.similarity >= min)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (!hits.length) {
      return { ready: true, total: 0, items: [] };
    }
    const ids = hits.map((x) => x.productId);
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_SELECT}
       WHERE TrangThai='active'
         AND Id IN (${ids.map(() => "?").join(",")})`,
      ...ids,
    );
    const byId = new Map(rows.map((r) => [Number(r.id), mapProduct(r)]));
    const items = hits
      .filter((h) => byId.has(h.productId))
      .map((h) => ({
        product: byId.get(h.productId),
        similarity: Math.round(h.similarity * 10_000) / 10_000,
      }));
    return { ready: true, total: items.length, items };
  }

  async reindex() {
    if (!/^(1|true|yes)$/i.test(
      process.env.IMAGE_SEARCH_ENABLED ?? "true",
    )) {
      return 0;
    }
    await this.ensureLoaded();
    if (!this.session) return 0;

    const model =
      process.env.IMAGE_SEARCH_MODEL_NAME ?? "clip-vit-base-patch32";
    const products = await this.prisma.$queryRawUnsafe<Array<{
      id: unknown; image: string | null;
    }>>(
      `SELECT Id AS id, HinhAnh AS image
       FROM SanPham
       WHERE TrangThai='active'
       ORDER BY Id`,
    );
    const existing = await this.prisma.$queryRawUnsafe<Array<{
      productId: unknown; sourceHash: string;
    }>>(
      `SELECT SanPhamId AS productId, NguonHash AS sourceHash
       FROM SanPhamEmbedding
       WHERE Model=?`,
      model,
    );
    const hashes = new Map(
      existing.map((x) => [Number(x.productId), x.sourceHash]),
    );
    const active = new Set(products.map((p) => Number(p.id)));
    let changed = 0;

    for (const product of products) {
      const id = Number(product.id);
      const image = product.image?.trim();
      if (!image) continue;
      const hash = createHash("sha256").update(image).digest("hex").toUpperCase();
      if (hashes.get(id) === hash && this.vectors.has(id)) continue;
      const bytes = await this.fetchImage(image);
      if (!bytes) continue;
      const vector = await this.embed(bytes).catch(() => []);
      if (!vector.length) continue;
      const json = JSON.stringify(vector);
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
          `SELECT Id AS id
           FROM SanPhamEmbedding
           WHERE SanPhamId=?
           ORDER BY Id
           LIMIT 1
           FOR UPDATE`,
          id,
        );
        if (rows[0]) {
          await tx.$executeRawUnsafe(
            `UPDATE SanPhamEmbedding
             SET SoChieu=?, Vector=?, Model=?, NguonHash=?, NgayCapNhat=?
             WHERE Id=?`,
            vector.length,
            json,
            model,
            hash,
            new Date(),
            Number(rows[0].id),
          );
        } else {
          await tx.$executeRawUnsafe(
            `INSERT INTO SanPhamEmbedding
               (SanPhamId, SoChieu, Vector, Model, NguonHash, NgayCapNhat)
             VALUES (?, ?, ?, ?, ?, ?)`,
            id,
            vector.length,
            json,
            model,
            hash,
            new Date(),
          );
        }
      });
      this.vectors.set(id, vector);
      changed += 1;
    }

    const stale = [...this.vectors.keys()].filter((id) => !active.has(id));
    for (const id of stale) this.vectors.delete(id);
    if (stale.length) {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM SanPhamEmbedding
         WHERE SanPhamId IN (${stale.map(() => "?").join(",")})`,
        ...stale,
      );
    }
    return changed;
  }

  private async ensureLoaded() {
    if (this.loading) {
      while (this.loading) await new Promise((r) => setTimeout(r, 20));
      return;
    }
    if (this.session) return;
    if (!/^(1|true|yes)$/i.test(
      process.env.IMAGE_SEARCH_ENABLED ?? "true",
    )) {
      return;
    }
    this.loading = true;
    try {
      const modelPath =
        process.env.IMAGE_SEARCH_MODEL_PATH ??
        "Models/clip-image-encoder.onnx";
      const resolved = path.isAbsolute(modelPath)
        ? modelPath
        : path.resolve(process.cwd(), modelPath);
      try {
        await access(resolved);
      } catch {
        this.logger.warn(
          `Không tìm thấy model ONNX tại ${resolved}; image search tắt mềm.`,
        );
        return;
      }

      const ort = await import("onnxruntime-node");
      this.session = await ort.InferenceSession.create(resolved, {
        graphOptimizationLevel: "all",
      });
      const model =
        process.env.IMAGE_SEARCH_MODEL_NAME ?? "clip-vit-base-patch32";
      const rows = await this.prisma.$queryRawUnsafe<EmbeddingRow[]>(
        `SELECT SanPhamId AS productId, Vector AS vector, Model AS model
         FROM SanPhamEmbedding
         WHERE Model=?`,
        model,
      );
      for (const row of rows) {
        try {
          const vector = JSON.parse(row.vector);
          if (Array.isArray(vector) && vector.length) {
            this.vectors.set(
              Number(row.productId),
              vector.map(Number),
            );
          }
        } catch {
          // skip corrupt row
        }
      }
    } finally {
      this.loading = false;
    }
  }

  private async embed(bytes: Buffer): Promise<number[]> {
    if (!this.session) return [];
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;
    const size = Math.max(
      32,
      Number(process.env.IMAGE_SEARCH_INPUT_SIZE ?? 224),
    );
    const raw = await sharp(bytes)
      .resize(size, size, { fit: "cover", position: "centre" })
      .removeAlpha()
      .raw()
      .toBuffer();

    const mean = [0.48145466, 0.4578275, 0.40821073];
    const std = [0.26862954, 0.26130258, 0.27577711];
    const data = new Float32Array(1 * 3 * size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const base = (y * size + x) * 3;
        for (let c = 0; c < 3; c++) {
          data[c * size * size + y * size + x] =
            (raw[base + c] / 255 - mean[c]) / std[c];
        }
      }
    }
    const ort = await import("onnxruntime-node");
    const inputName = this.session.inputNames[0];
    const tensor = new ort.Tensor("float32", data, [1, 3, size, size]);
    const output = await this.session.run({ [inputName]: tensor });
    const preferred = [
      "image_embeds", "image_embedding", "embeds",
      "embedding", "pooler_output", "sentence_embedding",
    ];
    const outputName =
      preferred.find((x) => output[x]) ??
      this.session.outputNames[0];
    const value = output[outputName]?.data;
    if (!value) return [];
    const vector = Array.from(value as Float32Array, Number);
    const norm = Math.sqrt(
      vector.reduce((sum, x) => sum + x * x, 0),
    );
    return norm > 1e-8 ? vector.map((x) => x / norm) : vector;
  }

  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      if (/^https?:\/\//i.test(url)) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return null;
        return Buffer.from(await response.arrayBuffer());
      }
      const base = process.env.PUBLIC_ASSET_BASE_URL?.replace(/\/+$/, "");
      if (!base) return null;
      const response = await fetch(
        `${base}/${url.replace(/^\/+/, "")}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

}
