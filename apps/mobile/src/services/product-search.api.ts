import { apiRequest } from '@/services/api-client';
import type { Product } from '@/types/shop';

export type SearchSort = 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';

export type SearchFilters = {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: SearchSort;
  page?: number;
  pageSize?: number;
};

export type SearchFacets = {
  categories: Record<string, number>;
  sizes: Record<string, number>;
  colors: Record<string, number>;
  priceRanges: Record<string, number>;
};

export type SearchResult = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
  didYouMean?: string | null;
};

export type SearchSuggestions = {
  suggestions: string[];
  products: Product[];
};

// Sử dụng cùng contract /api/search của Web. Backend lọc trạng thái active và
// tính facets, sorting, paging; không tải cả catalog rồi lọc trên Mobile.
export const productSearchApi = {
  search(filters: SearchFilters) {
    const params = new URLSearchParams();
    params.set('query', filters.query.trim());
    params.set('page', String(filters.page ?? 1));
    params.set('pageSize', String(filters.pageSize ?? 20));
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    return apiRequest<SearchResult>('/api/search?' + params.toString());
  },

  suggest(keyword: string) {
    const value = keyword.trim();
    if (value.length < 2) {
      return Promise.resolve<SearchSuggestions>({ suggestions: [], products: [] });
    }
    return apiRequest<SearchSuggestions>(
      '/api/search/suggestions?q=' + encodeURIComponent(value) + '&limit=6',
    );
  },
};
