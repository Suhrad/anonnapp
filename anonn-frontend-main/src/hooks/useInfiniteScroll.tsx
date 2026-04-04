import { useState, useEffect, useRef, useCallback } from 'react';

export interface InfiniteScrollOptions {
  threshold?: number; // How close to bottom before loading (0-1)
  rootMargin?: string; // CSS margin for intersection observer
  enabled?: boolean; // Whether infinite scroll is enabled
}

export interface InfiniteScrollResult<T> {
  items: T[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<T>) => void;
}

export function useInfiniteScroll<T extends { id: string }>(
  fetchItems: (page: number, limit: number) => Promise<{ items: T[]; hasMore: boolean; total?: number }>,
  limit: number = 10,
  options: InfiniteScrollOptions = {}
): InfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    threshold = 0.1,
    rootMargin = '100px',
    enabled = true
  } = options;

  // Fetch items function
  const fetchData = useCallback(async (pageNum: number, isRefresh = false) => {
    if (isLoading || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      const result = await fetchItems(pageNum, limit);
      
      if (abortControllerRef.current.signal.aborted) return;

      if (isRefresh) {
        setItems(result.items);
        setPage(1);
      } else {
        setItems(prev => [...prev, ...result.items]);
        setPage(pageNum);
      }
      
      setHasMore(result.hasMore);
      setIsInitialized(true);
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load items';
      setError(errorMessage);
      console.error('Infinite scroll error:', err);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [fetchItems, limit, isLoading, enabled]);

  // Load more items
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore || !enabled) return;
    fetchData(page + 1);
  }, [fetchData, page, isLoading, hasMore, enabled]);

  // Refresh all items
  const refresh = useCallback(() => {
    setError(null);
    setHasMore(true);
    setPage(1);
    fetchData(1, true);
  }, [fetchData]);

  // Add single item
  const addItem = useCallback((item: T) => {
    setItems(prev => [item, ...prev]);
  }, []);

  // Remove single item
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Update single item
  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // Set items directly
  const setItemsDirect = useCallback((newItems: T[]) => {
    setItems(newItems);
    setHasMore(newItems.length >= limit);
    setPage(1);
  }, [limit]);

  // Intersection Observer setup
  useEffect(() => {
    if (!enabled || !loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current = observer;
    observer.observe(loadingRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, hasMore, isLoading, threshold, rootMargin, enabled]);

  // Initial load
  useEffect(() => {
    if (!isInitialized && enabled) {
      fetchData(1, true);
    }
  }, [fetchData, isInitialized, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    items,
    isLoading,
    hasMore,
    error,
    loadMore,
    refresh,
    setItems: setItemsDirect,
    addItem,
    removeItem,
    updateItem,
  };
}

// Specialized hook for posts
export function useInfinitePosts(
  fetchPosts: (page: number, limit: number) => Promise<{ items: any[]; hasMore: boolean; total?: number }>,
  limit: number = 10,
  options?: InfiniteScrollOptions
) {
  return useInfiniteScroll(fetchPosts, limit, options);
}

// Specialized hook for comments
export function useInfiniteComments(
  fetchComments: (page: number, limit: number) => Promise<{ items: any[]; hasMore: boolean; total?: number }>,
  limit: number = 20,
  options?: InfiniteScrollOptions
) {
  return useInfiniteScroll(fetchComments, limit, options);
}


