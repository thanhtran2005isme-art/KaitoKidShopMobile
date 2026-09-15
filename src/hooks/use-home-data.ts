import { useCallback, useEffect, useState } from 'react';

import { shopApi } from '@/services/home.api';
import type { HomeData } from '@/types/shop';

export function useHomeData() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      setData(await shopApi.getHome());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu trang chủ.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
