export type Product = {
  id: number;
  name: string;
  category: string;
  subcategory?: string | null;
  gender: string;
  price: number;
  oldPrice?: number | null;
  stock: number;
  availableStock?: number;
  status: string;
  image: string;
  shortDescription?: string | null;
  sku: string;
  slug?: string | null;
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  rating: number;
  soldCount: number;
  colors: string[];
  sizes: string[];
};

export type ProductVariant = {
  size: string;
  color: string;
  sku: string;
};

export type ProductVariantInventory = {
  size: string;
  color: string;
  stock: number;
  reserved: number;
  available: number;
};

export type ProductReview = {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  orderId?: number;
  images?: string[];
  videoUrl?: string | null;
  size?: string | null;
  color?: string | null;
  adminReply?: string | null;
  repliedAt?: string | null;
  helpfulCount?: number;
  isVerifiedPurchase?: boolean;
};

export type ProductDetail = Product & {
  style?: string | null;
  ageGroup?: string | null;
  images: string[];
  description: string;
  menu?: string | null;
  collection?: string | null;
  specs?: string | null;
  variants: ProductVariant[];
  variantInventory: ProductVariantInventory[];
  reviews: ProductReview[];
  createdAt?: string;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: number | null;
  sortOrder: number;
};

export type Banner = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  link?: string | null;
  secondLink?: string | null;
  primaryButton?: string | null;
  secondaryButton?: string | null;
  type?: string | null;
  position?: string | null;
  sortOrder: number;
};

export type HomepageBlock = {
  id: number;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  link?: string | null;
  icon?: string | null;
  sortOrder: number;
};

export type HomepageBlocks = Record<string, HomepageBlock[]>;

export type Collection = {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  image?: string | null;
  sortOrder: number;
};

export type LookbookHotspot = {
  id: number;
  productId: number;
  productName: string;
  productImage?: string | null;
  productPrice: number;
  productOldPrice?: number | null;
  x: number;
  y: number;
  note?: string | null;
  sortOrder: number;
};

export type Lookbook = {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image: string;
  link?: string | null;
  videoUrl?: string | null;
  season?: string | null;
  style?: string | null;
  sortOrder: number;
  hotspots: LookbookHotspot[];
};

export type LookbookFilters = {
  seasons: string[];
  styles: string[];
};

export type RecommendationResult = {
  isPersonalized: boolean;
  source: 'wishlist-orders' | 'fallback' | string;
  items: Product[];
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type HomeData = {
  banners: Banner[];
  categories: Category[];
  newArrivals: Product[];
  bestSellers: Product[];
  saleProducts: Product[];
  featuredCollections: Collection[];
  featuredLookbooks: Lookbook[];
  recommendations: Product[];
  recommendationPersonalized: boolean;
  blocks: HomepageBlocks;
};
