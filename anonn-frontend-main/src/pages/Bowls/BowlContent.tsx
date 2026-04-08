import PostCard from "@/components/cards/PostCard";
import { SvgIcon } from "@/components/SvgIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { apiCall } from "@/lib/api";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import type { BowlWithDetails, PostWithDetails } from "@/types";
import { MessageSquare, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

export default function BowlContent() {
  const params = useParams();
  const idParam = (params.id as string) || "";
  const { isAuthenticated, user: _user, getAccessToken } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"about" | "posts" | "polls">(
    "about"
  );

  const [bowlPolls, setBowlPolls] = useState<PostWithDetails[]>([]);
  const [bowlPosts, setBowlPosts] = useState<PostWithDetails[]>([]);

  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | null>(
    null
  );

  useEffect(() => {
    const getHeaders = async () => {
      const token = await getAccessToken();
      setAuthHeaders({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      });
    };

    if (idParam) getHeaders();
  }, [idParam, getAccessToken]);

  // Fetch bowl data
  const {
    data: bowl,
    isLoading: bowlLoading,
    error: bowlError,
  } = useApiQuery<BowlWithDetails>({
    endpoint: `bowls/${idParam}`,
    queryKey: ["api/bowls", idParam],
    enabled: !!idParam,
    retry: false,
    headers: authHeaders ?? {},
    select: (data: any) => data?.bowl || data,
  });

  // Fetch posts for this bowl using the new endpoint
  const { data: postsData, isLoading: postsLoading } = useApiQuery<{ posts: PostWithDetails[] }>({
    endpoint: `bowls/${idParam}/posts`,
    queryKey: ["/api/bowls", idParam, "posts"],
    enabled: !!idParam && !!bowl?.id,
    params: {
      page: 1,
      limit: 5,
      sort: "upvotes_desc" as "hot" | "trending" | "new" | "top" | "upvotes_desc" | "upvotes_asc",
    },
    headers: authHeaders ?? {},
    retry: false,
    select: (data: any) => {
      // Handle different response structures
      if (data?.posts) return { posts: data.posts };
      if (Array.isArray(data)) return { posts: data };
      if (data?.data?.posts) return { posts: data.data.posts };
      return { posts: [] };
    },
  });

  const posts = postsData?.posts || [];

  useEffect(() => {
    if (posts && Array.isArray(posts)) {
      const polls = posts.filter((p: any) => p.type === "poll");
      const normalPosts = posts.filter((p: any) => p.type !== "poll");
      setBowlPolls(polls);
      setBowlPosts(normalPosts);
    }
  }, [posts]);

  // Check if user has joined this bowl by checking their joined bowls from auth/me
  type JoinedBowl = string | { _id?: string; id?: string | number } | { _id: string } | { id: string | number };
  const { data: currentUser, isLoading: followLoading } = useApiQuery<{ user: { joinedBowls?: JoinedBowl[] } }>({
    endpoint: "auth/me",
    queryKey: ["/api/auth/me"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    on401: "returnNull",
  });

  // Check if the current bowl is in the user's joined bowls
  const isUserFollowing = (() => {
    if (!isAuthenticated || !currentUser?.user?.joinedBowls || !bowl?.id) {
      return false;
    }
    
    const bowlId = String(bowl.id);
    return currentUser.user.joinedBowls.some((joinedBowl) => {
      let id: string | number | undefined;
      if (typeof joinedBowl === 'string') {
        id = joinedBowl;
      } else if (typeof joinedBowl === 'object' && joinedBowl !== null) {
        id = ('_id' in joinedBowl && joinedBowl._id) || ('id' in joinedBowl && joinedBowl.id) || undefined;
      }
      if (!id) return false;
      
      // Normalize IDs for comparison (handle both MongoDB ObjectId and regular IDs)
      const normalizedJoinedId = typeof id === 'string' && id.length === 24 ? id : String(id);
      const normalizedBowlId = typeof bowl.id === 'string' && bowl.id.length === 24 ? bowl.id : String(bowl.id);
      
      return normalizedJoinedId === normalizedBowlId || String(id) === bowlId;
    });
  })();

  // Follow/Unfollow mutation
  // const followBowlMutation = useMutation({
  //   mutationFn: async () => {
  //     if (!bowl?.id) throw new Error("Bowl not loaded");

  //     if (isUserFollowing) {
  //       // Unfollow
  //       await apiRequest("DELETE", `/api/bowls/${bowl.id}/follow`, {});
  //     } else {
  //       // Follow
  //       await apiRequest("POST", `/api/bowls/${bowl.id}/follow`, {});
  //     }
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({
  //       queryKey: ["/api/bowls", bowl?.id, "following"],
  //     });
  //     toast({
  //       title: isUserFollowing ? "Left channel" : "Joined!",
  //       description: isUserFollowing
  //         ? "You've left this channel."
  //         : "You're now following this channel.",
  //     });
  //   },
  //   onError: (error: any) => {
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to update follow status",
  //       variant: "destructive",
  //     });
  //   },
  // });
  const followBowlMutation = useApiMutation<unknown, { action: "follow" | "unfollow" }>({
    endpoint: `bowls/${bowl?.id}/join`,
    method: "POST",
    mutationFn: async ({ action }) => {
      if (!bowl?.id) throw new Error("Bowl not loaded");
      const token = await getAccessToken();
      
      return apiCall({
        endpoint: action === "unfollow" ? `bowls/${bowl.id}/leave` : `bowls/${bowl.id}/join`,
        method: action === "unfollow" ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    },
    invalidateQueries: [["/api/auth/me"], ["/api/user/bowls"], ["/api/bowls"]],

    onSuccess: (_data, variables) => {
      toast.success(variables.action === "unfollow" ? "Left channel" : "Joined!", {
        description: variables.action === "unfollow"
          ? "You've left this channel."
          : "You're now following this channel.",
      });
    },

    onError: (error: any) => {
      toast.error("Error", {
        description: error.message || "Failed to update follow status",
      });
    },
  });

  const toggleFollow = () => {
    followBowlMutation.mutate({ 
      action: isUserFollowing ? "unfollow" : "follow" 
    });
  };
  // Format numbers (30000 -> 30k)
  const formatCount = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.floor(num / 1000)}k`;
    return num.toString();
  };


  // Handle bowl not found
  if (bowlError && !bowlLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bowl Not Found</h1>
          <p className="text-gray-400 mb-6">
            The channel you're looking for doesn't exist.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (bowlLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-32 bg-gray-800 rounded-full" />
            <Skeleton className="h-10 w-32 bg-gray-800 rounded-full" />
            <Skeleton className="h-10 w-32 bg-gray-800 rounded-full" />
          </div>
        </div>
        <div className="px-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48 bg-gray-800" />
              <Skeleton className="h-10 w-24 bg-gray-800" />
            </div>
            <div className="flex gap-16">
              <Skeleton className="h-6 w-16 bg-gray-800" />
              <Skeleton className="h-6 w-16 bg-gray-800" />
              <Skeleton className="h-6 w-16 bg-gray-800" />
            </div>
            <Skeleton className="h-20 w-full bg-gray-800" />
            <Skeleton className="h-40 w-full bg-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!bowl) return null;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-6 mt-9 min-w-[200px] mx-auto lg:mx-0">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[10px] text-xs text-[#525252]">
            <button
              onClick={() => setActiveTab("about")}
              className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${activeTab === "about"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              ABOUT
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${activeTab === "posts"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              POSTS
            </button>
            <button
              onClick={() => setActiveTab("polls")}
              className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${activeTab === "polls"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              POLLS
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === "about" && (
            <div className="space-y-6">
              {/* Bowl Header */}
              <div className="flex items-center justify-between">
                <div className="text-xl font-normal font-spacemono text-[#E8EAE9]">
                  /{bowl?.displayName || ""}
                </div>
                {isAuthenticated && (
                  <button
                    onClick={() => toggleFollow()}
                    disabled={followBowlMutation.isPending || followLoading}
                    className={`px-6 py-3 text-xs font-normal flex items-center gap-2 transition-colors disabled:opacity-50 ${
                      isUserFollowing
                        ? "bg-[#1B1C20] text-[#E8EAE9] hover:bg-[#2a2b2f]"
                        : "bg-[#E8EAE9] text-[#525252] hover:bg-gray-200"
                    }`}
                  >
                    {isUserFollowing ? (
                      <>
                        <Minus className="h-4 w-4" />
                        LEAVE
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        JOIN
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="flex text-[#525252] border-[0.2px] border-[#525252]/30">
                <div className="flex items-center px-6 py-3 gap-2">
                  <SvgIcon src="/icons/Profile-sidebar icon.svg" />
                  <span className="text-sm">
                    {formatCount(bowl?.memberCount || 0)}
                  </span>
                </div>
                <div className="flex flex-1 justify-center items-center px-12 py-4 gap-2 border-y-0 border-[0.2px] border-[#525252]/30">
                  <SvgIcon src="/icons/Post option icon.svg" />
                  <span className="text-sm">
                    {formatCount(bowl?.postCount)}
                  </span>
                </div>
                <div className="flex flex-1 justify-center items-center px-8 py-4 gap-2">
                  <SvgIcon src="/icons/Polls icon.svg" />
                  {/* <span className="text-sm">{formatCount(bowl.pollCount)}</span> */}
                </div>
              </div>

              {/* Description */}
              <p className="text-[#8E8E93] text-xs leading-relaxed">
                {bowl?.description || ""}
              </p>

              {/* Admin Section */}
              <div>
                <div className="text-[#E8EAE9] text-xs font-medium mb-6 uppercase">
                  ADMIN
                </div>
                <div className="flex flex-col items-start gap-2 border border-[#525252]/30 w-fit py-5 px-6">
                  <div className="w-16 h-16">
                    <img
                      src={bowl.creator?.avatar || DEFAULT_PROFILE_PICTURE}
                      alt={bowl.creator?.username || "Unknown admin"}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                  <span className="text-[#8E8E93] text-xs">
                    {bowl.creator?.username || "Unknown admin"}
                  </span>
                </div>
              </div>

              {/* TOP CONTENT Section */}
              <div>
                <div className="text-[#E8EAE9] text-xs font-medium mb-4 uppercase">
                  TOP CONTENT
                </div>
                {postsLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="bg-black border border-gray-800 rounded-lg overflow-hidden mb-4"
                      >
                        <div className="bg-[#3a3a3a] p-4">
                          <Skeleton className="h-6 w-1/4 bg-gray-700" />
                        </div>
                        <div className="p-4">
                          <Skeleton className="h-6 w-3/4 mb-4 bg-gray-700" />
                          <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                          <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                          <Skeleton className="h-4 w-2/3 bg-gray-700" />
                        </div>
                        <div className="border-t border-gray-700 p-4">
                          <Skeleton className="h-8 w-32 bg-gray-700" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : posts && posts.length > 0 ? (
                  <div className="space-y-4">
                    {posts.slice(0, 3).map((post) => (
                      <PostCard key={post.id} post={post} onUpdate={() => { }} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#3a3a3a] p-12 text-center rounded">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">
                      No posts yet in this channel
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "posts" && (
            <div className="space-y-6">
              <div className="text-[#E8EAE9] text-xs font-medium uppercase">
                POSTS
              </div>
              {postsLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-black border border-gray-800 rounded-lg overflow-hidden mb-4"
                    >
                      <div className="bg-[#3a3a3a] p-4">
                        <Skeleton className="h-6 w-1/4 bg-gray-700" />
                      </div>
                      <div className="p-4">
                        <Skeleton className="h-6 w-3/4 mb-4 bg-gray-700" />
                        <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                        <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                        <Skeleton className="h-4 w-2/3 bg-gray-700" />
                      </div>
                      <div className="border-t border-gray-700 p-4">
                        <Skeleton className="h-8 w-32 bg-gray-700" />
                      </div>
                    </div>
                  ))}
                </>
              ) : posts && posts.length > 0 ? (
                <div className="space-y-4">
                  {bowlPosts.map((post) => (
                    <PostCard key={post.id} post={post} onUpdate={() => { }} />
                  ))}
                </div>
              ) : (
                <div className="bg-[#3a3a3a] p-12 text-center rounded">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No posts yet in this channel</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "polls" && (
            <div className="space-y-6">
              <div className="text-[#E8EAE9] text-xs font-semibold uppercase">
                POLLS
              </div>

              {postsLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-black border border-gray-800 rounded-lg overflow-hidden mb-4"
                    >
                      <div className="bg-[#3a3a3a] p-4">
                        <Skeleton className="h-6 w-1/4 bg-gray-700" />
                      </div>
                      <div className="p-4">
                        <Skeleton className="h-6 w-3/4 mb-4 bg-gray-700" />
                        <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                        <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
                        <Skeleton className="h-4 w-2/3 bg-gray-700" />
                      </div>
                      <div className="border-t border-gray-700 p-4">
                        <Skeleton className="h-8 w-32 bg-gray-700" />
                      </div>
                    </div>
                  ))}
                </>
              ) : bowlPolls && bowlPolls.length > 0 ? (
                <div className="space-y-4">
                  {bowlPolls.map((post) => (
                    <PostCard key={post.id} post={post} onUpdate={() => { }} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#3a3a3a] rounded">
                  <p className="text-gray-400">No polls available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

