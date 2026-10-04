import { createHmac, randomUUID } from "node:crypto";

export interface LalamoveRequestConfig {
  baseUrl: string;
  market: string;
  apiKey: string;
  apiSecret: string;
}

export async function lalamoveRequest(
  config: LalamoveRequestConfig,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const timestamp = Date.now().toString();
  const serializedBody = body ? JSON.stringify(body) : "";
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${serializedBody}`;
  const signature = createHmac("sha256", config.apiSecret)
    .update(rawSignature)
    .digest("hex");

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
