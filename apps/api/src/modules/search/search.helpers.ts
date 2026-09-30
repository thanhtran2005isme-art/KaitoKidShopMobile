import { mapProduct, type ProductRow } from "../products/product.mapper.js";

export interface SearchRequest {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  minRating?: number;
  sortBy?: string;
  page: number;
  pageSize: number;
}

export function parseCsv(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map(v => v.trim()).filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cur.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function jsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}

export function buildFacets(sample: ProductRow[], req: SearchRequest) {
  const sizes = req.sizes ?? [];
  const colors = req.colors ?? [];
  const price = (p: ProductRow) => {
    const v = Number(p.price);
    return (req.minPrice == null || v >= req.minPrice) && (req.maxPrice == null || v <= req.maxPrice);
  };
  const category = (p: ProductRow) => !req.category || p.category === req.category;
  const rating = (p: ProductRow) => req.minRating == null || Number(p.rating) >= req.minRating;
  const matchSizes = (p: ProductRow) => sizes.length === 0 || jsonArray(p.sizes).some(x => sizes.includes(x));
  const matchColors = (p: ProductRow) => colors.length === 0 || jsonArray(p.colors).some(x => colors.includes(x));

  const categories = new Map<string, number>();
  for (const p of sample.filter(p => price(p) && matchSizes(p) && matchColors(p) && rating(p))) {
    if (p.category) categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
  }
  const aggregate = (items: ProductRow[], pick: (p: ProductRow) => string[]) => {
    const m = new Map<string, number>();
    for (const p of items) for (const v of pick(p)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return Object.fromEntries([...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20));
  };
  const ranges = [
    ["Dưới 200k",0,200000],["200k - 500k",200000,500000],["500k - 1tr",500000,1000000],
    ["1tr - 2tr",1000000,2000000],["Trên 2tr",2000000,Number.MAX_SAFE_INTEGER],
  ] as const;
  const priceRanges: Record<string, number> = {};
  for (const p of sample.filter(p => category(p) && matchSizes(p) && matchColors(p) && rating(p))) {
    const v=Number(p.price); const r=ranges.find(([,min,max])=>v>=min&&v<=max);
    if(r) priceRanges[r[0]]=(priceRanges[r[0]]??0)+1;
  }
  return {
    categories:Object.fromEntries([...categories.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20)),
    sizes:aggregate(sample.filter(p=>price(p)&&category(p)&&matchColors(p)&&rating(p)),p=>jsonArray(p.sizes)),
    colors:aggregate(sample.filter(p=>price(p)&&category(p)&&matchSizes(p)&&rating(p)),p=>jsonArray(p.colors)),
    priceRanges,
  };
}

export function productDto(row: ProductRow) { return mapProduct(row); }
