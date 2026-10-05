import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type CustomerReturnStatus =
  | 'none'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'received_restock'
  | 'received_quarantine';

export type CustomerRefundStatus = 'none' | 'pending' | 'completed';

export interface CustomerOrderItemDTO {
  productId: number;
  productName: string;
  productImage: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  /** Backend trả về true nếu user đã đánh giá sản phẩm này trong đơn này. */
  hasReviewed?: boolean;
}

export interface CustomerOrderDTO {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode?: string;
  paymentMethod: string;
  status: string;
  canCancel: boolean;
  shippingStatus?: string;
  trackingCode?: string;
  trackingUrl?: string;
  shippingProvider?: string;
  shippingServiceCode?: string;
  leadTimeHours?: number | null;
  note?: string;
  createdAt: string;
  items: CustomerOrderItemDTO[];
  canConfirmReceived?: boolean;
  canReportNotReceived?: boolean;
  deliveryIssueReported?: boolean;
  customerReceiptConfirmed?: boolean;
  canReview?: boolean;
  canRequestReturn?: boolean;
  returnRequested?: boolean;
  returnStatus?: CustomerReturnStatus;
  refundStatus?: CustomerRefundStatus;
  receivedAt?: string | null;
  returnDeadline?: string | null;
  returnWindowDays?: number;
}

export const customerOrderApi = {
  /** Lấy danh sách đơn của user hiện tại (theo JWT) */
  async getMyOrders(): Promise<ApiResponse<CustomerOrderDTO[]>> {
    try {
      const response = await apiClient.get<CustomerOrderDTO[]>('/api/orders');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy chi tiết 1 đơn */
  async getById(id: number): Promise<ApiResponse<CustomerOrderDTO>> {
    try {
      const response = await apiClient.get<CustomerOrderDTO>(`/api/orders/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Khách xác nhận đã thực nhận hàng; bắt đầu mốc hoàn hàng 7 ngày. */
  async confirmReceived(id: number): Promise<ApiResponse<{ message: string; receivedAt: string; returnDeadline: string }>> {
    try {
      const response = await apiClient.post(`/api/orders/${id}/confirm-received`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Báo carrier đã đánh dấu giao nhưng khách chưa nhận; không tự hủy/hoàn kho. */
  async reportNotReceived(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.post(`/api/orders/${id}/report-not-received`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Gửi yêu cầu hoàn hàng trong 7 ngày kể từ lúc khách xác nhận nhận hàng. */
  async requestReturn(id: number, reason: string): Promise<ApiResponse<{ message: string; returnDeadline: string | null }>> {
    try {
      const response = await apiClient.post(`/api/orders/${id}/return-request`, { reason });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Hủy đơn hàng */
  async cancel(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.put<{ message: string }>(`/api/orders/${id}/cancel`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export interface CreateReviewPayload {
  productId: number;
  orderId: number;
  rating: number;
  comment: string;
  images?: string[];
  videoUrl?: string;
  size?: string;
  color?: string;
}

export interface ReviewDTO {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  orderId: number;
  images: string[];
  videoUrl?: string | null;
  size?: string | null;
  color?: string | null;
  adminReply?: string | null;
  repliedAt?: string | null;
  helpfulCount: number;
  isVerifiedPurchase: boolean;
}

export const customerReviewApi = {
  /** Lấy reviews của 1 sản phẩm (public — chỉ approved) */
  async getByProduct(productId: number): Promise<ApiResponse<ReviewDTO[]>> {
    try {
      const res = await apiClient.get<ReviewDTO[]>(`/api/reviews/product/${productId}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
    /** Upload ảnh/video cho review — trả về danh sách URL */
  async uploadMedia(files: File[]): Promise<ApiResponse<{ urls: string[] }>> {
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const res = await apiClient.post('/api/reviews/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Đánh dấu review hữu ích */
  async markHelpful(reviewId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.post(`/api/reviews/${reviewId}/helpful`);
      return { success: true };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async create(payload: CreateReviewPayload): Promise<ApiResponse<{ id: number }>> {
    try {
      const response = await apiClient.post<{ id: number }>('/api/reviews', payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
