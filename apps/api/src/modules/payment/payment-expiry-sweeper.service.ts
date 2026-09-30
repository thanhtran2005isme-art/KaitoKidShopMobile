import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PaymentService } from "./payment.service.js";

@Injectable()
export class PaymentExpirySweeperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentExpirySweeperService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly payment: PaymentService) {}

  onModuleInit(): void {
    if (!this.enabled()) {
      this.logger.log(
        "Payment expiry sweeper disabled during C#/Node coexistence. Enable only after the C# sweeper is stopped.",
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

  private enabled(): boolean {
    return /^(1|true|yes)$/i.test(
      process.env.PAYMENT_SWEEPER_ENABLED ?? "false",
    );
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
