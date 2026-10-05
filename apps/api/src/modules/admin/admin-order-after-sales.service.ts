import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { insertRow } from "./admin-utils.js";

const RETURN_MARKERS = [
  "return_requested",
  "return_approved",
  "return_rejected",
  "return_received_restock",
  "return_received_quarantine",
] as const;
const REFUND_MARKERS = ["refund_pending", "refund_completed_manual"] as const;
const CASE_MARKERS = [
  "delivery_disputed",
  "received_by_customer",
  ...RETURN_MARKERS,
  ...REFUND_MARKERS,
] as const;

type ReturnMarker = (typeof RETURN_MARKERS)[number];
type RefundMarker = (typeof REFUND_MARKERS)[number];
type ReturnStatus =
  | "none"
  | "requested"
  | "approved"
  | "rejected"
  | "received_restock"
  | "received_quarantine";
type RefundStatus = "none" | "pending" | "completed";

interface OrderRow {
  id: unknown;
  orderCode: string;
  orderStatus: string;
  shippingStatus: string | null;
  paymentMethod: string;
  paidAt: Date | string | null;
  total: unknown;
  customerName: string;
}

interface HistoryRow {
  id: unknown;
  status: string;
  description: string | null;
  actor: string | null;
  at: Date | string;
}

interface OrderItemRow {
  productId: unknown;
  productName: string;
  size: string;
  color: string;
  quantity: unknown;
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function staffName(user: AuthenticatedUser): string {
  return user.name?.trim() || "Admin";
}

function validateNote(raw: unknown, label: string, required = false): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    if (required) throw new BadRequestException(`${label} không được để trống.`);
    return null;
  }
  if (value.length < 3) throw new BadRequestException(`${label} phải có ít nhất 3 ký tự.`);
  if (value.length > 300) throw new BadRequestException(`${label} tối đa 300 ký tự.`);
  return value;
}

function returnStatusFrom(marker?: string): ReturnStatus {
  switch (marker) {
    case "return_requested": return "requested";
    case "return_approved": return "approved";
    case "return_rejected": return "rejected";
    case "return_received_restock": return "received_restock";
    case "return_received_quarantine": return "received_quarantine";
    default: return "none";
  }
}

function refundStatusFrom(marker?: string): RefundStatus {
  if (marker === "refund_pending") return "pending";
  if (marker === "refund_completed_manual") return "completed";
  return "none";
}

function latestOf(history: HistoryRow[], statuses: readonly string[]): HistoryRow | undefined {
  const allowed = new Set(statuses);
  return [...history].reverse().find((row) => allowed.has(row.status));
}

@Injectable()
export class AdminOrderAfterSalesService {
  constructor(private readonly db: PrismaService) {}

  async listCases() {
    const rows = await this.db.$queryRawUnsafe<Array<{ orderId: unknown }>>(
      `SELECT h.DonHangId AS orderId
       FROM LichSuTrangThaiVanChuyen h
       WHERE h.TrangThai IN (${CASE_MARKERS.map(() => "?").join(",")})
       GROUP BY h.DonHangId
       ORDER BY MAX(h.ThoiGian) DESC, MAX(h.Id) DESC
       LIMIT 200`,
      ...CASE_MARKERS,
    );
    const result = [];
    for (const row of rows) {
      const orderId = toNumber(row.orderId);
      if (orderId > 0) result.push(await this.snapshot(orderId));
    }
    return result;
  }

  async snapshot(orderId: number) {
    const orders = await this.db.$queryRawUnsafe<OrderRow[]>(
      `SELECT Id AS id, MaDonHang AS orderCode, TrangThai AS orderStatus,
              TrangThaiVanChuyen AS shippingStatus,
              PhuongThucThanhToan AS paymentMethod,
              NgayThanhToan AS paidAt, TongTien AS total,
              TenNguoiNhan AS customerName
       FROM DonHang WHERE Id = ? LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new NotFoundException("Đơn hàng không tồn tại.");

    const history = await this.caseHistory(this.db, orderId);
    const latestReturn = latestOf(history, RETURN_MARKERS);
    const latestRefund = latestOf(history, REFUND_MARKERS);
    const latestDelivery = latestOf(history, ["delivery_disputed", "received_by_customer"]);
    const returnStatus = returnStatusFrom(latestReturn?.status);
    const refundStatus = refundStatusFrom(latestRefund?.status);
    const deliveryIssueOpen = latestDelivery?.status === "delivery_disputed";

    const returnReason = [...history]
      .reverse()
      .find((row) => row.status === "return_requested")?.description ?? null;

    return {
      orderId,
      orderCode: order.orderCode,
      customerName: order.customerName,
      orderStatus: normalized(order.orderStatus),
      shippingStatus: normalized(order.shippingStatus),
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      total: toNumber(order.total),
      deliveryIssueOpen,
      returnStatus,
      returnReason,
      decisionNote:
        latestReturn && ["return_approved", "return_rejected"].includes(latestReturn.status)
          ? latestReturn.description
          : null,
      disposition:
        returnStatus === "received_restock"
          ? "restock"
          : returnStatus === "received_quarantine"
            ? "quarantine"
            : null,
      refundStatus,
      refundReference:
        latestRefund?.status === "refund_completed_manual"
          ? latestRefund.description
          : null,
      latestEventAt: history.at(-1)?.at ?? null,
      requiresAttention:
        deliveryIssueOpen ||
        returnStatus === "requested" ||
        returnStatus === "approved" ||
        refundStatus === "pending",
      canApproveReturn: returnStatus === "requested",
      canRejectReturn: returnStatus === "requested",
      canReceiveReturn:
        returnStatus === "approved" && normalized(order.orderStatus) !== "returned",
      canMarkRefundCompleted:
        normalized(order.orderStatus) === "returned" && refundStatus === "pending",
      history,
    };
  }

  async decideReturn(
    user: AuthenticatedUser,
    orderId: number,
    rawDecision: unknown,
    rawNote: unknown,
  ) {
    const decision = normalized(rawDecision);
    if (!["approve", "reject"].includes(decision)) {
      throw new BadRequestException("decision phải là approve hoặc reject.");
    }
    const note = validateNote(rawNote, "Ghi chú quyết định", decision === "reject");
    const marker: ReturnMarker = decision === "approve" ? "return_approved" : "return_rejected";

    await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (["cancelled", "returned"].includes(normalized(order.orderStatus))) {
        throw new BadRequestException("Đơn hàng không còn ở trạng thái có thể duyệt hoàn.");
      }

      const latest = latestOf(await this.caseHistory(tx, orderId), RETURN_MARKERS);
      if (latest?.status === marker) return;
      if (latest?.status !== "return_requested") {
        throw new BadRequestException("Yêu cầu hoàn hàng không còn ở trạng thái chờ duyệt.");
      }

      const now = new Date();
      await this.appendHistory(
        tx,
        orderId,
        marker,
        `${decision === "approve" ? "Admin duyệt yêu cầu hoàn hàng" : "Admin từ chối yêu cầu hoàn hàng"}${note ? `: ${note}` : ""}`,
        staffName(user),
        now,
      );
    });

    return this.snapshot(orderId);
  }

  async receiveReturn(
    user: AuthenticatedUser,
    orderId: number,
    rawDisposition: unknown,
    rawNote: unknown,
  ) {
    const disposition = normalized(rawDisposition);
    if (!["restock", "quarantine"].includes(disposition)) {
      throw new BadRequestException("disposition phải là restock hoặc quarantine.");
    }
    const note = validateNote(rawNote, "Ghi chú kiểm hàng", true)!;
    const receiveMarker: ReturnMarker =
      disposition === "restock" ? "return_received_restock" : "return_received_quarantine";

    await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      const history = await this.caseHistory(tx, orderId);
      const latest = latestOf(history, RETURN_MARKERS);
      if (latest?.status === receiveMarker && normalized(order.orderStatus) === "returned") return;
      if (latest?.status === "return_received_restock" || latest?.status === "return_received_quarantine") {
        throw new BadRequestException("Hàng hoàn đã được ghi nhận trước đó.");
      }
      if (latest?.status !== "return_approved") {
        throw new BadRequestException("Yêu cầu hoàn phải được duyệt trước khi nhận hàng hoàn.");
      }
      if (normalized(order.orderStatus) !== "completed") {
        throw new BadRequestException("Chỉ đơn completed đã duyệt hoàn mới được nhận hàng trả về.");
      }

      const items = await tx.$queryRawUnsafe<OrderItemRow[]>(
        `SELECT SanPhamId AS productId, TenSanPham AS productName,
                KichCo AS size, MauSac AS color, SoLuong AS quantity
         FROM ChiTietDonHang
         WHERE DonHangId = ?
         ORDER BY SanPhamId, Id`,
        orderId,
      );
      if (items.length === 0) throw new BadRequestException("Đơn hàng không có sản phẩm để hoàn.");

      const now = new Date();
      for (const item of items) {
        const productId = toNumber(item.productId);
        const quantity = toNumber(item.quantity);
        if (productId <= 0 || quantity <= 0) continue;

        const products = await tx.$queryRawUnsafe<Array<{
          id: unknown;
          stock: unknown;
          sold: unknown;
          status: string;
        }>>(
          `SELECT Id AS id, TonKho AS stock, SoLuongDaBan AS sold, TrangThai AS status
           FROM SanPham WHERE Id = ? LIMIT 1 FOR UPDATE`,
          productId,
        );
        const product = products[0];
        if (!product) throw new BadRequestException(`Sản phẩm ${productId} không còn tồn tại.`);

        const before = toNumber(product.stock);
        const after = disposition === "restock" ? before + quantity : before;
        const nextProductStatus =
          disposition === "restock" && normalized(product.status) === "out-of-stock"
            ? "active"
            : product.status;

        const variants = await tx.$queryRawUnsafe<Array<{
          id: unknown;
          stock: unknown;
          sold: unknown;
        }>>(
          `SELECT Id AS id, SoLuong AS stock, SoLuongDaBan AS sold
           FROM TonKhoBienThe
           WHERE SanPhamId = ? AND KichCo = ? AND MauSac = ?
           LIMIT 1 FOR UPDATE`,
          productId,
          item.size,
          item.color,
        );
        const variant = variants[0];
        if (disposition === "restock" && !variant) {
          throw new BadRequestException(
            `Không tìm thấy tồn biến thể ${item.productName} / ${item.size} / ${item.color}; không thể nhập lại tồn bán.`,
          );
        }

        await tx.$executeRawUnsafe(
          `UPDATE SanPham
           SET TonKho = ?, SoLuongDaBan = GREATEST(0, SoLuongDaBan - ?),
               TrangThai = ?, NgayCapNhat = ?
           WHERE Id = ?`,
          after,
          quantity,
          nextProductStatus,
          now,
          productId,
        );

        if (variant) {
          const variantStock = toNumber(variant.stock);
          const variantAfter = disposition === "restock" ? variantStock + quantity : variantStock;
          await tx.$executeRawUnsafe(
            `UPDATE TonKhoBienThe
             SET SoLuong = ?, SoLuongDaBan = GREATEST(0, SoLuongDaBan - ?), NgayCapNhat = ?
             WHERE Id = ?`,
            variantAfter,
            quantity,
            now,
            toNumber(variant.id),
          );
        }

        await insertRow(tx, "TonKho_LichSu", {
          SanPhamId: productId,
          TenSanPham: item.productName,
          LoaiThayDoi: "return",
          SoLuong: quantity,
          TonKhoTruoc: before,
          TonKhoSau: after,
          GhiChu:
            disposition === "restock"
              ? `Hàng hoàn đơn ${order.orderCode} đã kiểm tra và nhập lại tồn bán được - ${note}`
              : `Hàng hoàn đơn ${order.orderCode} đưa vào quarantine, không tăng tồn bán được - ${note}`,
          NguoiThucHien: staffName(user),
          DonHangId: orderId,
          NgayTao: now,
        });
      }

      await tx.$executeRawUnsafe(
        `UPDATE DonHang
         SET TrangThai = 'returned', TrangThaiVanChuyen = 'returned', NgayCapNhat = ?
         WHERE Id = ?`,
        now,
        orderId,
      );
      await this.appendHistory(
        tx,
        orderId,
        receiveMarker,
        disposition === "restock"
          ? `Admin xác nhận đã nhận và kiểm hàng hoàn; hàng đủ điều kiện nhập lại tồn: ${note}`
          : `Admin xác nhận đã nhận hàng hoàn; hàng chuyển quarantine, không nhập tồn bán: ${note}`,
        staffName(user),
        now,
      );

      const latestRefund = latestOf(history, REFUND_MARKERS);
      if (latestRefund?.status !== "refund_completed_manual") {
        await this.appendHistory(
          tx,
          orderId,
          "refund_pending",
          `Chờ xử lý hoàn tiền cho đơn trả hàng, số tiền tối đa theo đơn: ${toNumber(order.total)}đ`,
          "Hệ thống",
          now,
        );
      }
    });

    return this.snapshot(orderId);
  }

  async markRefundCompleted(
    user: AuthenticatedUser,
    orderId: number,
    rawReference: unknown,
  ) {
    const reference = validateNote(rawReference, "Mã tham chiếu/ghi chú hoàn tiền", true)!;

    await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (normalized(order.orderStatus) !== "returned") {
        throw new BadRequestException("Chỉ đơn đã nhận hàng hoàn mới có thể xác nhận hoàn tiền.");
      }
      const history = await this.caseHistory(tx, orderId);
      const latestRefund = latestOf(history, REFUND_MARKERS);
      if (latestRefund?.status === "refund_completed_manual") return;
      if (latestRefund?.status !== "refund_pending") {
        throw new BadRequestException("Đơn chưa ở trạng thái chờ hoàn tiền.");
      }

      await this.appendHistory(
        tx,
        orderId,
        "refund_completed_manual",
        `Admin xác nhận đã hoàn tiền thủ công. Tham chiếu: ${reference}`,
        staffName(user),
        new Date(),
      );
    });

    return this.snapshot(orderId);
  }

  private async lockOrder(tx: SqlClient, orderId: number): Promise<OrderRow> {
    const rows = await tx.$queryRawUnsafe<OrderRow[]>(
      `SELECT Id AS id, MaDonHang AS orderCode, TrangThai AS orderStatus,
              TrangThaiVanChuyen AS shippingStatus,
              PhuongThucThanhToan AS paymentMethod,
              NgayThanhToan AS paidAt, TongTien AS total,
              TenNguoiNhan AS customerName
       FROM DonHang WHERE Id = ? LIMIT 1 FOR UPDATE`,
      orderId,
    );
    if (!rows[0]) throw new NotFoundException("Đơn hàng không tồn tại.");
    return rows[0];
  }

  private caseHistory(client: SqlClient | PrismaService, orderId: number) {
    return client.$queryRawUnsafe<HistoryRow[]>(
      `SELECT Id AS id, TrangThai AS status, MoTa AS description,
              ViTri AS actor, ThoiGian AS at
       FROM LichSuTrangThaiVanChuyen
       WHERE DonHangId = ?
         AND TrangThai IN (${CASE_MARKERS.map(() => "?").join(",")})
       ORDER BY ThoiGian ASC, Id ASC`,
      orderId,
      ...CASE_MARKERS,
    );
  }

  private appendHistory(
    tx: SqlClient,
    orderId: number,
    status: string,
    description: string,
    actor: string,
    at: Date,
  ) {
    return tx.$executeRawUnsafe(
      `INSERT INTO LichSuTrangThaiVanChuyen
         (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
       VALUES (?, ?, ?, ?, ?)`,
      orderId,
      status,
      description,
      actor,
      at,
    );
  }
}
