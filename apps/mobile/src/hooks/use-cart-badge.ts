import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '@/services/api-client';

type CartBadgeItem = {
  quantity: number;
};

export function useCartBadge(token?: string | null) {
  const [count, setCount] = useState<number | null>(token ? null : 0);

  const refresh = useCallback(async () => {
    if (!token) {
      setCount(0);
      return;
    }

    try {
      const items = await apiRequest<CartBadgeItem[]>('/api/cart', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCount(items.reduce((total, item) => total + Math.max(0, item.quantity || 0), 0));
    } catch {
      // Cart là dữ liệu phụ trên Home. Không làm hỏng trang chủ nếu session cũ
      // hoặc API giỏ hàng tạm thời không truy cập được.
      setCount(null);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { count, refresh };
}
