export interface LoginRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function parseUserAgent(userAgent: string | null | undefined) {
  if (!userAgent?.trim()) {
    return { browser: "unknown", os: "unknown", deviceType: "unknown" };
  }

  const value = userAgent.toLowerCase();
  const browser = value.includes("edg/")
    ? "Edge"
    : value.includes("opr/") || value.includes("opera")
      ? "Opera"
      : value.includes("chrome")
        ? "Chrome"
        : value.includes("firefox")
          ? "Firefox"
          : value.includes("safari")
            ? "Safari"
            : "Other";

  const os = value.includes("windows nt 10")
    ? "Windows 10/11"
    : value.includes("windows")
      ? "Windows"
      : value.includes("mac os x")
        ? "macOS"
        : value.includes("android")
          ? "Android"
          : value.includes("iphone") || value.includes("ipad")
            ? "iOS"
            : value.includes("linux")
              ? "Linux"
              : "Unknown";

  const deviceType =
    value.includes("mobile") ||
    value.includes("iphone") ||
    value.includes("android")
      ? "Mobile"
      : value.includes("ipad") || value.includes("tablet")
        ? "Tablet"
        : "Desktop";

  return { browser, os, deviceType };
}
