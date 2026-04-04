
import { InfiniteScrollSkeleton } from "@/components/loaders/InfiniteScrollLoader";
import PostLoader from "@/components/loaders/PostLoader";
import ProfileComments from "@/components/profile/ProfileComments";
import ProfileCommunity from "@/components/profile/ProfileCommunity";
import ProfilePosts from "@/components/profile/ProfilePosts";
import { SvgIcon } from "@/components/SvgIcon";
import { useApiQuery } from "@/hooks/useApiQuery";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import type { CommentWithDetails, PostWithDetails, User } from "@/types";
import { useState } from "react";
import { useParams } from "wouter";

type TabType = "posts" | "polls" | "community" | "comments";

type UserPostsResponse = {
    posts: PostWithDetails[];
    polls: PostWithDetails[]; // Using PostWithDetails as polls share structure or similar
};

export default function UserProfile() {
    const { username } = useParams();
    const [activeTab, setActiveTab] = useState<TabType>("posts");

    // Fetch User Info
    const { data: user, isLoading: userLoading } = useApiQuery<User>({
        queryKey: ["/api/users", username || ""],
        endpoint: `users/${username}`,
        enabled: !!username,
        on401: "returnNull",
        retry: false,
        select: (data: any) => data?.user || data,
    });

    const {
        data: userPostsData,
        isLoading: isLoadingPosts,
        refetch: refetchPosts,
    } = useApiQuery<UserPostsResponse>({
        queryKey: ["posts", user?.id, activeTab],
        endpoint: "posts",
        params: { author: user?.id || "" },
        enabled: !!user?.id && (activeTab === "posts" || activeTab === "polls"),
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
    } = useApiQuery<CommentWithDetails[]>({
        queryKey: ["comments", user?.id, activeTab],
        endpoint: "comments",
        params: { author: user?.id || "" },
        enabled: !!user?.id && activeTab === "comments",
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
        queryKey: ["user-bowls", user?.id, activeTab],
        endpoint: `users/${user?.id}`,
        enabled: !!user?.id && activeTab === "community",
        on401: "returnNull",
        retry: false,
        staleTime: 0, // Allow refetching when tab changes
        select: (data: any) => {
            // Backend returns: { user: { joinedBowls: [...] } }
            const userData = data?.user || data;
            return userData?.joinedBowls || [];
        },
    });

    if (userLoading) return <div className="text-white text-center mt-10">Loading profile...</div>;
    if (!user) return <div className="text-white text-center mt-10">User not found</div>;

    const renderTabContent = () => {
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
            onClick={() => setActiveTab(tab)}
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

    return (
        <div className="max-w-[1400px] mx-auto">
            {/* Profile Header */}
            <div className="py-8 flex items-center gap-4 border-b border-[#262626] mb-6">
                <div className="w-20 h-20 rounded bg-gray-700 overflow-hidden">
                    <img src={user.avatar || DEFAULT_PROFILE_PICTURE} alt={user.username} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white">{user.username}</h1>
                            <p className="text-gray-400 text-sm">u/{user.username}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <SvgIcon
                                src="/icons/star.svg"
                                className="text-[#60A5FA] shrink-0"
                                alt="stars"
                                forceFill
                            />
                            <span className="text-sm text-gray-300 font-medium">
                                {user.points?.toLocaleString() || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                {/* Navigation - Desktop */}
                <nav className="hidden scrollbar-hide sm:flex items-center gap-2 sm:gap-4 md:px-0 sm:px-6 pb-6 overflow-x-auto">
                    <TabButton tab="posts" icon="/icons/Post option icon.svg">
                        POSTS
                    </TabButton>

                    <TabButton tab="polls" icon="/icons/Polls icon.svg">
                        POLLS
                    </TabButton>

                    <TabButton tab="community" icon="/icons/profile-community.svg">
                        COMMUNITY
                    </TabButton>

                    <TabButton tab="comments" icon="/icons/message.svg">
                        COMMENTS
                    </TabButton>
                </nav>

                {/* Mobile Navigation - Simplified */}
                <div className="sm:hidden flex gap-2 overflow-x-auto pb-4 mb-4">
                    <TabButton tab="posts" icon="/icons/Post option icon.svg">POSTS</TabButton>
                    <TabButton tab="polls" icon="/icons/Polls icon.svg">POLLS</TabButton>
                    <TabButton tab="community" icon="/icons/profile-community.svg">COMMUNITY</TabButton>
                    <TabButton tab="comments" icon="/icons/message.svg">COMMENTS</TabButton>
                </div>

                <div className="bg-[#0a0a0a]">{renderTabContent()}</div>
            </div>
        </div>
    );
}
