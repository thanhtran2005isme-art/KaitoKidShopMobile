import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { toNumber } from "../../common/db-value.js";

@Injectable()
export class ChatIdleSweeperService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ChatIdleSweeperService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    if (
      !/^(1|true|yes)$/i.test(
        process.env.CHAT_SWEEPER_ENABLED ?? "false",
      )
    ) {
      this.logger.log(
        "Chat idle sweeper disabled trong coexistence với C#.",
      );
      return;
    }

    const seconds = Math.max(
      30,
      Number(process.env.CHAT_SWEEP_INTERVAL_SECONDS ?? 120),
    );
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), seconds * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const idleMinutes = Math.max(
        1,
        Number(process.env.CHAT_IDLE_MINUTES ?? 30),
      );
      const threshold = new Date(Date.now() - idleMinutes * 60_000);
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: unknown }>
      >(
        "SELECT Id AS id FROM CuocHoiThoai WHERE TrangThai IN ('waiting','agent') AND ThoiGianTinCuoi < ? ORDER BY Id LIMIT 200",
        threshold,
      );
      let closed = 0;

      for (const row of rows) {
        const id = toNumber(row.id);
        const changed = await this.prisma.$transaction(async (tx) => {
          const current = await tx.$queryRawUnsafe<
            Array<{ status: string; lastAt: Date | string }>
          >(
            "SELECT TrangThai AS status, ThoiGianTinCuoi AS lastAt FROM CuocHoiThoai WHERE Id = ? LIMIT 1 FOR UPDATE",
            id,
          );
          const item = current[0];
          if (
            !item ||
            !["waiting", "agent"].includes(item.status) ||
            new Date(item.lastAt).getTime() >= threshold.getTime()
          ) {
            return false;
          }

          const now = new Date();
          const text =
            "Hội thoại được tạm đóng do không có hoạt động. Bạn nhắn tiếp bất cứ lúc nào để mở lại nhé!";
          await tx.$executeRawUnsafe(
            "INSERT INTO TinNhan (CuocHoiThoaiId, LoaiNguoiGui, NguoiGuiId, NoiDung, DaDoc, NgayTao) VALUES (?, 'bot', NULL, ?, 0, ?)",
            id,
            text,
            now,
          );
          await tx.$executeRawUnsafe(
            "UPDATE CuocHoiThoai SET TrangThai = 'closed', TinNhanCuoi = ?, ThoiGianTinCuoi = ?, NgayCapNhat = ? WHERE Id = ?",
            text.slice(0, 200),
            now,
            now,
            id,
          );
          return true;
        });
        if (changed) closed += 1;
      }

      if (closed > 0) {
        this.logger.log(
          "ChatIdleSweeper auto-closed " + closed + " conversations.",
        );
      }
    } catch (error) {
      this.logger.error(
        "Chat idle sweeper tick failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
