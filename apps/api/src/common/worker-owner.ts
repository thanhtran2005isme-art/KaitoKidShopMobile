export type BackgroundWorkerOwner = "node";

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * C# đã retire; Node là runtime owner duy nhất.
 * Giữ API này để các worker/service cũ không cần đổi call-site.
 */
export function backgroundWorkerOwner(): BackgroundWorkerOwner {
  return "node";
}

export function nodeOwnsBackgroundWorkers(): boolean {
  return true;
}

export function envFlag(name: string, ...aliases: string[]): boolean {
  for (const key of [name, ...aliases]) {
    const raw = process.env[key];
    if (raw !== undefined) return /^(1|true|yes)$/i.test(raw.trim());
  }
  return false;
}

export function nodeWorkerEnabled(
  flagName: string,
  ...aliases: string[]
): boolean {
  // BACKGROUND_WORKER_OWNER=csharp từ shell cũ không được phép tắt worker Node ngầm.
  void normalized(process.env.BACKGROUND_WORKER_OWNER);
  return envFlag(flagName, ...aliases);
}
