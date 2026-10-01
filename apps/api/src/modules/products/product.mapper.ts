import { parseJsonArray, toBoolean, toNullableNumber, toNumber } from "../../common/db-value.js";

export interface ProductRow {
  id: unknown;
  name: string;
  category: string;
  subcategory: string | null;
  style?: string | null;
  ageGroup?: string | null;
  gender: string;
  price: unknown;
  oldPrice: unknown;
  stock: unknown;
  reserved: unknown;
  status: string;
  image: string;
  images?: string | null;
  shortDescription: string | null;
  description?: string;
  sku: string;
  slug: string | null;
  menu?: string | null;
  collectionId?: unknown;
  specs?: string | null;
  isNew: unknown;
  isSale: unknown;
  isBestSeller: unknown;
  rating: unknown;
  soldCount: unknown;
  colors: string | null;
  sizes: string | null;
  variants?: string | null;
  createdAt?: Date | string;
}

export interface VariantInventoryRow {
  size: string;
  color: string;
  stock: unknown;
  reserved: unknown;
}

export interface ReviewRow {
  id: unknown;
  productId: unknown;
  customerName: string;
  rating: unknown;
  comment: string;
  createdAt: Date | string;
  orderId: unknown;
  images: string | null;
  videoUrl: string | null;
  size: string | null;
  color: string | null;
  adminReply: string | null;
  repliedAt: Date | string | null;
  helpfulCount: unknown;
}

export function mapProduct(row: ProductRow) {
  const stock = toNumber(row.stock);
  const reserved = toNumber(row.reserved);
  return {
    id: toNumber(row.id),
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    gender: row.gender,
    price: toNumber(row.price),
    oldPrice: toNullableNumber(row.oldPrice),
    stock,
    availableStock: Math.max(0, stock - reserved),
    status: row.status,
    image: row.image,
    shortDescription: row.shortDescription,
    sku: row.sku,
    slug: row.slug,
    isNew: toBoolean(row.isNew),
    isSale: toBoolean(row.isSale),
    isBestSeller: toBoolean(row.isBestSeller),
    rating: toNumber(row.rating),
    soldCount: toNumber(row.soldCount),
    colors: parseJsonArray<string>(row.colors),
    sizes: parseJsonArray<string>(row.sizes),
  };
}

function mapVariants(raw: unknown) {
  return parseJsonArray<Record<string, unknown>>(raw).map((variant) => ({
    size: String(variant.size ?? variant.Size ?? ""),
    color: String(variant.color ?? variant.Color ?? ""),
    sku: String(variant.sku ?? variant.Sku ?? ""),
  }));
}

export function mapProductDetail(
  row: ProductRow,
  inventoryRows: VariantInventoryRow[],
  reviewRows: ReviewRow[],
) {
  return {
    ...mapProduct(row),
    style: row.style ?? null,
    ageGroup: row.ageGroup ?? null,
    images: parseJsonArray<string>(row.images),
    description: row.description ?? "",
    menu: row.menu ?? null,
    collection: row.collectionId === null || row.collectionId === undefined
      ? null
      : String(toNumber(row.collectionId)),
    specs: row.specs ?? null,
    variants: mapVariants(row.variants),
    variantInventory: inventoryRows.map((item) => {
      const stock = toNumber(item.stock);
      const reserved = toNumber(item.reserved);
      return {
        size: item.size,
        color: item.color,
        stock,
        reserved,
        available: Math.max(0, stock - reserved),
      };
    }),
    reviews: reviewRows.map((review) => ({
      id: toNumber(review.id),
      productId: toNumber(review.productId),
      customerName: review.customerName,
      rating: toNumber(review.rating),
      comment: review.comment,
      createdAt: review.createdAt,
      orderId: toNumber(review.orderId),
      images: parseJsonArray<string>(review.images),
      videoUrl: review.videoUrl,
      size: review.size,
      color: review.color,
      adminReply: review.adminReply,
      repliedAt: review.repliedAt,
      helpfulCount: toNumber(review.helpfulCount),
      isVerifiedPurchase: toNumber(review.orderId) > 0,
    })),
    createdAt: row.createdAt,
  };
}
