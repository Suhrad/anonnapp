// components/OrganizationContent.tsx
import PostCard from "@/components/cards/PostCard";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import type {
  OrganizationWithStats,
  PollWithDetails,
  PostWithDetails,
} from "@/types";
import {
  BarChart3,
  MessageSquare,
  PenSquare,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import ProfileIcon from "@/icons/Profile icon.svg";
import PollIcon from "@/icons/Polls icon.svg";
import PostIcon from "@/icons/Comments icon.svg";

type TabType = "about" | "posts" | "polls" | "comments";

export default function OrganizationContent() {
  const emptyUpdateCallback = useCallback(() => { }, []);
  const params = useParams();
  const [, setLocation] = useLocation();
  const idParam = (params.id as string) || "";
  const { isAuthenticated: _isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("about");

  // Fetch organization by ID or name
  // const {
  //   data: organization,
  //   isLoading: orgLoading,
  //   error: orgError,
  // } = useRQ<OrganizationWithStats>({
  //   queryKey: ["/api/organizations", idParam],
  //   queryFn: async () => {
  //     // First try to fetch by ID if it's a number
  //     if (!isNaN(parseInt(idParam))) {
  //       const response = await fetch(`/api/organizations/${idParam}`, {
  //         credentials: "include",
  //       });
  //       if (response.ok) {
  //         return response.json();
  //       }
  //     }

  //     // If ID fetch fails or it's not a number, try searching by name
  //     const searchResponse = await fetch(
  //       `/api/organizations/search?q=${encodeURIComponent(idParam)}`,
  //       {
  //         credentials: "include",
  //       }
  //     );
  //     if (!searchResponse.ok) {
  //       throw new Error(`Organization not found: ${searchResponse.status}`);
  //     }

  //     const organizations = await searchResponse.json();
  //     const exactMatch = organizations.find(
  //       (org: any) => org.name.toLowerCase() === idParam.toLowerCase()
  //     );

  //     if (!exactMatch) {
  //       throw new Error("Organization not found");
  //     }
  //     return exactMatch;
  //   },
  //   enabled: !!idParam,
  //   retry: (failureCount, error) => {
  //     if (isUnauthorizedError(error)) {
  //       window.location.href = "/auth";
  //       return false;
  //     }
  //     return failureCount < 3;
  //   },
  // });

  // console.log("org", organization);

  // // Fetch posts for this organization
  // const { data: allPosts = [], isLoading: postsLoading } = useRQ<
  //   PostWithDetails[]
  // >({
  //   queryKey: ["/api/posts", { organizationId: organization?.id }],
  //   queryFn: async () => {
  //     if (!organization?.id) throw new Error("Organization not loaded");
  //     const response = await fetch(
  //       `/api/posts?organizationId=${organization.id}`,
  //       {
  //         credentials: "include",
  //       }
  //     );
  //     if (!response.ok) {
  //       throw new Error(`${response.status}: ${response.statusText}`);
  //     }
  //     return response.json();
  //   },
  //   enabled: !!organization?.id,
  //   retry: (failureCount, error) => {
  //     if (isUnauthorizedError(error)) {
  //       window.location.href = "/auth";
  //       return false;
  //     }
  //     return failureCount < 3;
  //   },
  // });
  // console.log("orgPost", allPosts);

  // // Fetch polls for this organization
  // const { data: polls = [], isLoading: pollsLoading } = useRQ<any[]>({
  //   queryKey: ["/api/polls", { organizationId: organization?.id }],
  //   queryFn: async () => {
  //     if (!organization?.id) throw new Error("Organization not loaded");
  //     const response = await fetch(
  //       `/api/polls?organizationId=${organization.id}`,
  //       {
  //         credentials: "include",
  //       }
  //     );
  //     if (!response.ok) {
  //       throw new Error(`${response.status}: ${response.statusText}`);
  //     }
  //     return response.json();
  //   },
  //   enabled: !!organization?.id,
  //   retry: (failureCount, error) => {
  //     if (isUnauthorizedError(error)) {
  //       window.location.href = "/auth";
  //       return false;
  //     }
  //     return failureCount < 3;
  //   },
  // });

  // 1️⃣ Create a helper function for the fallback search
  // async function fetchOrganizationFallback(idParam: string) {
  //   const organizations = await apiCall<any[]>({
  //     endpoint: `organizations/search?q=${encodeURIComponent(idParam)}`,
  //     method: "GET",
  //     on401: "returnNull",
  //   });

  //   const exactMatch = organizations.find(
  //     (org: any) => org.name.toLowerCase() === idParam.toLowerCase()
  //   );

  //   if (!exactMatch) throw new Error("Organization not found");

  //   return exactMatch;
  // }

  // 2️⃣ Use it inside your select
  const {
    data: organization,
    isLoading: orgLoading,
    error: orgError,
  } = useApiQuery<OrganizationWithStats | null>({
    queryKey: ["/api/companies", idParam],
    endpoint: `companies/${idParam}`,
    enabled: !!idParam,
    retry: false,
    on401: "returnNull",

    select: (data: any) => data?.company || data,
  });

  // Fetch combined feed for the company (top posts, all polls, all posts)
  const { data: feedData, isLoading: feedLoading } = useApiQuery<{
    topPosts: PostWithDetails[];
    polls: PollWithDetails[];
    posts: PostWithDetails[];
    pagination?: {
      polls?: {
        totalItems: number;
        totalPages: number;
      };
      posts?: {
        totalItems: number;
        totalPages: number;
      };
    };
  }>({
    queryKey: ["/api/companies", idParam, "feed"],
    endpoint: `companies/${idParam}/feed`,
    enabled: !!idParam,
    on401: "returnNull",
    retry: false,
    select: (data: any) => {
      // Handle response format
      if (data?.data) {
        return {
          topPosts: data.data.topPosts || [],
          polls: data.data.polls || [],
          posts: data.data.posts || [],
          pagination: data.data.pagination,
        };
      }
      return {
        topPosts: data?.topPosts || [],
        polls: data?.polls || [],
        posts: data?.posts || [],
        pagination: data?.pagination,
      };
    },
  });

  // Extract data from feed response
  const allPosts = feedData?.posts || [];
  const polls = feedData?.polls || [];
  const topReviewsData = feedData?.topPosts || [];
  const postsLoading = feedLoading;
  const pollsLoading = feedLoading;
  const topReviewsLoading = feedLoading;

  // Get the author count, fallback to followerCount if not available
  const memberCount = useMemo(() => {
    return organization?.authorCount !== undefined 
      ? organization.authorCount 
      : organization?.followerCount ?? 0;
  }, [organization?.authorCount, organization?.followerCount]);

  const posts = allPosts.filter(
    (post) => post.type !== "poll" && post.type !== "review"
  );

  // Get trust percentages from post statistics
  const getTrustPercentage = () => {
    // Use positivePosts and negativePosts from the organization data
    if (organization?.positivePosts !== undefined && organization?.negativePosts !== undefined) {
      const totalPosts = organization.positivePosts + organization.negativePosts;
      if (totalPosts > 0) {
        // Calculate trust percentage based on positive vs negative posts
        const trustPercentage = Math.round(
          (organization.positivePosts / totalPosts) * 100
        );
        const distrustPercentage = 100 - trustPercentage;
        return {
          trust: trustPercentage,
          distrust: distrustPercentage,
          positivePosts: organization.positivePosts,
          negativePosts: organization.negativePosts,
        };
      }
    }

    // Fallback to existing trustData if available
    if (organization?.trustData?.trustPercentage !== undefined) {
      return {
        trust: organization.trustData.trustPercentage,
        distrust: 100 - organization.trustData.trustPercentage,
        positivePosts: organization?.positivePosts,
        negativePosts: organization?.negativePosts,
      };
    }

    // Default fallback
    return { 
      trust: 50, 
      distrust: 50,
      positivePosts: organization?.positivePosts,
      negativePosts: organization?.negativePosts,
    };
  };

  // Handle organization not found
  if (orgError && !orgLoading) {
    return (
      <div className="w-full min-h-screen bg-black text-white px-4 pt-6 pb-6 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-3">Organization not found</h3>
          <p className="text-gray-400 mb-6">
            The organization "{idParam}" doesn't exist or you don't have access.
          </p>
          <Button
            onClick={() => setLocation("/organizations")}
            className="bg-green-500 hover:bg-green-600"
          >
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  if (authLoading || orgLoading) {
    return (
      <div className="w-full min-h-screen bg-black text-white px-4 pt-6 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="h-10 w-32 bg-gray-800 rounded animate-pulse mb-6"></div>
          <div className="h-64 bg-gray-800 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="w-full min-h-screen bg-black text-white px-4 pt-6 pb-6 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-3">Organization not found</h3>
          <Button
            onClick={() => setLocation("/organizations")}
            className="bg-green-500 hover:bg-green-600"
          >
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const trustScores = getTrustPercentage();

  return (
    <div className="flex max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-6 mt-9 min-w-[200px] mx-auto lg:mx-0">
        {/* Tabs */}
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
          <button
            onClick={() => setActiveTab("comments")}
            className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${activeTab === "comments"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
              }`}
          >
            COMMENTS
          </button>
        </div>

        {/* Content */}
        {activeTab === "about" && (
          <div className="space-y-6">
            {/* Organization Header */}
            <div className="flex items-center justify-between">
              {/* Left: Logo and Name */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0">
                  <img src={organization.logo || "/default-logo.png"} alt={organization.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-[#E8EAE9] text-xl font-mono">
                  {organization.name}
                </div>
              </div>

              {/* Right: Action Icons */}
              <div className="flex border-[0.2px] border-[#525252]/30">
                <div className="flex py-3 px-6 gap-2 items-center border-r-[0.2px] border-[#525252]/30">
                  <img
                    src={ProfileIcon}
                    alt="profile icon"
                    className="h-3 w-3"
                  />
                  <span className="text-[#525252] text-xs">
                    {memberCount}
                  </span>
                </div>
                <div className="flex  py-3 px-6 gap-2 items-center border-r-[0.2px] border-[#525252]/30">
                  <img
                    src={PostIcon}
                    alt="post icon"
                    className="h-3 w-3 text-[#525252]"
                  />
                  <span className="text-[#525252] text-xs">
                    {organization.postCount}
                  </span>
                </div>
                <div className="flex py-3 px-6 gap-2 items-center">
                  <img src={PollIcon} alt="poll icon" className="h-3 w-3" />
                  <span className="text-[#525252] text-xs">
                    {organization.pollCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full h-10 md:h-12 bg-gray-800 overflow-hidden flex">
              {/* Green section */}
              {trustScores.trust > 0 && (
                <div
                  className="flex items-center justify-center bg-[#ABEFC6] text-[#079455] font-semibold text-[10px] sm:text-xs px-1"
                  style={{ width: `${trustScores.trust}%` }}
                >
                  <span className="whitespace-nowrap">
                    {trustScores.trust}%
                    {trustScores.positivePosts !== undefined && (
                      <span className="ml-1 opacity-80">
                        ({trustScores.positivePosts})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Divider - only show when both sections are visible */}
              {trustScores.trust > 0 && trustScores.distrust > 0 && (
                <div className="w-[2px] bg-gray-900 h-full"></div>
              )}

              {/* Red section */}
              {trustScores.distrust > 0 && (
                <div
                  className="flex items-center justify-center bg-[#FDA29B] text-[#D92D20] font-semibold text-[10px] sm:text-xs px-1"
                  style={{ width: `${trustScores.distrust}%` }}
                >
                  <span className="whitespace-nowrap">
                    {trustScores.distrust}%
                    {trustScores.negativePosts !== undefined && (
                      <span className="ml-1 opacity-80">
                        ({trustScores.negativePosts})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {organization.description || ""}
            </p>

            {/* INSIDERS Section */}
            <div className="mb-6">
              <h3 className="text-[#E8EAE9] text-xs font-medium mb-6 uppercase">
                INSIDERS
              </h3>
              <div className="flex gap-6 flex-wrap">
                {organization.insiders && organization.insiders.length > 0 ? (
                  organization.insiders.map((insider, index) => (
                    <div
                      key={insider.name || index}
                      className="flex flex-col items-center border border-[#525252]/30 p-4 rounded"
                    >
                      <div className="w-16 h-16 bg-[#fb923c] rounded mb-2 flex-shrink-0"></div>
                      <span className="text-[#E8EAE9] text-xs">{insider.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#8E8E93]">No insider yet</div>
                )}
              </div>
            </div>

            {/* TOP REVIEWS Section */}
            <div className="mb-6">
              <h3 className="text-[#E8EAE9] text-xs font-medium mb-6 uppercase">
                TOP REVIEWS
              </h3>
              {topReviewsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-32 bg-gray-800 rounded animate-pulse"
                    ></div>
                  ))}
                </div>
              ) : topReviewsData && topReviewsData.length > 0 ? (
                <div className="space-y-4">
                  {topReviewsData.map((review: PostWithDetails) => (
                    <div key={review.id}>
                      <PostCard post={review} onUpdate={emptyUpdateCallback} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#8E8E93]">No reviews yet</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "posts" && (
          <div className="space-y-6">
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-32 bg-gray-800 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-6">
                {posts.map((post: PostWithDetails) => (
                  <div
                    key={post.id}
                    className="bg-[#1a1a1a] border border-gray-800"
                  >
                    <PostCard post={post} onUpdate={emptyUpdateCallback} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#1a1a1a]">
                <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No posts yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Be the first to create a post!
                </p>
                <Button
                  onClick={() =>
                    setLocation(
                      `/create-post?organizationId=${organization.id}`
                    )
                  }
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <PenSquare className="h-4 w-4 mr-2" />
                  Create First Post
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "polls" && (
          <div className="space-y-6">
            {pollsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-48 bg-gray-800 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            ) : polls.length > 0 ? (
              <div className="space-y-6">
                {polls.map((poll: any) => (
                  <div key={poll.id} className="bg-[#1a1a1a] p-6">
                    <h3 className="text-sm font-normal text-[#E8EAE9] mb-2">
                      {poll.question}
                    </h3>
                    <p className="text-[#E8EAE9] mb-4 text-xs">
                      {poll.description}
                    </p>
                    <div className="space-y-2">
                      {poll.options?.map((option: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded"
                        >
                          <span className="text-xs text-[#8E8E93]">
                            {option.text}
                          </span>
                          <span className="text-xs text-[#8E8E93]">
                            {option.voteCount || 0} votes
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#1a1a1a]">
                <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No polls yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Be the first to create a poll!
                </p>
                <Button
                  onClick={() =>
                    setLocation(
                      `/create-post?organizationId=${organization.id}&type=poll`
                    )
                  }
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Create First Poll
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Comments</h3>
            <div className="text-center py-12 bg-[#1a1a1a]">
              <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Comments feature coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
