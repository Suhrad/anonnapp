/**
 * Centralized query key definitions for React Query
 * This ensures consistency across all components and pages
 */

export const queryKeys = {
  // Posts related queries
  posts: {
    all: () => ["posts"] as const,
    lists: () => [...queryKeys.posts.all(), "list"] as const,
    list: (filters: { activeFilter?: string; sortBy?: string }) => 
      [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all(), "detail"] as const,
    detail: (id: string | number) => [...queryKeys.posts.details(), id] as const,
    
    // API-based queries
    api: {
      all: () => ["/api/posts"] as const,
      byUser: (userId: string) => [...queryKeys.posts.api.all(), "user", userId] as const,
      byOrganization: (orgId: string | number) => [...queryKeys.posts.api.all(), "organization", orgId] as const,
      byBowl: (bowlId: string | number) => [...queryKeys.posts.api.all(), "bowl", bowlId] as const,
      comments: (postId: string | number) => [...queryKeys.posts.api.all(), postId, "comments"] as const,
    },
    
    // Specialized post lists
    featured: () => ["featured-posts"] as const,
    trending: (timeFilter?: string) => timeFilter ? ["trending-posts", timeFilter] as const : ["trending-posts"] as const,
  },
  
  // Polls related queries
  polls: {
    all: () => ["polls"] as const,
    detail: (id: string | number) => [...queryKeys.polls.all(), id] as const,
    comments: (pollId: string | number) => [...queryKeys.polls.all(), pollId, "comments"] as const,
  },
  
  // User related queries
  user: {
    current: () => ["/api/auth/user"] as const,
    profile: (id: string) => ["user", "profile", id] as const,
  },
  
  // Organizations and bowls
  organizations: {
    all: () => ["/api/organizations"] as const,
    detail: (id: string | number) => ["organization", id] as const,
  },
  
  bowls: {
    all: () => ["/api/bowls"] as const,
    detail: (id: string | number) => ["bowl", id] as const,
  },
} as const;

/**
 * Get all query keys that might contain posts data
 * Used for comprehensive invalidation after post updates
 */
export function getAllPostsQueryKeys() {
  return [
    // Base post queries
    { queryKey: queryKeys.posts.all() },
    { queryKey: queryKeys.posts.api.all() },
    { queryKey: queryKeys.posts.featured() },
    
    // Predicate-based invalidation for parameterized queries
    { predicate: (query: any) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      
      // Match home page posts queries
      if (key[0] === "posts" && key.length >= 2) return true;
      
      // Match trending posts
      if (key[0] === "trending-posts") return true;
      
      // Match API posts with filters
      if (key[0] === "/api/posts") return true;
      
      return false;
    }},
  ];
}

/**
 * Get all query keys that might contain a specific post
 * Used for invalidation after voting on a specific post
 */
export function getPostQueryKeys(postId: string | number) {
  return [
    // Specific post detail
    { queryKey: queryKeys.posts.detail(postId) },
    
    // All post lists (since they might contain this post)
    ...getAllPostsQueryKeys(),
  ];
}

/**
 * Get all query keys that might contain a specific poll
 * Used for invalidation after voting on a specific poll
 */
export function getPollQueryKeys(pollId: string | number) {
  return [
    // Specific poll detail
    { queryKey: queryKeys.polls.detail(pollId) },
    
    // All post lists (since polls are also posts)
    ...getAllPostsQueryKeys(),
  ];
}
