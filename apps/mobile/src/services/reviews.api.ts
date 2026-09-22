import { apiRequest } from '@/services/api-client';
import type { ProductReview } from '@/types/shop';
import type {
  CreateReviewInput,
  ReviewUploadResult,
} from '@/types/reviews';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export const reviewsApi = {
  getProductReviews(productId: number) {
    return apiRequest<ProductReview[]>('/api/reviews/product/' + productId);
  },

  markHelpful(reviewId: number) {
    return apiRequest<{ message: string }>('/api/reviews/' + reviewId + '/helpful', {
      method: 'POST',
    });
  },

  uploadMedia(token: string, formData: FormData) {
    return apiRequest<ReviewUploadResult>(
      '/api/reviews/upload',
      {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
      },
      45000,
    );
  },

  create(token: string, input: CreateReviewInput) {
    return apiRequest<ProductReview>('/api/reviews', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },
};
