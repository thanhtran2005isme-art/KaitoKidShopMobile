import type { ProductDetail } from '@/types/shop';

export const PRODUCT_COLOR_MAP: Record<string, string> = {
  'đen': '#111827',
  'trắng': '#FFFFFF',
  'xám': '#9CA3AF',
  'xanh navy': '#1E3A8A',
  'xanh da trời': '#60A5FA',
  'xanh đậm': '#1D4ED8',
  'xanh nhạt': '#93C5FD',
  'xanh pastel': '#BFDBFE',
  'xanh rêu': '#4D7C0F',
  'hồng': '#F9A8D4',
  'hồng pastel': '#FBCFE8',
  'hồng nhạt': '#FCE7F3',
  'be': '#D6C3A5',
  'nâu': '#92400E',
  'đỏ đô': '#991B1B',
  'tím': '#8B5CF6',
  'tím nhạt': '#C4B5FD',
  'cam': '#FB923C',
};

export function productColorValue(name: string) {
  return PRODUCT_COLOR_MAP[name.trim().toLowerCase()] || '#D1D5DB';
}

export function productGenderLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'nam') return 'Bé trai';
  if (normalized === 'nu' || normalized === 'nữ') return 'Bé gái';
  if (normalized === 'unisex') return 'Unisex';
  return value || 'Trẻ em';
}

export function productAgeLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'treem' || normalized === 'trẻ em') return '0–12 tuổi';
  return value || '0–12 tuổi';
}

export function htmlToPlainText(value?: string | null) {
  if (!value) return '';

  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export type ProductSpecRow = {
  label: string;
  value: string;
};

export function parseProductSpecs(value?: string | null): ProductSpecRow[] {
  if (!value?.trim()) return [];

  const raw = value.trim();

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => {
        if (typeof item === 'string') {
          const separator = item.indexOf(':');
          if (separator > 0) {
            return [{
              label: item.slice(0, separator).trim(),
              value: item.slice(separator + 1).trim(),
            }];
          }
          return [{ label: 'Thông tin', value: item }];
        }

        if (item && typeof item === 'object') {
          return Object.entries(item as Record<string, unknown>)
            .filter(([, itemValue]) => itemValue != null)
            .map(([label, itemValue]) => ({
              label,
              value: String(itemValue),
            }));
        }

        return [];
      });
    }

    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, unknown>)
        .filter(([, itemValue]) => itemValue != null)
        .map(([label, itemValue]) => ({
          label,
          value: String(itemValue),
        }));
    }
  } catch {
    // Dữ liệu cũ có thể là text thường; fallback bên dưới.
  }

  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator > 0) {
        return {
          label: line.slice(0, separator).trim(),
          value: line.slice(separator + 1).trim(),
        };
      }

      return { label: 'Thông tin', value: line };
    });
}

export function buildProductFacts(product: ProductDetail): ProductSpecRow[] {
  const rows: ProductSpecRow[] = [
    { label: 'Mã sản phẩm', value: product.sku },
    { label: 'Danh mục', value: product.subcategory || product.category },
    { label: 'Dành cho', value: productGenderLabel(product.gender) },
    { label: 'Độ tuổi', value: productAgeLabel(product.ageGroup) },
  ];

  if (product.style) rows.push({ label: 'Phong cách', value: product.style });

  return [...rows, ...parseProductSpecs(product.specs)];
}

export type SizeGuideRow = {
  size: string;
  age: string;
  height: string;
};

export const KID_SIZE_GUIDE: SizeGuideRow[] = [
  { size: '90', age: '1–2 tuổi', height: '85–95 cm' },
  { size: '100', age: '2–3 tuổi', height: '95–105 cm' },
  { size: '110', age: '4–5 tuổi', height: '105–115 cm' },
  { size: '120', age: '5–6 tuổi', height: '115–125 cm' },
  { size: '130', age: '7–8 tuổi', height: '125–135 cm' },
  { size: '140', age: '9–10 tuổi', height: '135–145 cm' },
  { size: '150', age: '11–12 tuổi', height: '145–155 cm' },
];

export function supportsKidSizeGuide(sizes: string[]) {
  return sizes.some((size) => KID_SIZE_GUIDE.some((row) => row.size === size));
}
