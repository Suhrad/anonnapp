import CommentForm from "@/components/Comments/CommentForm";
import CommentReply from "@/components/Comments/CommentReply";
import ShareButton from "@/components/Comments/ShareButton";
import VoteButtons from "@/components/Comments/VoteButtons";
import {
  InfiniteScrollLoader,
  InfiniteScrollSkeleton,
} from "@/components/loaders/InfiniteScrollLoader";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { SvgIcon } from "@/components/SvgIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { useInfiniteComments } from "@/hooks/useInfiniteScroll";
import { formatTimeAgo } from "@/lib/utils";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import type { PostWithDetails } from "@/types";
import QuotedMarketEmbed from "@/components/markets/QuotedMarketEmbed";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, MoreHorizontal, Trash } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import LikeIcon from "@/icons/Post like icon.svg";
import { apiCall } from "@/lib/api";
import { toast } from "sonner";

export default function PostContent() {
  const [_location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showComments, _setShowComments] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Get post ID from URL
  const postId = new URLSearchParams(window.location.search).get("id");

  const {
    data: post,
    isLoading: postLoading,
    refetch,
  } = useApiQuery<PostWithDetails>({
    queryKey: ["post", postId ?? ""],
    endpoint: `posts/${postId}`,
    // enabled: !!postId && isAuthenticated,
    select: (response: any) => {
      // Handle different response structures
      let postData = response;
      if (response?.data) {
        postData = response.data.post || response.data;
      } else if (response?.post) {
        postData = response.post;
      }
      
      // Map bias to sentiment if sentiment is not present (API might return bias instead of sentiment)
      if (postData) {
        // Use bias if sentiment is missing, or use sentiment if it exists
        if (!postData.sentiment && postData.bias) {
          postData.sentiment = postData.bias;
        } else if (postData.sentiment && !postData.bias) {
          // Ensure both fields are set for consistency
          postData.bias = postData.sentiment;
        }
      }
      return postData;
    },
    onError: (error) => {
      console.error("Failed to fetch post:", error);
    },
  });

  // === BOOKMARK STATE ===
  const [isSaved, setIsSaved] = useState(false);

  // Check if post is saved
  const { data: bookmarksData, isLoading: bookmarksLoading } = useApiQuery<any>({
    endpoint: "/api/users/bookmarks",
    queryKey: ["user-bookmarks"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated || !user || bookmarksLoading) {
      setIsSaved(false);
      return;
    }
    // apiCall extracts 'data' field, so bookmarksData is { bookmarks: { posts: [...], polls: [...] } }
    const posts = bookmarksData?.bookmarks?.posts || [];
    setIsSaved(posts.some((p: any) => p._id === post?.id || p.id === post?.id));
  }, [isAuthenticated, user, bookmarksData, bookmarksLoading, post?.id]);

  // === BOOKMARK MUTATION ===
  const bookmarkMutation = useApiMutation({
    endpoint: "/api/users/bookmarks",
    method: "POST",
    onSuccess: () => {
      setIsSaved(!isSaved);
      toast.success(isSaved ? "Post unsaved" : "Post saved!");
      queryClient.invalidateQueries({ queryKey: ["user-bookmarks"] });
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
    },
    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to update bookmark",
      });
    },
  });

  const handleBookmark = () => {
    if (!isAuthenticated) {
      toast.info("Authentication Required", {
        description: "Please connect your wallet to save posts.",
      });
      return;
    }
    if (bookmarkMutation.isPending) return;

    if (isSaved) {
      // Unsave logic
      apiCall({
        endpoint: `/api/users/bookmarks/${post?.id}?type=post`,
        method: "DELETE",
      }).then(() => {
        setIsSaved(false);
        toast.success("Post unsaved");
        queryClient.invalidateQueries({ queryKey: ["user-bookmarks"] });
        // Invalidate user profile points query to update points in sidebar
        queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
      }).catch((err) => {
        toast.error("Error", { description: err.message });
      });
    } else {
      bookmarkMutation.mutate({ type: "post", itemId: post?.id });
    }
  };

  function formatPostTime(dateValue: string | Date | null) {
    if (!dateValue) return "";

    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatPostDate(dateValue: string | Date | null) {
    if (!dateValue) return "";

    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };

    return date
      .toLocaleDateString("en-US", options)
      .toUpperCase()
      .replace(",", "");
  }

  // Fetch comments with infinite scroll
  const {
    items: comments,
    isLoading: commentsLoading,
    hasMore: hasMoreComments,
    error: commentsError,
    loadMore: loadMoreComments,
    refresh: refetchComments,
    setItems: _setComments,
  } = useInfiniteComments(
    async (page: number, limit: number) => {
      if (!postId) throw new Error("No post ID provided");
      const data = await apiCall<any[]>({
        endpoint: `posts/${postId}/comments`,
        method: "GET",
        params: {
          page,
          limit,
        },
      });

      const items = (data as any).comments || [];
      return {
        items,
        hasMore: items.length === limit,
        total: items.length,
      };
    },
    20, // 20 comments per page
    {
      enabled: !!postId,
      threshold: 0.1,
      rootMargin: "100px",
    }
  );

  const queryClient = useQueryClient();


  const deletePost = async () => {
    if (!post) return;
    if (post.authorId !== user?.id) return;
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${await (
            window as any
          ).__getDynamicToken?.()}`,
        },
      });

      if (!res.ok) {
        toast.error("Error", {
          description: "Failed to delete post. Please try again.",
        });
        return;
      }

      // Comprehensive cache invalidation
      console.log("[PostPage] Invalidating queries after post deletion...");

      // Invalidate all post-related queries
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            (key[0] === "posts" ||
              key[0] === "/api/posts" ||
              key[0] === "bowl-posts" ||
              key[0] === "organization-posts")
          );
        },
      });

      // Remove all post-related queries from cache
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            (key[0] === "posts" ||
              key[0] === "/api/posts" ||
              key[0] === "bowl-posts" ||
              key[0] === "organization-posts")
          );
        },
      });

      // Invalidate user profile points query to update points in sidebar
      await queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      // Show success message
      toast.success("Post deleted", {
        description: "Your post has been permanently deleted.",
      });

      // Redirect back to where the user came from, fallback to home
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Error", {
        description: "Failed to delete post. Please try again.",
      });
      // Fallback in case of unexpected error
      setLocation("/");
    }
  };

  const deleteComment = async (commentId: number) => {
    await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${await (window as any).__getDynamicToken?.()}`,
      },
    });
    refetchComments();
  };

  const getAuthorDisplay = () => {
    if (!post) return "";
    if (post.isAnonymous) {
      return "anonymous";
    }

    const author = post.author;
    const username = author?.username || "User";

    // Show company affiliation if user is company verified
    if (author.isCompanyVerified && author.companyName) {
      return `${username} from ${author.companyName}`;
    }

    return username;
  };

  if (authLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full mb-4" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {postLoading ? (
        <Card className="border border-[#525252]/30 shadow-lg rounded-lg">
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-full mb-3" />
              <Skeleton className="h-20 w-full mb-4" />
              <div className="flex items-center space-x-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : post ? (
        <>
          {/* Post Card */}
          <article className=" bg-[rgba(234,234,234,0.02)] overflow-hidden">
            <div className="border-[0.2px] border-[#525252]/30 p-6 flex flex-col gap-6">
              {/* Header Section */}
              <div className=" flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <img
                    src={post.author?.avatar ?? DEFAULT_PROFILE_PICTURE}
                    className="object-cover h-10 w-10"
                  />
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[#8E8E93] text-xs tracking-[.24px] font-normal underline cursor-pointer hover:text-gray-200 transition-colors truncate"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!post.isAnonymous)
                          window.location.href = `/u/${post.author.username}`;
                      }}
                    >
                      {getAuthorDisplay()}
                    </span>

                    <span className="text-[#525252] text-xs tracking-[0.2px]">
                      {formatTimeAgo(post.createdAt || "")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Sentiment Badge and Company Logo */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      // Check both sentiment and bias fields, normalize to lowercase
                      const sentiment = (post.sentiment || (post as any).bias || "").toLowerCase();
                      const isPositive = sentiment === "positive";
                      const isNegative = sentiment === "negative";
                      
                      if (isPositive) {
                        return (
                          <div className="p-1 flex items-center justify-center">
                            <img src={LikeIcon} alt="positive" className="w-5 h-5" />
                          </div>
                        );
                      }
                      if (isNegative) {
                        return (
                          <div className="p-1 flex items-center justify-center">
                            <img
                              src={LikeIcon}
                              alt="negative"
                              className="w-5 h-5 rotate-180"
                              style={{
                                filter:
                                'brightness(0) saturate(100%) invert(21%) sepia(92%) saturate(2200%) hue-rotate(358deg) brightness(95%) contrast(115%)',
                              }}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Company Logo */}
                    {post.companyTags && post.companyTags[0]?.logo && (
                      <div className="h-5 w-5 flex items-center justify-center">
                        <img
                          src={post.companyTags[0].logo}
                          alt="company logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Green Badge with custom icon */}
                  <div className="w-[30px] h-[30px] p-1.5 flex items-center justify-center flex-shrink-0">
                    {post.community?.avatar && (
                      <img src={post.community.avatar} />
                    )}
                  </div>
                  {/* Post Actions Menu (Delete) */}

                  {(() => {
                    return (
                      user?.id &&
                      post.author?.id &&
                      (user.id === post.author.id ||
                        user?.id === post?.author.id.toString()) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-300 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3 rotate-90" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={() => setIsDeleteDialogOpen(true)}
                              className="text-red-600"
                            >
                              <Trash className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    );
                  })()}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="cursor-default flex flex-col gap-6">
                {/* Post Title */}
                <div className="text-base font-normal font-spacemono text-[#E8EAE9] leading-normal">
                  {post.title}
                </div>

                {/* Post Content */}
                <div className="text-[#8E8E93] text-base leading-relaxed">
                  <div className="prose prose-xs max-w-none">
                    <MarkdownRenderer
                      content={post.content}
                      className="text-[#8E8E93]"
                    />
                  </div>
                </div>

                {/* Quoted Market Embed */}
                {post.attachedMarket && typeof post.attachedMarket === "object" && (
                  <QuotedMarketEmbed market={post.attachedMarket as any} mode="feed" />
                )}

                {/* Post Stats */}
                <div className="flex items-center justify-between text-[#525252] text-xs uppercase">
                  <div>{formatPostTime(post?.createdAt)}</div>
                  <div>{formatPostDate(post?.createdAt)}</div>
                </div>

                {/* Attached Image */}
                {(post.mediaUrl || post.imageUrl) && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img
                      src={post.mediaUrl || post.imageUrl}
                      alt="Post attachment"
                      className="w-full max-h-96 object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-x-[0.2px] border-b flex flex-col md:flex-row items-stretch border-[#525252]/30">
              {/* Left Side - Upvote/Downvote with border */}
              <div>
                <VoteButtons
                  targetId={post.id}
                  targetType="post"
                  upvotes={post.upvotes.length}
                  downvotes={post.downvotes.length}
                  userVote={post.userVote}
                  onUpdate={refetch}
                  layout="horizontal"
                  showCount={true}
                />
              </div>

              {/* Spacer to push right items to the end */}
              <div className="flex-1 hidden md:block"></div>

              {/* Right Side - Comments & Bookmark */}
              <div
                className="flex items-stretch "
                onClick={(e) => e.stopPropagation()}
              >
                {/* Bookmark Button */}
                <button
                  aria-label={isSaved ? "Unsave post" : "Save post"}
                  onClick={handleBookmark}
                  disabled={bookmarkMutation.isPending}
                  className={`flex items-center justify-center px-4 py-3 transition-colors hover:bg-gray-800/50 ${isSaved ? "text-blue-500" : "text-white"
                    }`}
                >
                  <SvgIcon
                    src="/icons/Post bookmark icon.svg"
                    color={isSaved ? "text-blue-500" : "text-white"}
                    alt="bookmark"
                  />
                </button>

                {/* Share Button */}
                <ShareButton
                  size="sm"
                  url={window.location.href}
                  title={post.title}
                  description={post.content}
                />
              </div>
            </div>
          </article>

          {/* Comments Section */}
          {showComments && (
            <div className="overflow-hidden">
              {/* Abstract Row (example of same layout as screenshot) */}
              <div className="border-x-[0.2px] border-[#525252]/30 flex items-center justify-center p-6">
                <div className="text-[#525252] text-xs">
                  Express your view about the company
                </div>
              </div>

              {/* Comment Form */}
              <div className="border-[0.2px] border-[#525252]/30 bg-[#0c0c0c]">
                <CommentForm postId={post.id} onSuccess={refetchComments} />
              </div>

              {/* Comments Count */}
              <div className="h-[40px] text-center flex justify-center items-center">
                <div className="text-[#525252] text-xs font-medium">
                  [ {comments?.length || 0} COMMENTS ]
                </div>
              </div>

              {/* Comments List */}
              <div>
                {commentsLoading && comments.length === 0 ? (
                  <InfiniteScrollSkeleton count={3} />
                ) : comments && comments.length > 0 ? (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="transition-colors mb-4 border border-[#525252]/30"
                    >
                      {user?.id &&
                        comment.authorId &&
                        (user.id === comment.authorId ||
                          user.id === comment.authorId.toString()) && (
                          <div className="flex justify-end mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteComment(comment.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </div>
                        )}
                      <CommentReply
                        key={comment.id}
                        comment={comment}
                        postId={post.id}
                        onSuccess={refetchComments}
                        depth={0}
                      />
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">
                      No comments yet. Be the first to comment!
                    </p>
                  </div>
                )}

                {/* Infinite Scroll Loader */}
                <InfiniteScrollLoader
                  isLoading={commentsLoading}
                  hasMore={hasMoreComments}
                  error={commentsError}
                  onRetry={refetchComments}
                  onLoadMore={loadMoreComments}
                  loadingText="Loading more comments..."
                  endText=""
                  errorText="Failed to load more comments"
                />
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your post and remove its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={deletePost}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Card className=" border border-[#525252]/30">
          <CardContent className="p-12 text-center">
            <div className="mb-6">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Post not found
            </h3>
            <p className="text-gray-400 mb-6">
              The post you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
