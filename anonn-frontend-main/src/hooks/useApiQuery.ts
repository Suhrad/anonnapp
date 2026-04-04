import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import type { ApiCallOptions } from "@/lib/api";

export interface UseApiQueryOptions<T = unknown>
  extends Omit<ApiCallOptions, "method"> {
  queryKey: (string | number | boolean | undefined)[];
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  refetchInterval?: number;
  refetchIntervalInBackground?: boolean;
  select?: (data: T) => any;
}

/**
 * Hook for making GET requests with TanStack Query
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useApiQuery({
 *   endpoint: 'posts',
 *   queryKey: ['posts', page, sortBy],
 *   params: { page: 1, limit: 20, sortBy: 'hot' }
 * });
 * ```
 */
export function useApiQuery<T = unknown>(options: UseApiQueryOptions<T>) {
  const {
    endpoint,
    params,
    headers,
    on401,
    queryKey,
    enabled = true,
    staleTime,
    refetchOnWindowFocus = false,
    retry = false,
    onSuccess,
    onError,
    refetchInterval,
    refetchIntervalInBackground,
    select,
  } = options;

  return useQuery<T, Error>({
    queryKey,
    queryFn: async () => {
      return apiCall<T>({
        endpoint,
        method: "GET",
        params,
        headers,
        on401,
      });
    },
    enabled,
    refetchInterval,
    refetchIntervalInBackground,
    staleTime: staleTime ?? Infinity,
    refetchOnWindowFocus,
    retry,
    ...(select && { select }), // ✅ FIX HERE
    ...(onSuccess && { onSuccess }),
    ...(onError && { onError }),
  });
}
