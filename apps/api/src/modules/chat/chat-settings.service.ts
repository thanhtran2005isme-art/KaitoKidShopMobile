import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";

export interface ChatSettings {
  llmEnabled: boolean;
  apiKey: string | null;
  endpoint: string | null;
  model: string;
  maxBotFailBeforeHandoff: number;
}

@Injectable()
export class ChatSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ChatSettings> {
    let rows: Array<{ code: string; value: string }> = [];
    try {
      rows = await this.prisma.$queryRawUnsafe(
        `SELECT MaCauHinh AS code, GiaTri AS value
         FROM CauHinhCuaHang
         WHERE NhomCauHinh = 'chatbot'`,
      );
    } catch {
      rows = [];
    }
    const map = new Map(rows.map((r) => [r.code, r.value]));
    const get = (key: string, fallback?: string) =>
      map.get(key)?.trim() || fallback || null;

    const apiKey = get("chatLlmApiKey", process.env.CHAT_LLM_API_KEY);
    const endpoint = get(
      "chatLlmEndpoint",
      process.env.CHAT_LLM_ENDPOINT,
    );
    const model =
      get("chatLlmModel", process.env.CHAT_LLM_MODEL) ??
      "gemini-2.0-flash";
    const enabledRaw = map.get("chatLlmEnabled");
    const llmEnabled =
      enabledRaw === undefined
        ? Boolean(apiKey)
        : /^true$/i.test(enabledRaw);
    const maxFail = Number(
      process.env.CHAT_MAX_BOT_FAIL_BEFORE_HANDOFF ?? 2,
    );

    return {
      llmEnabled,
      apiKey,
      endpoint,
      model,
      maxBotFailBeforeHandoff:
        Number.isFinite(maxFail) && maxFail > 0 ? Math.floor(maxFail) : 2,
    };
  }
}
