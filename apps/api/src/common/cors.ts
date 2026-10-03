function parseOrigin(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Browser clients send an Origin header while native/mobile clients often do not.
 * Exact configured origins are always accepted. For local development, if CORS is
 * configured for any loopback HTTP(S) origin, accept other loopback ports too so
 * Expo Web can move from 8081 to 8082/8083 when its preferred port is occupied.
 */
export function isCorsOriginAllowed(
  origin: string | undefined,
  configuredOrigins: readonly string[],
): boolean {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;

  const requested = parseOrigin(origin);
  if (!requested || !isLoopbackHost(requested.hostname)) return false;
  if (requested.protocol !== "http:" && requested.protocol !== "https:") return false;

  return configuredOrigins.some((configuredOrigin) => {
    const configured = parseOrigin(configuredOrigin);
    if (!configured) return false;
    return (
      configured.protocol === requested.protocol &&
      isLoopbackHost(configured.hostname)
    );
  });
}
