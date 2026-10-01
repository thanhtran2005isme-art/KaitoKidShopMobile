import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { backgroundWorkerOwner, nodeWorkerEnabled } from "../../common/worker-owner.js";
import { CartService } from "./cart.service.js";

@Injectable()
export class CartReservationSweeperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CartReservationSweeperService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly cart: CartService) {}

  onModuleInit(): void {
    if (!nodeWorkerEnabled(
      "CART_SWEEPER_ENABLED",
      "Cart__SweeperEnabled",
    )) {
      this.logger.log(
        `Cart reservation sweeper disabled. Background worker owner=${backgroundWorkerOwner()}.`,
      );
      return;
    }

    const intervalSeconds = this.intervalSeconds();
    void this.sweepSafely();
    this.timer = setInterval(() => {
      void this.sweepSafely();
    }, intervalSeconds * 1000);
    this.timer.unref();
    this.logger.log(`Cart reservation sweeper started. Interval=${intervalSeconds}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private intervalSeconds(): number {
    const raw =
      process.env.CART_SWEEP_INTERVAL_SECONDS ??
      process.env.Cart__SweepIntervalSeconds ??
      "60";
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60;
  }

  private async sweepSafely(): Promise<void> {
    try {
      const released = await this.cart.sweepExpiredReservations();
      if (released > 0) {
        this.logger.log(`Released ${released} expired cart reservation(s)`);
      }
    } catch (error) {
      this.logger.error(
        "Cart reservation sweep failed",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
