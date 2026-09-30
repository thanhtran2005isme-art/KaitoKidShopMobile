import { Injectable, Logger } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  mapProduct,
  type ProductRow,
} from "../products/product.mapper.js";
import { ImageEmbedder } from "./image-embedder.service.js";
import { ImageEmbeddingStore } from "./image-embedding.store.js";

const PRODUCT_SELECT = `
SELECT
  Id AS id, TenSanPham AS name, DanhMuc AS category,
  DanhMucPhu AS subcategory, GioiTinh AS gender,
  Gia AS price, GiaCu AS oldPrice, TonKho AS stock,
  COALESCE(SoLuongDaGiu,0) AS reserved, TrangThai AS status,
  HinhAnh AS image, MoTaNgan AS shortDescription,
  MaSanPham AS sku, Slug AS slug, LaSanPhamMoi AS isNew,
  DangGiamGia AS isSale, BanChayNhat AS isBestSeller,
  DiemDanhGia AS rating, SoLuongDaBan AS soldCount,
  DanhSachMau AS colors, DanhSachSize AS sizes
FROM SanPham
`;

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedder: ImageEmbedder,
    private readonly store: ImageEmbeddingStore,
  ) {}

  async status() {
    await this.embedder.init();
    return {
      ready: this.embedder.ready && this.store.count > 0,
    };
  }

  async search(bytes: Buffer, limitRaw: number) {
    await this.embedder.init();
    if (!this.embedder.ready) {
      return {
        items: [],
        total: 0,
        ready: false,
        message:
          "Tìm kiếm bằng hình ảnh chưa sẵn sàng (chưa cấu hình mô hình nhận diện). Vui lòng thử lại sau.",
      };
    }
    if (this.store.count === 0) {
      return {
        items: [],
        total: 0,
        ready: false,
        message:
          "Hệ thống đang lập chỉ mục hình ảnh sản phẩm. Vui lòng thử lại sau ít phút.",
      };
    }

    const vector = await this.embedder.embed(bytes);
    if (!vector?.length) {
      return {
        items: [],
        total: 0,
        ready: true,
        message:
          "Không đọc được ảnh. Hãy thử ảnh khác (JPG/PNG/WebP).",
      };
    }

    const maxResults = Math.max(
      1,
      Number(process.env.IMAGE_SEARCH_MAX_RESULTS ?? 48) || 48,
    );
    const limit = Math.max(
      1,
      Math.min(maxResults, Number(limitRaw) || maxResults),
    );
    const thresholdRaw = Number(
      process.env.IMAGE_SEARCH_MIN_SIMILARITY ?? 0.6,
    );
    const threshold = Number.isFinite(thresholdRaw)
      ? Math.max(-1, Math.min(1, thresholdRaw))
      : 0.6;
    const hits = this.store.search(vector, limit, threshold);
    if (hits.length === 0) {
      return { items: [], total: 0, ready: true, message: null };
    }

    const ids = hits.map((item) => item.productId);
    const marks = ids.map(() => "?").join(",");
    const rows = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `${PRODUCT_SELECT}
       WHERE Id IN (${marks}) AND TrangThai = 'active'`,
      ...ids,
    );
    const byId = new Map(
      rows.map((row) => [toNumber(row.id), mapProduct(row)]),
    );
    const items = hits
      .map((hit) => {
        const product = byId.get(hit.productId);
        return product
          ? {
              product,
              similarity: Math.round(hit.score * 10_000) / 10_000,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    this.logger.debug(
      `Image search returned ${items.length} products threshold=${threshold}`,
    );
    return {
      items,
      total: items.length,
      ready: true,
      message: null,
    };
  }
}
