import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ChatService } from "./chat.service.js";

@Injectable()
export class ChatIdleSweeperService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatIdleSweeperService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly chat: ChatService) {}

  onModuleInit() {
    if (!/^(1|true|yes)$/i.test(
      process.env.CHAT_IDLE_SWEEPER_ENABLED ?? "false",
    )) {
      return;
    }
    const interval = Math.max(
      30,
      Number(process.env.CHAT_SWEEP_INTERVAL_SECONDS ?? 120),
    );
    this.timer = setInterval(
      () => void this.tick(),
      interval * 1000,
    );
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const idle = Math.max(
        1,
        Number(process.env.CHAT_IDLE_MINUTES ?? 30),
      );
      const count = await this.chat.sweepIdle(idle);
      if (count > 0) {
        this.logger.log(
          `Auto-closed ${count} idle chat conversations`,
        );
      }
    } catch (error) {
      this.logger.error(
        "Chat idle sweep failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
