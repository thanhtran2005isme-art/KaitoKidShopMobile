export interface PurchasedVariant {
  size: string;
  color: string;
}

export function selectPurchasedVariant(
  items: PurchasedVariant[],
  requestedSize?: string | null,
  requestedColor?: string | null,
): PurchasedVariant | null {
  const size = requestedSize?.trim();
  const color = requestedColor?.trim();
  let selected: PurchasedVariant | undefined;

  if (size || color) {
    selected = items.find((item) =>
      (!size || item.size === size) &&
      (!color || item.color === color),
    );
  }

  if (!selected && items.length === 1) selected = items[0];
  return selected ?? null;
}

export function normalizeReviewImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return [...new Set(
    images
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(0, 4);
}
