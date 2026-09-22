export type CreateReviewInput = {
  productId: number;
  orderId: number;
  rating: number;
  comment: string;
  images?: string[];
  videoUrl?: string;
  size?: string;
  color?: string;
};

export type ReviewUploadResult = {
  urls: string[];
};
