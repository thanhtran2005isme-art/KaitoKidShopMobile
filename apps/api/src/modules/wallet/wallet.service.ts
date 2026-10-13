import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";

const WITHDRAWAL_ACTIVE = ["pending", "approved"] as const;

type WalletRow = {
  id: unknown;
  userId: unknown;
  available: unknown;
  held: unknown;
  createdAt: Date | string;
  updatedAt: Date | string | null;
};

type WithdrawalRow = {
  id: unknown;
  userId: unknown;
  walletId: unknown;
  amount: unknown;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  customerNote: string | null;
  adminNote: string | null;
  bankReference: string | null;
  approvedBy: string | null;
  approvedAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveMoney(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BadRequestException(`${label} phải là số tiền nguyên dương.`);
  }
  return amount;
}

@Injectable()
export class WalletService {
  constructor(private readonly db: PrismaService) {}

  async getSummary(userId: number) {
    const wallet = await this.db.$transaction((tx) => this.lockWallet(tx, userId));
    const pendingRows = await this.db.$queryRawUnsafe<Array<{ total: unknown; count: unknown }>>(
      `SELECT COALESCE(SUM(SoTien),0) AS total, COUNT(*) AS count
       FROM YeuCauRutTien
       WHERE NguoiDungId = ? AND TrangThai IN ('pending','approved')`,
      userId,
    );
    return {
      availableBalance: toNumber(wallet.available),
      heldBalance: toNumber(wallet.held),
      totalBalance: toNumber(wallet.available) + toNumber(wallet.held),
      pendingWithdrawalAmount: toNumber(pendingRows[0]?.total),
      pendingWithdrawalCount: toNumber(pendingRows[0]?.count),
      updatedAt: wallet.updatedAt ?? wallet.createdAt,
    };
  }

  async listTransactions(userId: number, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.trunc(page));
    const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
    const offset = (safePage - 1) * safeSize;
    const rows = await this.db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT Id AS id, Loai AS type, Huong AS direction, SoTien AS amount,
              SoDuKhaDungSau AS availableAfter, SoDuTamGiuSau AS heldAfter,
              ThamChieuLoai AS referenceType, ThamChieuId AS referenceId,
              MoTa AS description, NgayTao AS createdAt
       FROM GiaoDichVi
       WHERE NguoiDungId = ?
       ORDER BY Id DESC
       LIMIT ${safeSize} OFFSET ${offset}`,
      userId,
    );
    return rows.map((row) => ({
      id: toNumber(row.id),
      type: row.type,
      direction: row.direction,
      amount: toNumber(row.amount),
      availableAfter: toNumber(row.availableAfter),
      heldAfter: toNumber(row.heldAfter),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      description: row.description,
      createdAt: row.createdAt,
    }));
  }

  async listMyWithdrawals(userId: number) {
    const rows = await this.db.$queryRawUnsafe<WithdrawalRow[]>(
      `${this.withdrawalSelect()}
       WHERE NguoiDungId = ?
       ORDER BY Id DESC
       LIMIT 100`,
      userId,
    );
    return rows.map((row) => this.mapWithdrawal(row));
  }

  async createWithdrawal(
    userId: number,
    input: {
      amount?: unknown;
      bankName?: unknown;
      accountNumber?: unknown;
      accountHolder?: unknown;
      note?: unknown;
    },
  ) {
    const amount = positiveMoney(input.amount, "Số tiền rút");
    const bankName = text(input.bankName);
    const accountNumber = text(input.accountNumber).replace(/\s+/g, "");
    const accountHolder = text(input.accountHolder);
    const note = text(input.note);

    if (bankName.length < 2 || bankName.length > 100) {
      throw new BadRequestException("Tên ngân hàng phải từ 2 đến 100 ký tự.");
    }
    if (accountNumber.length < 4 || accountNumber.length > 64) {
      throw new BadRequestException("Số tài khoản ngân hàng không hợp lệ.");
    }
    if (accountHolder.length < 2 || accountHolder.length > 150) {
      throw new BadRequestException("Tên chủ tài khoản không hợp lệ.");
    }
    if (note.length > 300) {
      throw new BadRequestException("Ghi chú rút tiền tối đa 300 ký tự.");
    }

    const id = await this.db.$transaction(async (tx) => {
      const wallet = await this.lockWallet(tx, userId);
      const available = toNumber(wallet.available);
      const held = toNumber(wallet.held);
      if (available < amount) {
        throw new BadRequestException("Số dư khả dụng không đủ để tạo yêu cầu rút tiền.");
      }

      const now = new Date();
      await tx.$executeRawUnsafe(
        `INSERT INTO YeuCauRutTien
           (NguoiDungId, ViId, SoTien, TenNganHang, SoTaiKhoan, ChuTaiKhoan,
            TrangThai, GhiChuKhach, NgayTao, NgayCapNhat)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        userId,
        toNumber(wallet.id),
        amount,
        bankName,
        accountNumber,
        accountHolder,
        note || null,
        now,
        now,
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      const withdrawalId = toNumber(ids[0]?.id);
      const nextAvailable = available - amount;
      const nextHeld = held + amount;
      await this.updateWallet(tx, wallet, nextAvailable, nextHeld, now);
      await this.insertLedger(tx, {
        walletId: toNumber(wallet.id),
        userId,
        type: "withdrawal_hold",
        direction: "debit",
        amount,
        availableAfter: nextAvailable,
        heldAfter: nextHeld,
        referenceType: "withdrawal",
        referenceId: String(withdrawalId),
        description: `Giữ ${amount.toLocaleString("vi-VN")}đ cho yêu cầu rút #${withdrawalId}`,
        at: now,
      });
      return withdrawalId;
    });

    return this.getOwnedWithdrawal(userId, id);
  }

  async listAdminWithdrawals(rawStatus?: unknown) {
    const status = text(rawStatus).toLowerCase();
    const allowed = ["pending", "approved", "completed", "rejected"];
    if (status && !allowed.includes(status)) {
      throw new BadRequestException("Trạng thái yêu cầu rút tiền không hợp lệ.");
    }
    const filter = status ? "WHERE w.TrangThai = ?" : "";
    const params = status ? [status] : [];
    const rows = await this.db.$queryRawUnsafe<Array<WithdrawalRow & { customerName: string; customerEmail: string }>>(
      `SELECT w.Id AS id, w.NguoiDungId AS userId, w.ViId AS walletId,
              w.SoTien AS amount, w.TenNganHang AS bankName,
              w.SoTaiKhoan AS accountNumber, w.ChuTaiKhoan AS accountHolder,
              w.TrangThai AS status, w.GhiChuKhach AS customerNote,
              w.GhiChuAdmin AS adminNote, w.MaThamChieuNganHang AS bankReference,
              w.NguoiDuyet AS approvedBy, w.ThoiGianDuyet AS approvedAt,
              w.ThoiGianHoanTat AS completedAt, w.NgayTao AS createdAt,
              w.NgayCapNhat AS updatedAt,
              u.HoTen AS customerName, u.Email AS customerEmail
       FROM YeuCauRutTien w
       JOIN NguoiDung u ON u.Id = w.NguoiDungId
       ${filter}
       ORDER BY CASE w.TrangThai WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                w.Id DESC
       LIMIT 300`,
      ...params,
    );
    return rows.map((row) => ({
      ...this.mapWithdrawal(row),
      customerName: row.customerName,
      customerEmail: row.customerEmail,
    }));
  }

  async approveWithdrawal(withdrawalId: number, staff: string, rawNote?: unknown) {
    const note = text(rawNote);
    if (note.length > 500) throw new BadRequestException("Ghi chú tối đa 500 ký tự.");
    await this.db.$transaction(async (tx) => {
      const row = await this.lockWithdrawal(tx, withdrawalId);
      if (row.status === "approved") return;
      if (row.status !== "pending") {
        throw new BadRequestException("Chỉ yêu cầu đang chờ mới có thể được duyệt.");
      }
      const now = new Date();
      await tx.$executeRawUnsafe(
        `UPDATE YeuCauRutTien
         SET TrangThai = 'approved', GhiChuAdmin = ?, NguoiDuyet = ?,
             ThoiGianDuyet = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        note || null,
        staff,
        now,
        now,
        withdrawalId,
      );
    });
    return this.getAdminWithdrawal(withdrawalId);
  }

  async rejectWithdrawal(withdrawalId: number, staff: string, rawReason: unknown) {
    const reason = text(rawReason);
    if (reason.length < 3 || reason.length > 500) {
      throw new BadRequestException("Lý do từ chối phải từ 3 đến 500 ký tự.");
    }

    await this.db.$transaction(async (tx) => {
      const row = await this.lockWithdrawal(tx, withdrawalId);
      if (row.status === "rejected") return;
      if (!(WITHDRAWAL_ACTIVE as readonly string[]).includes(row.status)) {
        throw new BadRequestException("Yêu cầu này không còn ở trạng thái có thể từ chối.");
      }
      const wallet = await this.lockWallet(tx, toNumber(row.userId));
      const amount = toNumber(row.amount);
      const available = toNumber(wallet.available);
      const held = toNumber(wallet.held);
      if (held < amount) {
        throw new BadRequestException("Số dư tạm giữ không khớp yêu cầu rút tiền.");
      }
      const now = new Date();
      const nextAvailable = available + amount;
      const nextHeld = held - amount;
      await this.updateWallet(tx, wallet, nextAvailable, nextHeld, now);
      await this.insertLedger(tx, {
        walletId: toNumber(wallet.id),
        userId: toNumber(row.userId),
        type: "withdrawal_released",
        direction: "credit",
        amount,
        availableAfter: nextAvailable,
        heldAfter: nextHeld,
        referenceType: "withdrawal",
        referenceId: String(withdrawalId),
        description: `Yêu cầu rút #${withdrawalId} bị từ chối; tiền đã trả về số dư khả dụng`,
        at: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE YeuCauRutTien
         SET TrangThai = 'rejected', GhiChuAdmin = ?, NguoiDuyet = ?,
             NgayCapNhat = ?
         WHERE Id = ?`,
        reason,
        staff,
        now,
        withdrawalId,
      );
    });
    return this.getAdminWithdrawal(withdrawalId);
  }

  async completeWithdrawal(
    withdrawalId: number,
    staff: string,
    rawReference: unknown,
    rawNote?: unknown,
  ) {
    const reference = text(rawReference);
    const note = text(rawNote);
    if (reference.length < 3 || reference.length > 100) {
      throw new BadRequestException("Mã giao dịch ngân hàng phải từ 3 đến 100 ký tự.");
    }
    if (note.length > 500) throw new BadRequestException("Ghi chú tối đa 500 ký tự.");

    await this.db.$transaction(async (tx) => {
      const row = await this.lockWithdrawal(tx, withdrawalId);
      if (row.status === "completed") return;
      if (row.status !== "approved") {
        throw new BadRequestException("Yêu cầu rút tiền phải được duyệt trước khi xác nhận đã chuyển khoản.");
      }
      const wallet = await this.lockWallet(tx, toNumber(row.userId));
      const amount = toNumber(row.amount);
      const available = toNumber(wallet.available);
      const held = toNumber(wallet.held);
      if (held < amount) {
        throw new BadRequestException("Số dư tạm giữ không khớp yêu cầu rút tiền.");
      }
      const now = new Date();
      const nextHeld = held - amount;
      await this.updateWallet(tx, wallet, available, nextHeld, now);
      await this.insertLedger(tx, {
        walletId: toNumber(wallet.id),
        userId: toNumber(row.userId),
        type: "withdrawal_completed",
        direction: "debit",
        amount,
        availableAfter: available,
        heldAfter: nextHeld,
        referenceType: "withdrawal",
        referenceId: String(withdrawalId),
        description: `Đã chuyển khoản yêu cầu rút #${withdrawalId}. Mã giao dịch: ${reference}`,
        at: now,
      });
      await tx.$executeRawUnsafe(
        `UPDATE YeuCauRutTien
         SET TrangThai = 'completed', GhiChuAdmin = ?, MaThamChieuNganHang = ?,
             NguoiDuyet = COALESCE(NguoiDuyet, ?), ThoiGianHoanTat = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        note || null,
        reference,
        staff,
        now,
        now,
        withdrawalId,
      );
    });
    return this.getAdminWithdrawal(withdrawalId);
  }

  async debitOrderInTransaction(
    tx: SqlClient,
    userId: number,
    orderId: number,
    orderCode: string,
    total: number,
    useWallet: boolean,
  ): Promise<number> {
    if (!useWallet || total <= 0) return 0;
    const existed = await this.findLedger(tx, userId, "order_payment", "order", String(orderId));
    if (existed) return toNumber(existed.amount);

    const wallet = await this.lockWallet(tx, userId);
    const available = toNumber(wallet.available);
    const held = toNumber(wallet.held);
    const amount = Math.min(available, Math.max(0, Math.round(total)));
    if (amount <= 0) return 0;
    const now = new Date();
    const nextAvailable = available - amount;
    await this.updateWallet(tx, wallet, nextAvailable, held, now);
    await this.insertLedger(tx, {
      walletId: toNumber(wallet.id),
      userId,
      type: "order_payment",
      direction: "debit",
      amount,
      availableAfter: nextAvailable,
      heldAfter: held,
      referenceType: "order",
      referenceId: String(orderId),
      description: `Dùng số dư Ví KaitoKid thanh toán đơn ${orderCode}`,
      at: now,
    });
    return amount;
  }

  async restoreOrderDebitInTransaction(
    tx: SqlClient,
    userId: number,
    orderId: number,
    orderCode: string,
  ): Promise<number> {
    const paid = await this.findLedger(tx, userId, "order_payment", "order", String(orderId));
    if (!paid) return 0;
    const reversal = await this.findLedger(
      tx,
      userId,
      "order_payment_reversal",
      "order",
      String(orderId),
    );
    if (reversal) return 0;

    const wallet = await this.lockWallet(tx, userId);
    const amount = toNumber(paid.amount);
    const available = toNumber(wallet.available);
    const held = toNumber(wallet.held);
    const nextAvailable = available + amount;
    const now = new Date();
    await this.updateWallet(tx, wallet, nextAvailable, held, now);
    await this.insertLedger(tx, {
      walletId: toNumber(wallet.id),
      userId,
      type: "order_payment_reversal",
      direction: "credit",
      amount,
      availableAfter: nextAvailable,
      heldAfter: held,
      referenceType: "order",
      referenceId: String(orderId),
      description: `Hoàn lại số dư Ví KaitoKid do đơn ${orderCode} bị hủy/hết hạn`,
      at: now,
    });
    return amount;
  }

  async refundOrderInTransaction(
    tx: SqlClient,
    userId: number,
    orderId: number,
    orderCode: string,
    amount: number,
  ): Promise<boolean> {
    const normalizedAmount = Math.max(0, Math.round(amount));
    if (normalizedAmount <= 0) return false;
    const existed = await this.findLedger(tx, userId, "refund_credit", "order", String(orderId));
    if (existed) return false;

    const wallet = await this.lockWallet(tx, userId);
    const available = toNumber(wallet.available);
    const held = toNumber(wallet.held);
    const nextAvailable = available + normalizedAmount;
    const now = new Date();
    await this.updateWallet(tx, wallet, nextAvailable, held, now);
    await this.insertLedger(tx, {
      walletId: toNumber(wallet.id),
      userId,
      type: "refund_credit",
      direction: "credit",
      amount: normalizedAmount,
      availableAfter: nextAvailable,
      heldAfter: held,
      referenceType: "order",
      referenceId: String(orderId),
      description: `Hoàn tiền đơn ${orderCode} vào Ví KaitoKid`,
      at: now,
    });
    return true;
  }

  async walletUsedForOrder(orderId: number): Promise<number> {
    const rows = await this.db.$queryRawUnsafe<Array<{ amount: unknown }>>(
      `SELECT COALESCE(SUM(
                CASE
                  WHEN Loai = 'order_payment' THEN SoTien
                  WHEN Loai = 'order_payment_reversal' THEN -SoTien
                  ELSE 0
                END
              ), 0) AS amount
       FROM GiaoDichVi
       WHERE ThamChieuLoai = 'order' AND ThamChieuId = ?
         AND Loai IN ('order_payment','order_payment_reversal')`,
      String(orderId),
    );
    return Math.max(0, toNumber(rows[0]?.amount));
  }

  async walletUsedForOrderWithClient(tx: SqlClient, orderId: number): Promise<number> {
    const rows = await tx.$queryRawUnsafe<Array<{ amount: unknown }>>(
      `SELECT COALESCE(SUM(
                CASE
                  WHEN Loai = 'order_payment' THEN SoTien
                  WHEN Loai = 'order_payment_reversal' THEN -SoTien
                  ELSE 0
                END
              ), 0) AS amount
       FROM GiaoDichVi
       WHERE ThamChieuLoai = 'order' AND ThamChieuId = ?
         AND Loai IN ('order_payment','order_payment_reversal')`,
      String(orderId),
    );
    return Math.max(0, toNumber(rows[0]?.amount));
  }

  async assertAccountCanCloseInTransaction(tx: SqlClient, userId: number): Promise<void> {
    const wallets = await tx.$queryRawUnsafe<Array<{ available: unknown; held: unknown }>>(
      `SELECT SoDuKhaDung AS available, SoDuTamGiu AS held
       FROM ViDienTu WHERE NguoiDungId = ? LIMIT 1 FOR UPDATE`,
      userId,
    );
    const available = toNumber(wallets[0]?.available);
    const held = toNumber(wallets[0]?.held);
    const active = await tx.$queryRawUnsafe<Array<{ count: unknown }>>(
      `SELECT COUNT(*) AS count FROM YeuCauRutTien
       WHERE NguoiDungId = ? AND TrangThai IN ('pending','approved')`,
      userId,
    );
    if (available > 0 || held > 0 || toNumber(active[0]?.count) > 0) {
      throw new BadRequestException(
        "Không thể hủy tài khoản khi Ví KaitoKid còn số dư hoặc có yêu cầu rút tiền đang xử lý.",
      );
    }
  }

  private async getOwnedWithdrawal(userId: number, id: number) {
    const rows = await this.db.$queryRawUnsafe<WithdrawalRow[]>(
      `${this.withdrawalSelect()} WHERE Id = ? AND NguoiDungId = ? LIMIT 1`,
      id,
      userId,
    );
    if (!rows[0]) throw new NotFoundException("Yêu cầu rút tiền không tồn tại.");
    return this.mapWithdrawal(rows[0]);
  }

  private async getAdminWithdrawal(id: number) {
    const rows = await this.db.$queryRawUnsafe<WithdrawalRow[]>(
      `${this.withdrawalSelect()} WHERE Id = ? LIMIT 1`,
      id,
    );
    if (!rows[0]) throw new NotFoundException("Yêu cầu rút tiền không tồn tại.");
    return this.mapWithdrawal(rows[0]);
  }

  private async lockWithdrawal(tx: SqlClient, id: number): Promise<WithdrawalRow> {
    const rows = await tx.$queryRawUnsafe<WithdrawalRow[]>(
      `${this.withdrawalSelect()} WHERE Id = ? LIMIT 1 FOR UPDATE`,
      id,
    );
    if (!rows[0]) throw new NotFoundException("Yêu cầu rút tiền không tồn tại.");
    return rows[0];
  }

  private async lockWallet(tx: SqlClient, userId: number): Promise<WalletRow> {
    await tx.$executeRawUnsafe(
      `INSERT IGNORE INTO ViDienTu
         (NguoiDungId, SoDuKhaDung, SoDuTamGiu, NgayTao)
       VALUES (?, 0, 0, ?)`,
      userId,
      new Date(),
    );
    const rows = await tx.$queryRawUnsafe<WalletRow[]>(
      `SELECT Id AS id, NguoiDungId AS userId,
              SoDuKhaDung AS available, SoDuTamGiu AS held,
              NgayTao AS createdAt, NgayCapNhat AS updatedAt
       FROM ViDienTu
       WHERE NguoiDungId = ?
       LIMIT 1 FOR UPDATE`,
      userId,
    );
    if (!rows[0]) throw new BadRequestException("Không thể khởi tạo Ví KaitoKid.");
    return rows[0];
  }

  private updateWallet(
    tx: SqlClient,
    wallet: WalletRow,
    available: number,
    held: number,
    at: Date,
  ) {
    if (available < 0 || held < 0) {
      throw new BadRequestException("Số dư ví không hợp lệ.");
    }
    return tx.$executeRawUnsafe(
      `UPDATE ViDienTu
       SET SoDuKhaDung = ?, SoDuTamGiu = ?, NgayCapNhat = ?
       WHERE Id = ?`,
      available,
      held,
      at,
      toNumber(wallet.id),
    );
  }

  private async findLedger(
    tx: SqlClient,
    userId: number,
    type: string,
    referenceType: string,
    referenceId: string,
  ): Promise<{ amount: unknown } | null> {
    const rows = await tx.$queryRawUnsafe<Array<{ amount: unknown }>>(
      `SELECT SoTien AS amount
       FROM GiaoDichVi
       WHERE NguoiDungId = ? AND Loai = ? AND ThamChieuLoai = ? AND ThamChieuId = ?
       LIMIT 1`,
      userId,
      type,
      referenceType,
      referenceId,
    );
    return rows[0] ?? null;
  }

  private insertLedger(
    tx: SqlClient,
    input: {
      walletId: number;
      userId: number;
      type: string;
      direction: "credit" | "debit";
      amount: number;
      availableAfter: number;
      heldAfter: number;
      referenceType: string;
      referenceId: string;
      description: string;
      at: Date;
    },
  ) {
    return tx.$executeRawUnsafe(
      `INSERT INTO GiaoDichVi
         (ViId, NguoiDungId, Loai, Huong, SoTien,
          SoDuKhaDungSau, SoDuTamGiuSau,
          ThamChieuLoai, ThamChieuId, MoTa, NgayTao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.walletId,
      input.userId,
      input.type,
      input.direction,
      input.amount,
      input.availableAfter,
      input.heldAfter,
      input.referenceType,
      input.referenceId,
      input.description,
      input.at,
    );
  }

  private withdrawalSelect() {
    return `SELECT Id AS id, NguoiDungId AS userId, ViId AS walletId,
      SoTien AS amount, TenNganHang AS bankName, SoTaiKhoan AS accountNumber,
      ChuTaiKhoan AS accountHolder, TrangThai AS status,
      GhiChuKhach AS customerNote, GhiChuAdmin AS adminNote,
      MaThamChieuNganHang AS bankReference, NguoiDuyet AS approvedBy,
      ThoiGianDuyet AS approvedAt, ThoiGianHoanTat AS completedAt,
      NgayTao AS createdAt, NgayCapNhat AS updatedAt
    FROM YeuCauRutTien`;
  }

  private mapWithdrawal(row: WithdrawalRow) {
    return {
      id: toNumber(row.id),
      amount: toNumber(row.amount),
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      accountHolder: row.accountHolder,
      status: row.status,
      customerNote: row.customerNote,
      adminNote: row.adminNote,
      bankReference: row.bankReference,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
