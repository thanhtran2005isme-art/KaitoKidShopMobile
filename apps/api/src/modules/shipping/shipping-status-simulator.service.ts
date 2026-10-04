import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { toNumber } from "../../common/db-value.js";
import { backgroundWorkerOwner, nodeWorkerEnabled } from "../../common/worker-owner.js";
import { PrismaService } from "../../database/prisma.service.js";

export interface ShippingSimulationStep {
  next: string;
  description: string;
  location: string;
}

export const SHIPPING_SIMULATION_FLOW: Readonly<Record<string, ShippingSimulationStep>> = {
  ready_to_pick: {
    next: "picking",
    description: "Shipper đang đến lấy hàng tại kho",
    location: "Kho KaitoKid",
  },
  picking: {
    next: "picked",
    description: "Đã lấy hàng từ shop",
    location: "Kho trung chuyển",
  },
  picked: {
    next: "delivering",
    description: "Đang vận chuyển đến địa chỉ giao",
    location: "Trên đường giao",
  },
  delivering: {
    next: "delivered",
    description: "Giao hàng thành công",
    location: "Địa chỉ khách",
  },
};

export function nextShippingSimulationStep(
  status: string | null | undefined,
): ShippingSimulationStep | null {
  if (!status) return null;
  return SHIPPING_SIMULATION_FLOW[status] ?? null;
}

function orderStatusForShippingStep(
  shippingStatus: string,
  currentOrderStatus: string,
): string {
  if (shippingStatus === "picking" || shippingStatus === "picked") {
    return "confirmed";
  }
  if (shippingStatus === "delivering") return "shipping";
  if (shippingStatus === "delivered") return "completed";
  return currentOrderStatus;
}

interface CandidateRow {
  id: unknown;
}

interface LockedOrderRow {
  id: unknown;
  shippingStatus: string | null;
  orderStatus: string;
  lastTime: Date | string;
}

@Injectable()
export class ShippingStatusSimulatorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ShippingStatusSimulatorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (!nodeWorkerEnabled(
      "SHIPPING_SIMULATOR_ENABLED",
      "Shipping__Simulator__Enabled",
    )) {
      this.logger.log(
        `Shipping simulator disabled. Background worker owner=${backgroundWorkerOwner()}.`,
      );
      return;
    }

    const seconds = this.intervalSeconds();
    void this.tickSafely();
    this.timer = setInterval(() => void this.tickSafely(), seconds * 1000);
    this.timer.unref();
    this.logger.log(
      `ShippingStatusSimulator started. Step=${this.stepMinutes()}m Interval=${seconds}s`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private intervalSeconds(): number {
    const raw =
      process.env.SHIPPING_SIMULATOR_INTERVAL_SECONDS ??
      process.env.Shipping__Simulator__IntervalSeconds ??
      "30";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30;
  }

  private stepMinutes(): number {
    const raw =
      process.env.SHIPPING_SIMULATOR_STEP_MINUTES ??
      process.env.Shipping__Simulator__StepMinutes ??
      "1";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
  }

  private async tickSafely(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const advanced = await this.tick();
      if (advanced > 0) {
        this.logger.log(`Advanced ${advanced} order(s) along shipping flow`);
      }
    } catch (error) {
      this.logger.error(
        "ShippingStatusSimulator tick failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async tick(): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<CandidateRow[]>(
      `SELECT Id AS id
       FROM DonHang
       WHERE TrangThaiVanChuyen IN ('ready_to_pick','picking','picked','delivering')
         AND TrangThai <> 'cancelled'
         AND LOWER(COALESCE(NhaVanChuyen,'mock')) <> 'lalamove'`,
    );
    if (!rows.length) return 0;

    const threshold = new Date(Date.now() - this.stepMinutes() * 60_000);
    let advanced = 0;

    for (const candidate of rows) {
      advanced += await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRawUnsafe<LockedOrderRow[]>(
          `SELECT Id AS id,
                  TrangThaiVanChuyen AS shippingStatus,
                  TrangThai AS orderStatus,
                  COALESCE(NgayCapNhat, NgayTao) AS lastTime
           FROM DonHang
           WHERE Id = ? AND TrangThai <> 'cancelled'
             AND LOWER(COALESCE(NhaVanChuyen,'mock')) <> 'lalamove'
           LIMIT 1
           FOR UPDATE`,
          toNumber(candidate.id),
        );
        const order = locked[0];
        if (!order) return 0;
        if (new Date(order.lastTime).getTime() > threshold.getTime()) return 0;

        const step = nextShippingSimulationStep(order.shippingStatus);
        if (!step) return 0;

        const now = new Date();
        const nextOrderStatus = orderStatusForShippingStep(
          step.next,
          order.orderStatus,
        );

        await tx.$executeRawUnsafe(
          `UPDATE DonHang
           SET TrangThaiVanChuyen = ?, TrangThai = ?, NgayCapNhat = ?
           WHERE Id = ?`,
          step.next,
          nextOrderStatus,
          now,
          toNumber(order.id),
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO LichSuTrangThaiVanChuyen
             (DonHangId, TrangThai, MoTa, ViTri, ThoiGian)
           VALUES (?, ?, ?, ?, ?)`,
          toNumber(order.id),
          step.next,
          step.description,
          step.location,
          now,
        );
        return 1;
      });
    }
    return advanced;
  }
}
