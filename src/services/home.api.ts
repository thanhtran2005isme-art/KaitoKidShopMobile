import { apiRequest } from '@/services/api-client';
import type {
  Banner,
  Category,
  HomeData,
  HomepageBlocks,
  PagedResult,
  Product,
  ProductDetail,
} from '@/types/shop';

export const shopApi = {
  async getHome(): Promise<HomeData> {
    const [banners, categories, newArrivals, bestSellers, saleProducts, blocks] = await Promise.all([
      apiRequest<Banner[]>('/api/banners?position=homepage'),
      apiRequest<Category[]>('/api/categories'),
      apiRequest<Product[]>('/api/products/new-arrivals?count=8'),
      apiRequest<Product[]>('/api/products/best-sellers?count=8'),
      apiRequest<Product[]>('/api/products/sale?count=8'),
      apiRequest<HomepageBlocks>('/api/homepage-blocks'),
    ]);

    return {
      banners,
      categories,
      newArrivals,
      bestSellers,
      saleProducts,
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

  getProductsByCategory(category: string, page = 1, pageSize = 20) {
    const query = `Category=${encodeURIComponent(category)}&Page=${page}&PageSize=${pageSize}`;
    return apiRequest<PagedResult<Product>>(`/api/products?${query}`);
  },

  searchProducts(search: string, page = 1, pageSize = 20) {
    const query = `Search=${encodeURIComponent(search)}&Page=${page}&PageSize=${pageSize}`;
    return apiRequest<PagedResult<Product>>(`/api/products?${query}`);
  },
};
