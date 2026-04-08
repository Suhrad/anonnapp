import MarkdownRenderer from "@/components/MarkdownRenderer";
import QuotedMarketEmbed from "@/components/markets/QuotedMarketEmbed";
import { Button } from "@/components/ui/button";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatTimeAgo } from "@/lib/utils";
import { apiCall } from "@/lib/api";
import {
  calculateOptimisticVoteUpdate,
  cancelVoteQueries,
  invalidateVoteQueries,
  submitVote,
  updatePostInAllCaches,
  type VoteState,
} from "@/lib/voteUtils";
import type { PostWithDetails } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Trash,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { toast } from "sonner";
import { useLocation } from "wouter";
import LikeIcon from "@/icons/Post like icon.svg";

interface PostCardProps {
  post: PostWithDetails;
  onUpdate: () => void;
  compact?: boolean;
  showCommunity?: boolean;
  index?: number;
}

export default function PostCard({
  post,
  onUpdate,
  index = 0,
}: PostCardProps) {
  const postId = post.id || (post as any)._id;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [_location, setLocation] = useLocation();

  // === BOOKMARK STATE ===
  const [isSaved, setIsSaved] = useState(false);

  // Check if post is saved on mount and when user changes
  // Use /api/users/bookmarks to check if post is saved
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
    setIsSaved(posts.some((p: any) => p._id === postId || p.id === postId));
  }, [isAuthenticated, user, postId, bookmarksData, bookmarksLoading]);

  // === BOOKMARK MUTATION ===
  const bookmarkMutation = useMutation({
    mutationFn: async (shouldSave: boolean) => {
      const endpoint = shouldSave
        ? "users/bookmarks"
        : `users/bookmarks/${postId}?type=post`;
      const method = shouldSave ? "POST" : "DELETE";

      return await apiCall({
        endpoint,
        method,
        body: shouldSave ? { type: "post", itemId: postId } : undefined,
      });
    },

    onMutate: async (shouldSave: boolean) => {
      // Optimistic update
      setIsSaved(shouldSave);
    },

    onError: (err, shouldSave) => {
      // Revert on error
      setIsSaved(!shouldSave);

      if (isUnauthorizedError(err)) {
        toast.warning("Unauthorized", {
          description: "You are logged out.",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }

      toast.error("Error", {
        description: `Failed to ${shouldSave ? "save" : "unsave"
          } post. Please try again.`,
      });
    },

    onSuccess: (_, shouldSave) => {
      toast.success(shouldSave ? "Post saved!" : "Post unsaved", {
        description: shouldSave
          ? "You can find this post in your saved items."
          : "Post removed from your saved items.",
      });

      // Invalidate saved posts query
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-saved"] });
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
    },
  });

  const handleBookmark = () => {
    if (!handleAuthRequired("save posts")) return;
    if (bookmarkMutation.isPending) return;

    bookmarkMutation.mutate(!isSaved);
  };

  // === AUTHENTICATION HANDLER ===
  const showAuthToast = (action: string) => {
    toast.info("Authentication Required", {
      description: `Please connect your wallet to ${action}.`,
    });
  };

  const handleAuthRequired = (action: string, callback?: () => void) => {
    if (!isAuthenticated) {
      showAuthToast(action);
      return false;
    }
    callback?.();
    return true;
  };

  // === VOTING FUNCTIONALITY START ===
  const [animatingVote, setAnimatingVote] = useState<"upvote" | "downvote" | null>(
    null
  );

  const [optimisticState, setOptimisticState] = useState<VoteState>({
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    userVote: post.userVote,
  });

  useEffect(() => {
    setOptimisticState({
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      userVote: post.userVote,
    });
  }, [post.upvotes, post.downvotes, post.userVote, postId]);

  const voteMutation = useMutation({
    mutationFn: async (voteType: "upvote" | "downvote") => {
      return await submitVote({
        targetId: postId,
        targetType: "post",
        voteType,
      });
    },

    onMutate: async (voteType: "upvote" | "downvote") => {
      await cancelVoteQueries(queryClient, postId, "post");

      const previousState = { ...optimisticState };
      const newState = calculateOptimisticVoteUpdate(
        optimisticState,
        voteType,
        postId,
        "post",
        user?.id || ""
      );

      setOptimisticState(newState);

      updatePostInAllCaches(queryClient, postId, "post", (item: any) => ({
        ...item,
        upvotes: newState.upvotes,
        downvotes: newState.downvotes,
        userVote: newState.userVote,
      }));

      return { previousState };
    },

    onError: (err, _, context: any) => {
      if (context?.previousState) {
        setOptimisticState(context.previousState);

        updatePostInAllCaches(queryClient, postId, "post", (item: any) => ({
          ...item,
          upvotes: context.previousState.upvotes,
          downvotes: context.previousState.downvotes,
          userVote: context.previousState.userVote,
        }));
      }

      setAnimatingVote(null);

      if (isUnauthorizedError(err)) {
        toast.warning("Unauthorized", {
          description: "You are logged out.",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }

      toast.error("Error", {
        description: "Failed to vote. Please try again.",
      });
    },

    onSuccess: (data: any) => {
      if (data?.updatedCounts) {
        const serverState: VoteState = {
          upvotes: data.updatedCounts.upvotes,
          downvotes: data.updatedCounts.downvotes,
          userVote: data.userVote || undefined,
        };

        setOptimisticState(serverState);

        updatePostInAllCaches(queryClient, postId, "post", (item: any) => ({
          ...item,
          upvotes: serverState.upvotes,
          downvotes: serverState.downvotes,
          userVote: serverState.userVote,
        }));
      }
    },

    onSettled: () => {
      invalidateVoteQueries(queryClient, postId, "post");
      setTimeout(() => setAnimatingVote(null), 300);
      // Note: Removed onUpdate() call to prevent feed reset
      // Optimistic updates already handle the UI changes
    },
  });

  const handleVote = (voteType: "upvote" | "downvote") => {
    if (!handleAuthRequired("vote")) return;
    if (voteMutation.isPending) return;

    setAnimatingVote(voteType);
    voteMutation.mutate(voteType);
  };

  const displayUpvotes = Array.isArray(optimisticState.upvotes)
    ? optimisticState.upvotes.length
    : optimisticState.upvotes;
  const displayDownvotes = Array.isArray(optimisticState.downvotes)
    ? optimisticState.downvotes.length
    : optimisticState.downvotes;
  const displayUserVote = optimisticState.userVote;
  // === VOTING FUNCTIONALITY END ===



  const handlePollClick = () => {
    if (post.type === "poll") {
      if (!handleAuthRequired("participate in polls")) return;
      if (!postId) return;
      setLocation(`/poll?id=${postId}`);
    }
  };

  const handlePostClick = () => {
    if (post.type === "poll") {
      if (!handleAuthRequired("participate in polls")) return;
      if (!postId) return;
      setLocation(`/poll?id=${postId}`);
    } else {
      if (!handleAuthRequired("participate in post")) return;
      if (!postId) return;
      setLocation(`/post?id=${postId}`);
    }
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.isAnonymous && post.author?.username) {
      if (!handleAuthRequired("view user profiles")) return;
      setLocation(`/u/${post.author.username}`);
    }
  };

  const truncateContent = (content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    let lastSpace = content.lastIndexOf(" ", maxLength);
    if (lastSpace === -1) lastSpace = maxLength;
    return content.substring(0, lastSpace).trim() + "...";
  };

  const shouldTruncate = post.content.length > 300;
  const displayContent = shouldTruncate
    ? truncateContent(post.content)
    : post.content;

  const getAuthorDisplay = () => {
    if (post.isAnonymous) {
      return "anonymous";
    }
    return post.author?.username || "anon";
  };

  const attachedMarket =
    post.attachedMarket && typeof post.attachedMarket === "object"
      ? (post.attachedMarket as any)
      : null;

  return (
    <article
      className={`
        border-[0.5px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] max-w-full overflow-hidden
        ${index % 5 === 0 && index > 0 ? "animate-post-reveal" : ""}
      `}
    >
      {/* Header Section - Responsive */}
      <div className="px-3 md:px-4 text-[#8E8E93] bg-[#525252] flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span
            className="text-sm py-3 md:py-3 md:text-base font-medium underline hover:text-gray-300 cursor-pointer transition-colors truncate"
            onClick={handleAuthorClick}
          >
            {getAuthorDisplay()}
          </span>

          {/* Sentiment Badge and Company Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {(post.sentiment === "positive" || (post as any).bias === "positive") && (
              <div className="p-0.5 md:py-2 flex items-center justify-center">
                <img src={LikeIcon} alt="positive" className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            )}
            {(post.sentiment === "negative" || (post as any).bias === "negative") && (
              <div className="p-0.5 md:py-2 flex items-center justify-center">
                <img
                  src={LikeIcon}
                  alt="negative"
                  className="w-3 h-3 md:w-4 md:h-4 rotate-180"
                  style={{
                    filter:
                      'brightness(0) saturate(100%) invert(21%) sepia(92%) saturate(2200%) hue-rotate(358deg) brightness(95%) contrast(115%)',
                  }}
                />
              </div>
            )}
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
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <span className="text-base text-[#8E8E93] ">
            {formatTimeAgo(post.createdAt)}
          </span>

          {(() => {
            return (
              user?.id &&
              post.author?.id &&
              (user.id === post.author.id ||
                user.id === post.author.id.toString()) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 md:h-6 md:w-6 text-gray-300 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 border border-[#525252]/30 bg-[#111214] text-[#E8EAE9]"
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

      {/* Main Content Area - Responsive */}
      <div
        className="px-4 md:px-9 py-4 md:py-4 cursor-pointer flex flex-col gap-4"
        onClick={handlePostClick}
      >
        <h3 className="font-spacemono text-base font-normal text-[#E8EAE9] leading-normal">
          {post.title}
        </h3>

        {attachedMarket && (
          <div onClick={(e) => e.stopPropagation()}>
            <QuotedMarketEmbed market={attachedMarket} mode="feed" />
          </div>
        )}

        {post.type === "poll" ? (
          <div className="mb-3">
            <div
              className="rounded-lg py-3 md:p-4 hover:shadow-md transition-all duration-300"
              onClick={(e) => {
                e.stopPropagation();
                handlePollClick();
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 md:w-10 md:h-10  rounded-full flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-normal text-white text-base">
                      Interactive Poll
                    </h3>
                    <div className="text-sm text-[#8E8E93] line-clamp-2">
                      <MarkdownRenderer
                        content={
                          post.content.length > 120
                            ? post.content.substring(0, 120) + "..."
                            : post.content
                        }
                        className="text-sm text-[#8E8E93]"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-sm space-x-1 md:space-x-2 bg-[#373737] text-[#E8EAE9] flex-shrink-0 ml-2">
                  <span className="text-sm font-medium hidden sm:inline">
                    Vote Now
                  </span>
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[#8E8E93] text-sm leading-relaxed flex flex-col gap-4">
            <div className="prose prose-xs max-w-none">
              <MarkdownRenderer
                content={displayContent}
                className="text-[#8E8E93]"
              />
            </div>
            {shouldTruncate && !isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className="text-[#525252] text-sm hover:text-gray-400 transition-colors flex justify-start"
              >
                Read more ....
              </button>
            )}
          </div>
        )}

        {(post.mediaUrl || post.imageUrl) && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img
              src={post.mediaUrl || post.imageUrl}
              alt="Post attachment"
              className="w-full max-h-64 md:max-h-96 object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
      </div>

      {/* Footer Actions - Responsive */}
      <div className="flex flex-col md:flex-row items-stretch border-t border-[#525252]/30">
        {/* Left Side - Upvote/Downvote */}
        <div
          className="flex items-center justify-between px-4 md:px-0 md:items-stretch border-b border-[#525252]/30 md:border-b-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Upvote"
            onClick={(e) => {
              e.stopPropagation();
              handleVote("upvote");
            }}
            disabled={voteMutation.isPending}
            className={`flex flex-1 justify-center md:justify-start text-center md:text-left md:flex-none items-center gap-2 md:px-6 py-3 border-r-[0.5px] border-[#525252]/30 transition-colors ${displayUserVote?.voteType === "upvote"
              ? "text-blue-500 bg-blue-500/30"
              : "text-white hover:bg-gray-800/50"
              } ${voteMutation.isPending ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            {voteMutation.isPending && animatingVote === "upvote" ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="@/icons/up-vote.svg"
                color={
                  displayUserVote?.voteType === "upvote"
                    ? "text-blue-500"
                    : "text-white"
                }
                alt="upvote"
              />
            )}
            <span className="text-base font-normal">{displayUpvotes}</span>
          </button>

          <button
            aria-label="Downvote"
            onClick={(e) => {
              e.stopPropagation();
              handleVote("downvote");
            }}
            disabled={voteMutation.isPending}
            className={`flex flex-1 justify-center md:justify-start md:flex-none items-center gap-2 md:px-6 py-3 border-r-none md:border-r-[0.5px] border-[#525252]/30 transition-colors ${displayUserVote?.voteType === "downvote"
              ? "text-orange-500 bg-orange-500/30"
              : "text-white hover:bg-gray-800/50"
              } ${voteMutation.isPending ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            {voteMutation.isPending && animatingVote === "downvote" ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="@/icons/down-vote.svg"
                color={
                  displayUserVote?.voteType === "downvote"
                    ? "text-orange-500"
                    : "text-white"
                }
                alt="downvote"
              />
            )}
            <span className="text-base font-normal sm:inline">
              {displayDownvotes}
            </span>
          </button>
        </div>

        <div className="flex-1 hidden md:block"></div>

        {/* Right Side - Comments & Bookmark */}
        <div
          className="flex justify-end md:justify-normal items-stretch"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!handleAuthRequired("view comments")) return;
              if (!postId) return;
              setLocation(`/post?id=${postId}`);
            }}
            className="flex items-center gap-2 px-4 py-3 text-white hover:bg-gray-800/50 transition-colors"
          >
            <SvgIcon
              src="@/icons/Post comment icon.svg"
              color="text-white"
              alt="comment"
            />

            <span className="text-base font-normal">{post.commentCount ?? 0}</span>
          </button>

          {/* Bookmark Button with Fill State */}
          <button
            aria-label={isSaved ? "Unsave post" : "Save post"}
            onClick={(e) => {
              e.stopPropagation();
              handleBookmark();
            }}
            disabled={bookmarkMutation.isPending}
            className={`flex items-center justify-center px-4 py-3 transition-colors hover:bg-gray-800/50 ${isSaved ? "text-blue-500" : "text-white "
              } ${bookmarkMutation.isPending
                ? "opacity-75 cursor-not-allowed"
                : ""
              }`}
          >
            {bookmarkMutation.isPending ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="@/icons/Post bookmark icon.svg"
                color={isSaved ? "text-blue-500" : "text-white"}
                alt="bookmark"
              />
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              post and remove its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  if (!postId) {
                    toast.error("Error", {
                      description: "Unable to resolve this post.",
                    });
                    return;
                  }

                  const res = await fetch(`/api/posts/${postId}`, {
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

                  console.log(
                    "[PostCard] Invalidating queries after post deletion..."
                  );

                  queryClient.invalidateQueries({
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
                  queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

                  console.log("[PostCard] Queries invalidated successfully");

                  toast.info("Post deleted", {
                    description: "Your post has been permanently deleted.",
                  });

                  if (typeof onUpdate === "function") {
                    onUpdate();
                  }

                  if (window.location.pathname === "/post") {
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = "/";
                    }
                  }
                } catch (error) {
                  console.error("Error deleting post:", error);
                  toast.error("Error", {
                    description: "Failed to delete post. Please try again.",
                  });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
