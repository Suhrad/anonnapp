// components/Home.tsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { isUnauthorizedError } from "@/lib/authUtils";
import PostCard from "@/components/cards/PostCard";
import EmptyPostState from "@/components/empty-states/EmptyPostState";
import FeedControls from "@/components/feed-controls/FeedControls";
import PostLoader from "@/components/loaders/PostLoader";
import SearchBar from "@/components/searchbar/searchbar";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PostWithDetails } from "@/types";
import { useLocation } from "wouter";


interface HomeProps {
  onCreatePost: () => void;
  onExploreCommunities: () => void;
  isAuthenticated: boolean;
}

export default function HomePage({
  onCreatePost,
  onExploreCommunities,
  isAuthenticated: _isAuthenticated,
}: HomeProps) {
  const [location] = useLocation();
  const [sortBy, setSortBy] = useState<"hot" | "new">("hot");
  const [timeFilter, setTimeFilter] = useState<
    "all" | "hour" | "day" | "week" | "month" | "year"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Read search query from URL on mount and when location changes
  useEffect(() => {
    if (location === "/") {
      const searchParams = new URLSearchParams(window.location.search);
      const queryParam = searchParams.get("q");
      setSearchQuery(queryParam || "");
    }
  }, [location]);

  // Also listen for popstate events (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      if (location === "/") {
        const searchParams = new URLSearchParams(window.location.search);
        const queryParam = searchParams.get("q");
        if (queryParam) {
          setSearchQuery(queryParam);
        } else {
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [location]);

  // Build params for posts query
  const postsParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page: 1,
      limit: 20,
      sortBy,
    };

    if (timeFilter && timeFilter !== "all") {
      params.time = timeFilter;
    }

    return params;
  }, [sortBy, timeFilter]);

  // Fetch posts using React Query for proper caching
  const { data: postsData, isLoading, refetch } = useApiQuery<{ posts: PostWithDetails[] }>({
    queryKey: ["/api/posts", sortBy, timeFilter, postsParams.page, postsParams.limit],
    endpoint: "posts",
    params: postsParams,
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    onError: (err) => {
      if (isUnauthorizedError(err as unknown as Error)) {
        toast.error("Unauthorized", {
          description: "You are logged out. Logging in again...",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    },
    select: (data: any) => {
      return { posts: data?.posts || [] };
    },
  });

  // Fetch search results
  const { data: searchData } = useApiQuery<{ posts: PostWithDetails[] }>({
    queryKey: ["/api/posts/search", searchQuery],
    endpoint: `posts/search?q=${searchQuery}`,
    enabled: !!searchQuery,
    retry: false,
    select: (data: any) => {
      return { posts: data?.posts || [] };
    },
  });

  // Determine which posts to display
  const posts = useMemo(() => {
    if (searchQuery && searchData?.posts) {
      return searchData.posts;
    }
    return postsData?.posts || [];
  }, [searchQuery, searchData, postsData]);

  return (
    <div className="flex max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-4 min-w-[200px] mx-auto lg:mx-0">
        {/* Search Bar */}
        <SearchBar
          placeholder="Blow the whistle ....."
          onSearch={(query) => setSearchQuery(query)}
          initialValue={searchQuery}
        />

        {/* Feed Controls */}
        <div className="flex flex-col gap-4 md:gap-6 mt-4 md:mt-6">
          <FeedControls
            sortBy={sortBy}
            timeFilter={timeFilter}
            onSortChange={setSortBy}
            onTimeFilterChange={setTimeFilter}
          />

          <div className="space-y-6">
            {isLoading ? (
              <PostLoader />
            ) : posts?.length === 0 ? (
              <EmptyPostState
                onCreatePost={onCreatePost}
                onExploreCommunities={onExploreCommunities}
              />
            ) : (
              posts
                ?.filter((post) => post.type !== "review")
                .map((post, index) => (
                  <div
                    key={post.id}
                    className="animate-post-reveal"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <PostCard
                      post={post}
                      onUpdate={refetch}
                      compact={false}
                      showCommunity={true}
                      index={index}
                    />
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
