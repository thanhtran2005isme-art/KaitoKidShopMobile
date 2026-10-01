import { Injectable } from "@nestjs/common";
import { toBoolean, toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import {
  parseUserAgent,
  type LoginRequestMeta,
} from "./user-agent.js";

interface ActivityRow {
  id: unknown;
  provider: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  success: unknown;
  failReason: string | null;
  createdAt: Date | string;
}

@Injectable()
export class LoginActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: number | null | undefined,
    email: string | undefined,
    provider: string,
    success: boolean,
    failReason: string | null | undefined,
    meta?: LoginRequestMeta,
  ): Promise<void> {
    const parsed = parseUserAgent(meta?.userAgent);
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO LoginActivity
           (UserId, Email, Provider, Ip, UserAgent, DeviceType,
            Browser, Os, Success, FailReason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userId ?? null,
        email ?? "",
        provider,
        meta?.ip ?? null,
        meta?.userAgent ?? null,
        parsed.deviceType,
        parsed.browser,
        parsed.os,
        success ? 1 : 0,
        failReason ?? null,
      );
    } catch {
      // Logging không được block auth flow.
    }
  }

  async getByUser(userId: number, take = 50) {
    const safeTake = Math.max(1, Math.min(100, take));
    const rows = await this.prisma.$queryRawUnsafe<ActivityRow[]>(
      `SELECT
         Id AS id, Provider AS provider, Ip AS ip,
         Browser AS browser, Os AS os, DeviceType AS deviceType,
         Success AS success, FailReason AS failReason,
         CreatedAt AS createdAt
       FROM LoginActivity
       WHERE UserId = ?
       ORDER BY CreatedAt DESC
       LIMIT ${safeTake}`,
      userId,
    );

    return rows.map((row) => ({
      id: toNumber(row.id),
      provider: row.provider,
      ip: row.ip,
      browser: row.browser,
      os: row.os,
      deviceType: row.deviceType,
      success: toBoolean(row.success),
      failReason: row.failReason,
      createdAt: row.createdAt,
    }));
  }
}
