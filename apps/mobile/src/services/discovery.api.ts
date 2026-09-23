import { apiRequest } from '@/services/api-client';
import type {
  Collection,
  Lookbook,
  LookbookFilters,
  PagedResult,
  Product,
  RecommendationResult,
} from '@/types/shop';

function authInit(token?: string | null): RequestInit | undefined {
  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : undefined;
}

export const discoveryApi = {
  getCollections() {
    return apiRequest<Collection[]>('/api/collections');
  },

  getCollection(id: number) {
    return apiRequest<Collection>(`/api/collections/${id}`);
  },

  getCollectionProducts(
    collectionId: number,
    options?: { sortBy?: string; page?: number; pageSize?: number },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 40;
    const sort = options?.sortBy
      ? `&SortBy=${encodeURIComponent(options.sortBy)}`
      : '';

    return apiRequest<PagedResult<Product>>(
      `/api/products?CollectionId=${collectionId}&Page=${page}&PageSize=${pageSize}${sort}`,
    );
  },

  getLookbooks(filters?: { season?: string; style?: string }) {
    const params: string[] = [];
    if (filters?.season) params.push(`season=${encodeURIComponent(filters.season)}`);
    if (filters?.style) params.push(`style=${encodeURIComponent(filters.style)}`);
    const query = params.length ? `?${params.join('&')}` : '';

    return apiRequest<Lookbook[]>(`/api/lookbooks${query}`);
  },

  getLookbook(id: number) {
    return apiRequest<Lookbook>(`/api/lookbooks/${id}`);
  },

  getLookbookFilters() {
    return apiRequest<LookbookFilters>('/api/lookbooks/filters');
  },

  getRecommendations(token?: string | null, limit = 12) {
    return apiRequest<RecommendationResult>(
      `/api/recommendations/for-me?limit=${limit}`,
      authInit(token),
    );
  },
};
