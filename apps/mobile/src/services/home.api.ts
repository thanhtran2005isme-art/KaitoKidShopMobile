import { apiRequest } from '@/services/api-client';
import type {
  Banner,
  Category,
  HomeData,
  HomepageBlock,
  HomepageBlocks,
  PagedResult,
  Product,
  ProductDetail,
} from '@/types/shop';

type SafeResult<T> = {
  value: T;
  error: unknown | null;
};

async function safely<T>(request: Promise<T>, fallback: T): Promise<SafeResult<T>> {
  try {
    return { value: await request, error: null };
  } catch (error) {
    return { value: fallback, error };
  }
}

function heroBlockToBanner(block: HomepageBlock): Banner {
  return {
    id: block.id,
    title: block.title,
    subtitle: block.subtitle,
    description: block.description,
    image: block.image,
    link: block.link,
    primaryButton: 'Khám phá ngay',
    type: block.type,
    position: 'homepage',
    sortOrder: block.sortOrder,
  };
}

export const shopApi = {
  async getHome(): Promise<HomeData> {
    // Home là màn hình đầu tiên nên không để một endpoint phụ lỗi làm trắng toàn bộ trang.
    // Mỗi nhóm dữ liệu có fallback riêng; chỉ báo lỗi nếu toàn bộ request đều thất bại.
    const [bannersResult, categoriesResult, newResult, bestResult, saleResult, blocksResult] = await Promise.all([
      safely(apiRequest<Banner[]>('/api/banners?position=homepage'), []),
      safely(apiRequest<Category[]>('/api/categories'), []),
      safely(apiRequest<Product[]>('/api/products/new-arrivals?count=8'), []),
      safely(apiRequest<Product[]>('/api/products/best-sellers?count=8'), []),
      safely(apiRequest<Product[]>('/api/products/sale?count=8'), []),
      safely(apiRequest<HomepageBlocks>('/api/homepage-blocks'), {}),
    ]);

    const results = [bannersResult, categoriesResult, newResult, bestResult, saleResult, blocksResult];
    const failed = results.filter((result) => result.error !== null);

    if (failed.length === results.length) {
      const firstError = failed[0]?.error;
      throw firstError instanceof Error
        ? firstError
        : new Error('Không thể kết nối tới backend để tải trang chủ.');
    }

    const blocks = blocksResult.value;
    const heroFallback = (blocks.hero || []).map(heroBlockToBanner);

    return {
      banners: bannersResult.value.length ? bannersResult.value : heroFallback,
      categories: categoriesResult.value,
      newArrivals: newResult.value,
      bestSellers: bestResult.value,
      saleProducts: saleResult.value,
      blocks,
    };
  },

  getCategories() {
    return apiRequest<Category[]>('/api/categories');
  },

  getProduct(slugOrId: string) {
    const isId = /^\d+$/.test(slugOrId);
    return apiRequest<ProductDetail>(
      isId ? `/api/products/${slugOrId}` : `/api/products/slug/${encodeURIComponent(slugOrId)}`,
    );
  },

  getRelatedProducts(productId: number, count = 6) {
    return apiRequest<Product[]>(`/api/products/${productId}/related?count=${count}`);
  },

  getProductsByCategory(category: string, page = 1, pageSize = 20) {
    const query = `Category=${encodeURIComponent(category)}&Page=${page}&PageSize=${pageSize}`;
    return apiRequest<PagedResult<Product>>(`/api/products?${query}`);
  },

  searchProducts(search: string, page = 1, pageSize = 20) {
    const query = `Search=${encodeURIComponent(search)}&Page=${page}&PageSize=${pageSize}`;
    return apiRequest<PagedResult<Product>>(`/api/products?${query}`);
  },
};
