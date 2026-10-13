import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export interface LalamoveRequestConfig {
  baseUrl: string;
  market: string;
  apiKey: string;
  apiSecret: string;
}

type LalamoveHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function lalamoveSignature(
  apiSecret: string,
  timestamp: string,
  method: LalamoveHttpMethod,
  path: string,
  serializedBody = "",
): string {
  const rawSignature =
    `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${serializedBody}`;
  return createHmac("sha256", apiSecret)
    .update(rawSignature)
    .digest("hex");
}

export function verifyLalamoveWebhookSignature(input: {
  apiKey: unknown;
  expectedApiKey: string;
  apiSecret: string;
  timestamp: unknown;
  signature: unknown;
  path: string;
  data: unknown;
}): boolean {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey : "";
  const timestamp =
    typeof input.timestamp === "string" || typeof input.timestamp === "number"
      ? String(input.timestamp)
      : "";
  const provided = typeof input.signature === "string"
    ? input.signature.toLowerCase()
    : "";

  if (!apiKey || apiKey !== input.expectedApiKey || !timestamp || !provided) {
    return false;
  }

  const body = JSON.stringify(input.data ?? {});
  const expected = lalamoveSignature(
    input.apiSecret,
    timestamp,
    "POST",
    input.path,
    body,
  );
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

export async function lalamoveRequest(
  config: LalamoveRequestConfig,
  method: LalamoveHttpMethod,
  path: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const timestamp = Date.now().toString();
  const serializedBody = body ? JSON.stringify(body) : "";
  const signature = lalamoveSignature(
    config.apiSecret,
    timestamp,
    method,
    path,
    serializedBody,
  );

  return fetch(`${config.baseUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `hmac ${config.apiKey}:${timestamp}:${signature}`,
      Market: config.market,
      "Request-ID": randomUUID(),
      ...(serializedBody ? { "Content-Type": "application/json" } : {}),
    },
    body: serializedBody || undefined,
    signal: AbortSignal.timeout(15_000),
  });
}
