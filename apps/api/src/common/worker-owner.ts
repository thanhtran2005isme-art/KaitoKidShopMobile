export type BackgroundWorkerOwner = "csharp" | "node";

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function backgroundWorkerOwner(): BackgroundWorkerOwner {
  return normalized(process.env.BACKGROUND_WORKER_OWNER) === "node"
    ? "node"
    : "csharp";
}

export function nodeOwnsBackgroundWorkers(): boolean {
  return backgroundWorkerOwner() === "node";
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
  return nodeOwnsBackgroundWorkers() && envFlag(flagName, ...aliases);
}
