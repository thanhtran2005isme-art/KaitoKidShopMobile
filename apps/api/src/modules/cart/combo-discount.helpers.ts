export const COMBO_PERCENT = 10;

export interface ComboRow {
  productId: number;
  category: string;
  price: number;
  quantity: number;
}

export interface ComboDiscountResult {
  eligible: boolean;
  percent: number;
  discount: number;
  eligibleSubtotal: number;
  categories: string[];
  message: string | null;
}

export function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < Number.EPSILON * Math.max(1, Math.abs(value))) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

export function evaluateComboRows(rows: ComboRow[]): ComboDiscountResult {
  const grouped = new Map<string, { products: Set<number>; subtotal: number }>();

  for (const row of rows) {
    if (!row.category.trim()) continue;
    const group = grouped.get(row.category) ?? {
      products: new Set<number>(),
      subtotal: 0,
    };
    group.products.add(row.productId);
    group.subtotal += row.price * row.quantity;
    grouped.set(row.category, group);
  }

  const eligibleGroups = [...grouped.entries()]
    .filter(([, group]) => group.products.size >= 2)
    .map(([category, group]) => ({
      category,
      distinctProducts: group.products.size,
      subtotal: group.subtotal,
    }));

  if (eligibleGroups.length === 0) {
    return {
      eligible: false,
      percent: 0,
      discount: 0,
      eligibleSubtotal: 0,
      categories: [],
      message: null,
    };
  }

  const eligibleSubtotal = eligibleGroups.reduce(
    (sum, group) => sum + group.subtotal,
    0,
  );
  const discount = roundHalfToEven(eligibleSubtotal * COMBO_PERCENT / 100);

  return {
    eligible: true,
    percent: COMBO_PERCENT,
    discount,
    eligibleSubtotal,
    categories: eligibleGroups.map((group) => group.category),
    message:
      `Mua ${eligibleGroups
        .map((group) => `${group.distinctProducts} món ${group.category}`)
        .join(" + ")} — giảm thêm ${COMBO_PERCENT}%`,
  };
}
