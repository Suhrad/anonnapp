import PollCard from "@/components/cards/PollCard";
import PostCard from "@/components/cards/PostCard";
import EmptyBookmarkState from "@/components/empty-states/EmptyBookmarkState";
import { SvgIcon } from "@/components/SvgIcon";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import type { PostWithDetails, PollWithDetails } from "@/types";
import { Bookmark, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TabType = "posts" | "polls" | "users";

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const { isAuthenticated } = useAuth();
  const [savedPolls, setSavedPolls] = useState<PollWithDetails[]>([]);
  const [savedPosts, setSavedPost] = useState<PostWithDetails[]>([]);
  const emptyUpdateCallback = useCallback(() => { }, []);

  const { data: bookmarksData, isLoading: postsLoading } = useApiQuery({
    queryKey: ["user-bookmarks"],
    endpoint: "/api/users/bookmarks",

    select: (data: any) => {
      // Backend returns: { bookmarks: { posts: [...], polls: [...], comments: [...], users: [...] } }
      // apiCall already extracts the 'data' field, so we get { bookmarks: {...} }
      const bookmarks = data?.bookmarks || {};
      const posts = bookmarks.posts || [];
      const polls = bookmarks.polls || [];
      
      // Combine posts and polls with type field for filtering
      return [
        ...posts.map((post: any) => ({ ...post, type: "post" })),
        ...polls.map((poll: any) => ({ ...poll, type: "poll" })),
      ];
    },

    enabled: isAuthenticated,

    on401: "returnNull", // automatically redirects to "/"

    retry: false, // Don't retry on error
  });

  // Separate posts by type when data arrives
  useEffect(() => {
    if (bookmarksData) {
      const polls = bookmarksData.filter((p: any) => p.type === "poll");
      const normalPosts = bookmarksData.filter((p: any) => p.type === "post");
      setSavedPolls(polls);
      setSavedPost(normalPosts);
    } else {
      setSavedPolls([]);
      setSavedPost([]);
    }
  }, [bookmarksData]);

  const getTotalCount = () => {
    switch (activeTab) {
      case "posts":
        return savedPosts.length;
      case "polls":
        return savedPolls.length;
      case "users":
        return 0; // Placeholder
      default:
        return 0;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Bookmark className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-bold mb-2">Sign in to view bookmarks</h2>
          <p className="text-gray-400">
            Please sign in to see your saved posts and polls.
          </p>
        </div>
      </div>
    );
  }

  const isLoading =
    (activeTab === "posts" && postsLoading) ||
    (activeTab === "polls" && postsLoading);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div>
        {/* Tabs */}
        <div className="flex  gap-3 mb-6">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex text-[#525252] items-center gap-2 px-4 h-[40px] sm:px-6  rounded-[56px] text-xs font-medium transition-all w-full sm:w-auto justify-center ${activeTab === "posts"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:text-[#E8EAE9]"
              }`}
          >
            <SvgIcon
              src="/icons/Post option icon.svg"
              color={activeTab === "posts" ? "text-[#525252]" : ""}
              forceFill={activeTab === "posts"}
            />
            POSTS
          </button>
          <button
            onClick={() => setActiveTab("polls")}
            className={`flex text-[#525252] items-center gap-2 px-4 h-[40px] sm:px-6  rounded-[56px] text-xs font-medium transition-all w-full sm:w-auto justify-center ${activeTab === "polls"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:text-[#E8EAE9]"
              }`}
          >
            <SvgIcon
              src="/icons/Polls icon.svg"
              color={activeTab === "polls" ? "text-[#525252]" : ""}
              forceFill={activeTab === "polls"}
            />
            POLLS
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex text-[#525252] items-center gap-2 px-4 h-[40px] sm:px-6  rounded-[56px] text-xs font-medium transition-all w-full sm:w-auto justify-center ${activeTab === "users"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:text-[#E8EAE9]"
              }`}
          >
            <SvgIcon
              src="/icons/Profile icon.svg"
              color={activeTab === "users" ? "text-[#525252]" : ""}
              forceFill={activeTab === "users"}
            />
            USERS
          </button>
        </div>

        {/* Total Count */}
        <div className="flex items-center justify-center mb-6 h-[40px]">
          <p className="text-[#525252] text-sm font-medium">
            [ {getTotalCount()} TOTAL ]
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "posts" && (
              <>
                {savedPosts.length > 0 ? (
                  savedPosts.map((post: PostWithDetails) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onUpdate={emptyUpdateCallback}
                    />
                  ))
                ) : (
                  <EmptyBookmarkState />
                )}
              </>
            )}

            {activeTab === "polls" && (
              <>
                {savedPolls.length > 0 ? (
                  savedPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll as PollWithDetails} onUpdate={() => { }} />
                  ))
                ) : (
                  <EmptyBookmarkState />
                )}
              </>
            )}

            {activeTab === "users" && (
              <div className="text-center py-12">
                <Bookmark className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  User bookmarks coming soon
                </h3>
                <p className="text-gray-500">
                  This feature is under development
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


