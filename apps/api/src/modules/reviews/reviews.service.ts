import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { parseJsonArray, toNumber } from "../../common/db-value.js";
import { normalizeReviewImages, selectPurchasedVariant } from "./review.helpers.js";

interface ReviewRow {
  id: unknown;
  productId: unknown;
  customerName: string;
  rating: unknown;
  comment: string;
  createdAt: Date | string;
  orderId: unknown;
  images: string | null;
  videoUrl: string | null;
  size: string | null;
  color: string | null;
  adminReply: string | null;
  repliedAt: Date | string | null;
  helpfulCount: unknown;
}

function mapReview(row: ReviewRow) {
  return {
    id: toNumber(row.id),
    productId: toNumber(row.productId),
    customerName: row.customerName,
    rating: toNumber(row.rating),
    comment: row.comment,
    createdAt: row.createdAt,
    orderId: toNumber(row.orderId),
    images: parseJsonArray<string>(row.images),
    videoUrl: row.videoUrl,
    size: row.size,
    color: row.color,
    adminReply: row.adminReply,
    repliedAt: row.repliedAt,
    helpfulCount: toNumber(row.helpfulCount),
    isVerifiedPurchase: toNumber(row.orderId) > 0,
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProduct(productId: number) {
    const rows = await this.reviewRows(
      "WHERE SanPhamId = ? AND TrangThai = 'approved' ORDER BY NgayTao DESC",
      productId,
    );
    return rows.map(mapReview);
  }

  async featured(limit: number) {
    const safeLimit = Math.min(Math.max(limit, 0), 12);
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT Id AS id, SanPhamId AS productId, TenKhachHang AS customerName,
              SoSao AS rating, NoiDung AS comment, NgayTao AS createdAt
       FROM DanhGia
       WHERE TrangThai = 'approved' AND SoSao >= 4
       ORDER BY LuotHuuIch DESC, NgayTao DESC
       LIMIT ${safeLimit}`,
    );
    return rows.map((row) => ({
      id: toNumber(row.id),
      productId: toNumber(row.productId),
      customerName: row.customerName,
      rating: toNumber(row.rating),
      comment: row.comment,
      createdAt: row.createdAt,
    }));
  }

  async create(userId: number, customerName: string, raw: Record<string, unknown>) {
    const productId = Number(raw.productId);
    const orderId = Number(raw.orderId);
    const rating = Number(raw.rating);
    const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new BadRequestException("Đánh giá phải được tạo từ một đơn hàng đã hoàn tất.");
    }
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new BadRequestException("Sản phẩm không hợp lệ.");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException("Số sao đánh giá phải từ 1 đến 5.");
    }
    if (comment.length < 3) {
      throw new BadRequestException("Vui lòng chia sẻ ít nhất 3 ký tự về trải nghiệm sản phẩm.");
    }
    if (comment.length > 2000) {
      throw new BadRequestException("Nội dung đánh giá tối đa 2000 ký tự.");
    }

    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM DonHang
         WHERE Id = ? AND NguoiDungId = ?
           AND TrangThai IN ('completed','return_requested')
           AND NgayHoanThanh IS NOT NULL
         LIMIT 1`,
        orderId,
        userId,
      );
      if (!orders[0]) {
        throw new BadRequestException("Đơn hàng không tồn tại, không thuộc tài khoản này hoặc khách chưa xác nhận đã nhận hàng.");
      }

      const productItems = await tx.$queryRawUnsafe<Array<{ size: string; color: string }>>(
        `SELECT KichCo AS size, MauSac AS color
         FROM ChiTietDonHang
         WHERE DonHangId = ? AND SanPhamId = ?`,
        orderId,
        productId,
      );
      if (productItems.length === 0) {
        throw new BadRequestException("Sản phẩm này không thuộc đơn hàng đã chọn.");
      }

      const purchased = selectPurchasedVariant(
        productItems,
        typeof raw.size === "string" ? raw.size : null,
        typeof raw.color === "string" ? raw.color : null,
      );
      if (!purchased) {
        throw new BadRequestException("Không xác định được đúng biến thể đã mua để đánh giá.");
      }

      const duplicate = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        `SELECT Id AS id
         FROM DanhGia
         WHERE NguoiDungId = ? AND SanPhamId = ? AND DonHangId = ?
           AND (KichCo IS NULL OR KichCo = ?)
           AND (MauSac IS NULL OR MauSac = ?)
         LIMIT 1`,
        userId,
        productId,
        orderId,
        purchased.size,
        purchased.color,
      );
      if (duplicate.length > 0) {
        throw new BadRequestException("Bạn đã đánh giá biến thể sản phẩm này trong đơn hàng rồi.");
      }

      const images = normalizeReviewImages(raw.images);
      const videoUrl = typeof raw.videoUrl === "string" && raw.videoUrl.trim()
        ? raw.videoUrl.trim()
        : null;
      const displayName = customerName.trim() || "Khách hàng";

      await tx.$executeRawUnsafe(
        `INSERT INTO DanhGia
           (SanPhamId, NguoiDungId, TenKhachHang, DonHangId, SoSao, NoiDung, TrangThai,
            PhanHoiAdmin, DanhSachAnh, Video, KichCo, MauSac, NgayPhanHoi, LuotHuuIch)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?, NULL, 0)`,
        productId,
        userId,
        displayName,
        orderId,
        rating,
        comment,
        images.length > 0 ? JSON.stringify(images) : null,
        videoUrl,
        purchased.size,
        purchased.color,
      );

      const idRows = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      const reviewId = toNumber(idRows[0]?.id);

      const avgRows = await tx.$queryRawUnsafe<Array<{ rating: unknown }>>(
        `SELECT COALESCE(AVG(SoSao), 0) AS rating
         FROM DanhGia
         WHERE SanPhamId = ? AND TrangThai = 'approved'`,
        productId,
      );
      const average = Math.round(toNumber(avgRows[0]?.rating) * 10) / 10;
      await tx.$executeRawUnsafe(
        "UPDATE SanPham SET DiemDanhGia = ? WHERE Id = ?",
        average,
        productId,
      );

      const rows = await this.reviewRowsWithClient(tx, "WHERE Id = ? LIMIT 1", reviewId);
      return mapReview(rows[0]);
    });
  }

  async markHelpful(reviewId: number): Promise<boolean> {
    const affected = await this.prisma.$executeRawUnsafe(
      "UPDATE DanhGia SET LuotHuuIch = LuotHuuIch + 1 WHERE Id = ?",
      reviewId,
    );
    return affected > 0;
  }

  private reviewRows(whereSql: string, ...params: unknown[]) {
    return this.reviewRowsWithClient(this.prisma, whereSql, ...params);
  }

  private reviewRowsWithClient(client: any, whereSql: string, ...params: unknown[]) {
    return client.$queryRawUnsafe(
      `SELECT
         Id AS id, SanPhamId AS productId, TenKhachHang AS customerName,
         SoSao AS rating, NoiDung AS comment, NgayTao AS createdAt,
         DonHangId AS orderId, DanhSachAnh AS images, Video AS videoUrl,
         KichCo AS size, MauSac AS color, PhanHoiAdmin AS adminReply,
         NgayPhanHoi AS repliedAt, COALESCE(LuotHuuIch, 0) AS helpfulCount
       FROM DanhGia
       ${whereSql}`,
      ...params,
    ) as Promise<ReviewRow[]>;
  }
}
