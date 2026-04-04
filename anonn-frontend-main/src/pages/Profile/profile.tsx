import { InfiniteScrollSkeleton } from "@/components/loaders/InfiniteScrollLoader";
import PostLoader from "@/components/loaders/PostLoader";
import ProfileComments from "@/components/profile/ProfileComments";
import ProfileCommunity from "@/components/profile/ProfileCommunity";
import ProfilePosts from "@/components/profile/ProfilePosts";
import Whistle from "@/components/profile/whistle";
import { SvgIcon } from "@/components/SvgIcon";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import type { CommentWithDetails, PollWithDetails, PostWithDetails, User } from "@/types";
import { BarChart3, Menu, MessageSquare, Users, X } from "lucide-react";
import { useState } from "react";

type TabType = "whistle" | "posts" | "polls" | "community" | "comments";

const activityRows = [
  {
    src: "@/icons/Profile icon.svg",
    text: "invite others",
    value: "100",
  },
  {
    src: "@/icons/Polls icon.svg",
    text: "create poll",
    value: "20",
  },
  {
    src: "@/icons/Companies icon.svg",
    text: "rate company",
    value: "50",
  },
  {
    src: "@/icons/Comments icon.svg",
    text: "comment received/given",
    value: "10",
  },
  {
    src: "@/icons/up-vote.svg",
    text: "upvote received/given",
    value: "5",
  },
  {
    src: "@/icons/down-vote.svg",
    text: "downvote received/given",
    value: "5",
  },
  {
    src: "@/icons/Post-share.svg",
    text: "share post/poll",
    value: "10",
  },
  {
    src: "@/icons/Bookmark-sidebar.svg",
    text: "bookmark received/given",
    value: "5",
  },
];

type UserPostsResponse = {
  posts: PostWithDetails[];
  polls: PollWithDetails[];
};

export default function ProfilePage() {
  const {
    dbProfile,
    isAuthenticated: authIsAuthenticated,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get MongoDB _id from dbProfile (if available) or fetch current user profile
  const { data: currentUserProfile } = useApiQuery<User>({
    queryKey: ["/api/auth/me"],
    endpoint: "auth/me",
    enabled: authIsAuthenticated && !dbProfile?._id && !dbProfile?.id,
    on401: "returnNull",
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    select: (data: any) => data?.user || data,
  });

  // Use MongoDB _id from dbProfile or fetched profile (prioritize _id over id)
  const userId = dbProfile?._id || currentUserProfile?._id || dbProfile?.id || currentUserProfile?.id;

  // Data states - replacing dummy data with real data
  // const [userPosts, setUserPosts] = useState<PostWithDetails[]>([]);


  // const fetchUserPosts = useCallback(async () => {
  //   setIsLoadingData(true);
  //   try {
  //     const token = await getAccessToken();
  //     if (!token) {
  //       console.error("[fetchUserPosts] No access token available");
  //       setUserPosts([]);
  //       return;
  //     }

  //     // Use the posts/own endpoint for authenticated user's own posts
  //     const response = await fetch("/api/post/own", {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         "Content-Type": "application/json",
  //       },
  //       credentials: "include",
  //     });

  //     if (response.ok) {
  //       const posts = await response.json();
  //       const userPolls = posts.filter((poll: any) => poll.type === "poll");
  //       setUserPolls(userPolls);
  //       setUserPosts(posts);
  //     } else {
  //       const errorData = await response.json().catch(() => ({}));
  //       console.error(
  //         "Failed to fetch user posts:",
  //         response.status,
  //         errorData
  //       );
  //       setUserPosts([]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching user posts:", error);
  //     setUserPosts([]);
  //   } finally {
  //     setIsLoadingData(false);
  //   }
  // }, [authIsAuthenticated, user?.id, getAccessToken]);

  // // Fetch user's comments
  // const fetchUserComments = useCallback(async () => {
  //   setIsLoadingData(true);
  //   try {
  //     const token = await getAccessToken();
  //     if (!token) return;

  //     // Use the comments/own endpoint for authenticated user's own comments
  //     const response = await fetch("/api/comments/own", {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         "Content-Type": "application/json",
  //       },
  //       credentials: "include",
  //     });

  //     if (response.ok) {
  //       const comments = await response.json();
  //       setUserComments(comments);
  //     } else {
  //       console.error("Failed to fetch user comments:", response.status);
  //       setUserComments([]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching user comments:", error);
  //     setUserComments([]);
  //   } finally {
  //     setIsLoadingData(false);
  //   }
  // }, [authIsAuthenticated, user?.id, getAccessToken]);

  // // Fetch user's followed communities
  // const fetchUserCommunities = useCallback(async () => {
  //   setIsLoadingData(true);

  //   try {
  //     const token = await getAccessToken();
  //     if (!token) return;

  //     // Get user's followed bowls
  //     const response = await fetch("/api/user/bowls", {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //         "Content-Type": "application/json",
  //       },
  //       credentials: "include",
  //     });

  //     if (response.ok) {
  //       const follows = await response.json();
  //       // Extract bowl details from follows
  //       const communityPromises = follows.map(async (follow: any) => {
  //         const bowlResponse = await fetch(`/api/bowls/${follow.bowlId}`, {
  //           headers: {
  //             Authorization: `Bearer ${token}`,
  //           },
  //         });
  //         if (bowlResponse.ok) {
  //           return bowlResponse.json();
  //         }
  //         return null;
  //       });

  //       const communities = (await Promise.all(communityPromises)).filter(
  //         Boolean
  //       );
  //       setUserCommunities(communities);
  //     } else {
  //       setUserCommunities([]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching user communities:", error);
  //     setUserCommunities([]);
  //   } finally {
  //     setIsLoadingData(false);
  //   }
  // }, [authIsAuthenticated, user?.id, getAccessToken]);

  const {
    data: userPostsData,
    isLoading: isLoadingPosts,
    refetch: refetchPosts,
  } = useApiQuery<UserPostsResponse>({
    queryKey: ["posts", userId, activeTab],
    endpoint: "posts",
    params: userId ? { author: userId } : {},
    enabled: !!userId && (activeTab === "posts" || activeTab === "polls"),
    on401: "returnNull",
    retry: false,
    staleTime: 0, // Allow refetching when tab changes

    select: (data: any) => {
      const allItems = data?.posts || [];
      // Separate polls from posts
      const polls = allItems.filter((p: any) => p.type === "poll");
      const posts = allItems.filter((p: any) => p.type !== "poll");
      return { posts, polls };
    },
  });

  const {
    data: userComments = [],
    isLoading: isLoadingComments,
    refetch: _refetchComments,
  } = useApiQuery<CommentWithDetails[]>({
    queryKey: ["comments", userId, activeTab],
    endpoint: "comments",
    params: userId ? { author: userId } : {},
    enabled: !!userId && activeTab == "comments",
    on401: "returnNull",
    retry: false,
    staleTime: 0, // Allow refetching when tab changes
    select: (data: any) => {
      // backend paginatedResponse stores items in 'posts' key
      const comments = data?.posts || [];
      // Transform comments to match frontend type structure
      return comments.map((comment: any) => ({
        ...comment,
        id: comment._id || comment.id,
        authorId: comment.author?._id || comment.author || comment.authorId,
        postId: comment.post?._id || comment.post || null,
        pollId: comment.poll?._id || comment.poll || null,
        parentId: comment.parentComment?._id || comment.parentComment || comment.parentId || null,
        upvotes: Array.isArray(comment.upvotes) ? comment.upvotes.length : (comment.upvotes || 0),
        downvotes: Array.isArray(comment.downvotes) ? comment.downvotes.length : (comment.downvotes || 0),
      }));
    },
  });

  const {
    data: userCommunities = [],
    isLoading: isLoadingCommunities,
  } = useApiQuery({
    queryKey: ["user-bowls", userId, activeTab],
    endpoint: "/api/users/bowls",
    enabled: authIsAuthenticated && activeTab == "community",
    on401: "returnNull",
    retry: false,
    staleTime: 0, // Allow refetching when tab changes
    select: (data: any) => {
      // Backend returns: { bowls: [...] }
      return data?.bowls || [];
    },
  });

  // Fetch all data when component mounts or tab changes
  // useEffect(() => {
  //   if (!authIsAuthenticated) return;

  //   switch (activeTab) {
  //     case "posts":
  //     case "polls":
  //       refetchPosts();
  //       break;

  //     case "comments":
  //       refetchComments();
  //       break;

  //     case "community":
  //       refetchCommunities();
  //       break;
  //   }
  // }, [activeTab, authIsAuthenticated]);

  // Render tab content with real data
  const renderTabContent = () => {
    if (activeTab === "whistle") {
      return <Whistle activityRows={activityRows} />;
    }

    if (activeTab === "posts") {
      return isLoadingPosts ? (
        <PostLoader />
      ) : (
        <ProfilePosts
          userPosts={userPostsData?.posts ?? []}
          fetchUserPosts={refetchPosts}
        />
      );
    }

    if (activeTab === "polls") {
      return isLoadingPosts ? (
        <PostLoader />
      ) : (
        <ProfilePosts
          userPosts={userPostsData?.polls ?? []}
          fetchUserPosts={refetchPosts}
        />
      );
    }

    if (activeTab === "community") {
      return isLoadingCommunities ? (
        <div className="space-y-4">
          <InfiniteScrollSkeleton count={5} />
        </div>
      ) : (
        <ProfileCommunity userCommunities={userCommunities} />
      );
    }

    if (activeTab === "comments") {
      return isLoadingComments ? (
        <div className="space-y-4">
          <InfiniteScrollSkeleton count={5} />
        </div>
      ) : (
        <ProfileComments userComments={userComments} />
      );
    }

    return null;
  };

  const TabButton = ({
    tab,
    children,
    icon,
  }: {
    tab: TabType;
    children: React.ReactNode;
    icon: string;
  }) => (
    <button
      onClick={() => {
        setActiveTab(tab);
        setMobileMenuOpen(false);
      }}
      className={`flex text-[#525252] items-center gap-2 px-4 h-[40px] sm:px-6  rounded-[56px] text-xs font-medium transition-all w-full sm:w-auto justify-center ${activeTab === tab ? "bg-[#E8EAE9]" : "bg-[#1B1C20] hover:text-[#E8EAE9]"
        }`}
    >
      <SvgIcon
        src={icon}
        color={activeTab === tab ? "text-[#525252]" : ""}
        forceFill={activeTab === tab}
      />
      {children}
    </button>
  );

  // Keep all the existing UI code exactly as it was
  return (
    <div className="max-w-[1400px] mx-auto">
      <div>
        {/* Mobile Menu Button */}
        <div className="sm:hidden px-4 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-white text-lg font-medium">Profile</h2>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400 hover:text-white p-2"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden scrollbar-hide sm:flex items-center gap-2 sm:gap-4 md:px-0 sm:px-6 pb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("whistle")}
            className={`flex items-center gap-2 px-4 sm:px-6 h-[40px] rounded-[56px] text-xs font-medium transition-all flex-shrink-0 ${activeTab === "whistle"
              ? "bg-[linear-gradient(117deg,#A0D9FF_-0.07%,#E8EAE9_99.93%)] text-[#0086C9]"
              : "bg-[#1B1C20] text-[#A0D9FF] hover:text-[#a4d9fb]"
              }`}
          >
            <SvgIcon src="@/icons/Profile-logo.svg" />
            WHISTLE
          </button>

          <TabButton tab="posts" icon="@/icons/Post option icon.svg">
            POSTS
          </TabButton>

          <TabButton tab="polls" icon="@/icons/Polls icon.svg">
            POLLS
          </TabButton>

          <TabButton tab="community" icon="@/icons/profile-community.svg">
            COMMUNITY
          </TabButton>

          <TabButton tab="comments" icon="@/icons/message.svg">
            COMMENTS
          </TabButton>
        </nav>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-[#1a1a1a] border-b border-gray-700 p-4 space-y-2">
            <button
              onClick={() => {
                setActiveTab("whistle");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all w-full ${activeTab === "whistle"
                ? "bg-blue-400 text-black"
                : "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              </svg>
              WHISTLE
            </button>

            <button
              onClick={() => {
                setActiveTab("posts");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all w-full ${activeTab === "posts"
                ? "bg-white text-black"
                : "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <MessageSquare className="w-5 h-5" />
              POSTS
            </button>

            <button
              onClick={() => {
                setActiveTab("polls");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all w-full ${activeTab === "polls"
                ? "bg-white text-black"
                : "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <BarChart3 className="w-5 h-5" />
              POLLS
            </button>

            <button
              onClick={() => {
                setActiveTab("community");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all w-full ${activeTab === "community"
                ? "bg-white text-black"
                : "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <Users className="w-5 h-5" />
              COMMUNITY
            </button>

            <button
              onClick={() => {
                setActiveTab("comments");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all w-full ${activeTab === "comments"
                ? "bg-white text-black"
                : "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
            >
              <MessageSquare className="w-5 h-5" />
              COMMENTS
            </button>
          </div>
        )}

        <div className="bg-[#0a0a0a]">{renderTabContent()}</div>
      </div>
    </div>
  );
}
