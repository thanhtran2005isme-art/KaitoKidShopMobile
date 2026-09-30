import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";

const FLOW: Record<
  string,
  { next: string; description: string; location: string; orderStatus?: string }
> = {
  ready_to_pick: {
    next: "picking",
    description: "Shipper đang đến lấy hàng tại kho",
    location: "Kho KaitoKid",
  },
  picking: {
    next: "picked",
    description: "Đã lấy hàng từ shop",
    location: "Kho trung chuyển",
    orderStatus: "confirmed",
  },
  picked: {
    next: "delivering",
    description: "Đang vận chuyển đến địa chỉ giao",
    location: "Trên đường giao",
    orderStatus: "shipping",
  },
  delivering: {
    next: "delivered",
    description: "Giao hàng thành công",
    location: "Địa chỉ khách",
    orderStatus: "completed",
  },
};

interface ShippingRow {
  id: unknown;
  status: string;
  orderStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

@Injectable()
export class ShippingStatusSimulatorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ShippingStatusSimulatorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!/^(1|true|yes)$/i.test(
      process.env.SHIPPING_SIMULATOR_ENABLED ?? "false",
    )) {
      this.logger.log(
        "Shipping simulator disabled during C#/Node coexistence.",
      );
      return;
    }
    const interval = Math.max(
      5,
      Number(process.env.SHIPPING_SIMULATOR_INTERVAL_SECONDS ?? 30) || 30,
    );
    this.timer = setInterval(() => void this.tick(), interval * 1000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const stepRaw = Number(
        process.env.SHIPPING_SIMULATOR_STEP_MINUTES ?? 1,
      );
      const stepMinutes =
        Number.isFinite(stepRaw) && stepRaw >= 0 ? stepRaw : 1;
      const threshold = new Date(Date.now() - stepMinutes * 60_000);
      const statuses = Object.keys(FLOW);
      const marks = statuses.map(() => "?").join(",");
      const rows = await this.prisma.$queryRawUnsafe<ShippingRow[]>(
        `SELECT Id AS id, TrangThaiVanChuyen AS status,
                TrangThai AS orderStatus, NgayTao AS createdAt,
                NgayCapNhat AS updatedAt
         FROM DonHang
         WHERE TrangThaiVanChuyen IN (${marks})
           AND TrangThai <> 'cancelled'
         ORDER BY Id`,
        ...statuses,
      );

      let advanced = 0;
      for (const row of rows) {
        const last = new Date(row.updatedAt ?? row.createdAt);
        if (last > threshold) continue;
        const step = FLOW[row.status];
        if (!step) continue;

        const changed = await this.prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRawUnsafe<Array<{
            status: string | null;
            orderStatus: string;
            createdAt: Date | string;
            updatedAt: Date | string | null;
          }>>(
            `SELECT TrangThaiVanChuyen AS status,
                    TrangThai AS orderStatus,
                    NgayTao AS createdAt, NgayCapNhat AS updatedAt
             FROM DonHang
             WHERE Id = ?
             LIMIT 1
             FOR UPDATE`,
            Number(row.id),
          );
          const current = locked[0];
          if (!current || current.status !== row.status || current.orderStatus === "cancelled") {
            return false;
          }
          const currentLast = new Date(current.updatedAt ?? current.createdAt);
          if (currentLast > threshold) return false;

          const now = new Date();
          await tx.$executeRawUnsafe(
            `UPDATE DonHang
             SET TrangThaiVanChuyen = ?,
                 TrangThai = ?,
                 NgayCapNhat = ?
             WHERE Id = ?`,
            step.next,
            step.orderStatus ?? current.orderStatus,
            now,
            Number(row.id),
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO LichSuTrangThaiVanChuyen
               (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
             VALUES (?, ?, ?, ?, ?)`,
            Number(row.id),
            step.next,
            step.description,
            step.location,
            now,
          );
          return true;
        });
        if (changed) advanced += 1;
      }

      if (advanced > 0) {
        this.logger.log(`Advanced ${advanced} order(s) along shipping flow.`);
      }
      return advanced;
    } catch (error) {
      this.logger.error(
        "Shipping simulator tick failed",
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
