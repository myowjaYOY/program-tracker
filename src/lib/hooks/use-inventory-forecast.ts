import { useQuery } from '@tanstack/react-query';
import type { InventoryForecastResponse } from '@/types/database.types';

// Query keys for cache management
export const inventoryForecastKeys = {
  all: ['inventory-forecast'] as const,
  lists: () => [...inventoryForecastKeys.all, 'list'] as const,
  list: (filters?: string) => [...inventoryForecastKeys.lists(), filters] as const,
};

// Fetch inventory forecast with optional filters
export function useInventoryForecast(params?: {
  range?: 'this_month' | 'next_month' | 'custom';
  start?: string | null;
  end?: string | null;
  therapyTypes?: number[] | null;
}) {
  const queryParams = new URLSearchParams();
  
  // Add range parameter
  if (params?.range) {
    queryParams.append('range', params.range);
  }
  
  // Add custom date range if provided
  if (params?.start) {
    queryParams.append('start', params.start);
  }
  if (params?.end) {
    queryParams.append('end', params.end);
  }
  
  // Add therapy types filter if provided
  if (params?.therapyTypes && params.therapyTypes.length > 0) {
    queryParams.append('therapyTypes', params.therapyTypes.join(','));
  }

  const queryString = queryParams.toString();
  const url = `/api/reports/inventory-forecast${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: inventoryForecastKeys.list(queryString),
    queryFn: async () => {
      const res = await fetch(url, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch inventory forecast');
      }
      return json as InventoryForecastResponse;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

