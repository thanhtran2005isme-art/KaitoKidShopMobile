import { parseJsonArray, toNumber } from "../../common/db-value.js";
import { mapProduct, type ProductRow } from "../products/product.mapper.js";

export type SearchProductRow = ProductRow;

export function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

export function didYouMeanFromNames(
  query: string,
  names: string[],
): string | null {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  const threshold = Math.max(1, Math.floor(q.length / 3));
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const name of names) {
    for (const token of name
      .toLowerCase()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)) {
      if (token.length < 2 || token === q) continue;
      if (Math.abs(token.length - q.length) > threshold + 1) continue;
      const distance = levenshtein(q, token);
      if (distance < bestDistance && distance <= threshold) {
        bestDistance = distance;
        best = token;
      }
    }
  }
  return best;
}

export function aggregateJsonFacet(
  rows: SearchProductRow[],
  field: "sizes" | "colors",
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = field === "sizes" ? row.sizes : row.colors;
    for (const value of parseJsonArray<string>(raw)) {
      if (!value.trim()) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
  );
}

export function priceRangeFacet(
  rows: SearchProductRow[],
): Record<string, number> {
  const ranges = [
    ["Dưới 200k", 0, 200_000],
    ["200k - 500k", 200_000, 500_000],
    ["500k - 1tr", 500_000, 1_000_000],
    ["1tr - 2tr", 1_000_000, 2_000_000],
    ["Trên 2tr", 2_000_000, Number.MAX_SAFE_INTEGER],
  ] as const;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const price = toNumber(row.price);
    for (const [label, min, max] of ranges) {
      if (price >= min && price <= max) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
        break;
      }
    }
  }
  return Object.fromEntries(
    ranges
      .filter(([label]) => counts.has(label))
      .map(([label]) => [label, counts.get(label)!]),
  );
}

export function mapped(row: SearchProductRow) {
  return mapProduct(row);
}
