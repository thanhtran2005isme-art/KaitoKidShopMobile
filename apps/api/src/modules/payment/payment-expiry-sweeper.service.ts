import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { backgroundWorkerOwner, nodeWorkerEnabled } from "../../common/worker-owner.js";
import { PaymentService } from "./payment.service.js";

@Injectable()
export class PaymentExpirySweeperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentExpirySweeperService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly payment: PaymentService) {}

  onModuleInit(): void {
    if (!nodeWorkerEnabled("PAYMENT_SWEEPER_ENABLED")) {
      this.logger.log(
        `Payment expiry sweeper disabled. Background worker owner=${backgroundWorkerOwner()}.`,
      );
      return;
    }

    const seconds = this.intervalSeconds();
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), seconds * 1000);
    this.timer.unref();
    this.logger.log(`Payment expiry sweeper started. Interval=${seconds}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private intervalSeconds(): number {
    const parsed = Number(process.env.PAYMENT_SWEEP_INTERVAL_SECONDS ?? 30);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30;
  }

  private async sweep(): Promise<void> {
    try {
      const count = await this.payment.sweepExpiredPayments();
      if (count > 0) {
        this.logger.log(`Auto-cancelled ${count} expired payment(s)`);
      }
    } catch (error) {
      this.logger.error(
        "Payment expiry sweep failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
