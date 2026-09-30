import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

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

@Injectable()
export class ShippingStatusSimulatorService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ShippingStatusSimulatorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    if (
      !/^(1|true|yes)$/i.test(
        process.env.SHIPPING_SIMULATOR_ENABLED ?? "false",
      )
    ) {
      this.logger.log(
        "Shipping simulator disabled trong coexistence với C#.",
      );
      return;
    }

    const seconds = Math.max(
      5,
      Number(process.env.SHIPPING_SIMULATOR_INTERVAL_SECONDS ?? 30),
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const stepMinutes = Math.max(
        0,
        Number(process.env.SHIPPING_SIMULATOR_STEP_MINUTES ?? 1),
      );
      const threshold = new Date(Date.now() - stepMinutes * 60_000);
      const statuses = Object.keys(FLOW);
      const marks = statuses.map(() => "?").join(",");
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: unknown }>
      >(
        "SELECT Id AS id FROM DonHang WHERE TrangThaiVanChuyen IN (" +
          marks +
          ") AND TrangThai <> 'cancelled' ORDER BY Id LIMIT 200",
        ...statuses,
      );

      let advanced = 0;
      for (const row of rows) {
        const id = toNumber(row.id);
        const changed = await this.prisma.$transaction(async (tx) => {
          const current = await tx.$queryRawUnsafe<
            Array<{
              shippingStatus: string | null;
              orderStatus: string;
              updatedAt: Date | string | null;
              createdAt: Date | string;
            }>
          >(
            "SELECT TrangThaiVanChuyen AS shippingStatus, TrangThai AS orderStatus, NgayCapNhat AS updatedAt, NgayTao AS createdAt FROM DonHang WHERE Id = ? LIMIT 1 FOR UPDATE",
            id,
          );
          const order = current[0];
          if (!order || !order.shippingStatus || order.orderStatus === "cancelled") {
            return false;
          }

          const step = FLOW[order.shippingStatus];
          if (!step) return false;

          const last = new Date(order.updatedAt ?? order.createdAt);
          if (last.getTime() > threshold.getTime()) return false;

          const now = new Date();
          await tx.$executeRawUnsafe(
            "UPDATE DonHang SET TrangThaiVanChuyen = ?, TrangThai = ?, NgayCapNhat = ? WHERE Id = ?",
            step.next,
            step.orderStatus ?? order.orderStatus,
            now,
            id,
          );
          await tx.$executeRawUnsafe(
            "INSERT INTO LichSuTrangThaiVanChuyen (DonHangId, TrangThai, MoTa, ViTri, ThoiGian) VALUES (?, ?, ?, ?, ?)",
            id,
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
        this.logger.log("Shipping simulator advanced " + advanced + " orders.");
      }
    } catch (error) {
      this.logger.error(
        "Shipping simulator tick failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
