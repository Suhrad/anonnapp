// components/PollPageMain.tsx
import PollCommentReply from "@/components/Comments/PollCommentReply";
import ShareButton from "@/components/Comments/ShareButton";
import VoteButtons from "@/components/Comments/VoteButtons";
import { InfiniteScrollSkeleton } from "@/components/loaders/InfiniteScrollLoader";
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
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { apiCall } from "@/lib/api";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
// import { apiRequest } from "@/lib/queryClient";
import PostLikeIcon1 from "@/icons/Post like icon-1.svg";
import PostLikeIcon from "@/icons/Post like icon.svg";
import PostButtonIcon from "@/icons/post-button-icon.svg";
import PostDislikeIcon from "@/icons/thumbs-down.svg";
import { formatTimeAgo } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquare, MoreHorizontal, Trash } from "lucide-react";
import { useState } from "react";
import QuotedMarketEmbed from "@/components/markets/QuotedMarketEmbed";
import { useLocation } from "wouter";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { CommentWithDetails } from "@/types";

interface PollOption {
  id: number;
  _id: string | number; // MongoDB subdocument ID
  text: string;
  voteCount: number;
  isVotedBy?: boolean;
}

interface Poll {
  id: number;
  title: string;
  question?: string;
  description?: string;
  attachedMarket?: any;
  author: {
    id: string;
    email: string;
    username?: string;
    avatar?: string;
  };
  bowl?: { id: number; name: string };
  options: PollOption[];
  totalVotes: number;
  allowMultipleChoices: boolean;
  createdAt: string;
  hasVoted?: boolean;
  selectedOptions?: number[];
  upvotes: number;
  downvotes: number;
  userVote?: {
    id: number;
    createdAt: Date | null;
    userId: string;
    targetId: number;
    targetType: string;
    voteType: string;
  };
  viewCount?: number;
  community?: {
    id: number | string;
    displayName: string;
    avatar?: string;
  };
}

export default function PollContent() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<(string | number)[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Get poll ID from URL
  const pollId = new URLSearchParams(window.location.search).get("id");

  const queryClient = useQueryClient();

  // Fetch poll data
  const {
    data: poll,
    isLoading: pollLoading,
    error: pollError,
    refetch,
  } = useQuery<Poll>({
    queryKey: ["poll", pollId],
    enabled: !!pollId,
    queryFn: async () => {
      let rawPoll;
      if (!pollId) throw new Error("No poll ID provided");

      // Try to fetch directly as a poll ID
      try {
        const pollData = await apiCall<{ poll?: Poll } | Poll>({
          endpoint: `polls/${pollId}`,
          method: "GET",
          params: { skipViewCount: "false" }, // Only increment on initial load
        });
        rawPoll = (pollData as { poll?: Poll }).poll || (pollData as Poll);
      } catch {
        // If that fails, try as a post ID to see if it's a poll post
        const postData = await apiCall<{ post?: { type: string } } | { type: string }>({
          endpoint: `posts/${pollId}`,
          method: "GET",
        });

        const actualPost = (postData as { post?: { type: string } }).post || (postData as { type: string });
        if (actualPost.type === "poll") {
          // Fetch polls filtered by postId
          const pollsData = await apiCall<{ polls?: Poll[] } | Poll[]>({
            endpoint: "polls",
            method: "GET",
            params: { postId: pollId },
          });

          const allPolls = (pollsData as { polls?: Poll[] }).polls || (pollsData as Poll[]);
          const matchingPoll = Array.isArray(allPolls)
            ? allPolls.find(
              (p: Poll & { postId?: string | number }) => p.postId === pollId || p.postId === parseInt(pollId)
            )
            : null;

          if (matchingPoll) {
            // Update the URL to the actual poll ID
            const newUrl = `/poll?id=${matchingPoll.id}`;
            if (window.location.pathname + window.location.search !== newUrl) {
              window.history.replaceState({}, "", newUrl);
            }

            rawPoll = matchingPoll;
          } else {
            throw new Error("POLL_POST_NOT_FOUND");
          }
        } else {
          throw new Error("This is not a poll");
        }
      }

      const poll = rawPoll;
      if (!poll) throw new Error("Poll data missing");

      // Polyfill community if missing
      if (!poll.community) {
        if (poll.bowl) {
          const bowl = poll.bowl as { id: number; name?: string; displayName?: string; iconUrl?: string; avatar?: string };
          poll.community = {
            id: bowl.id,
            displayName: bowl.name || bowl.displayName || "Bowl",
            avatar: bowl.iconUrl || bowl.avatar,
          };
        } else {
          poll.community = {
            id: "unknown",
            displayName: "Community",
          }
        }
      }

      return poll;
    },
    staleTime: Infinity,
  });

  console.log("poll", poll);
  // Fetch comments for the poll
  const {
    data: commentsData,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useApiQuery<{ comments: CommentWithDetails[] }>({
    queryKey: ["poll-comments", poll?.id ?? pollId ?? undefined],
    endpoint: `polls/${poll?.id || pollId}/comments?page=1`,
    enabled: !!(poll?.id || pollId),
    onError: (error) => {
      console.error("Failed to fetch poll comments:", error);
    },
  });

  const comments = commentsData?.comments || [];

  const deletePoll = useApiMutation({
    endpoint: "polls/delete", // 👈 required only for TypeScript

    mutationFn: async () => {
      if (!poll) throw new Error("No poll available");
      if (poll.author.id !== user?.id) throw new Error("Unauthorized");

      return apiCall({
        endpoint: `polls/${poll.id}`,
        method: "DELETE",
      });
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key)) return false;

          return (
            key[0] === "polls" ||
            key[0] === "/api/polls" ||
            key[0] === "posts" ||
            key[0] === "/api/posts" ||
            (key[0] === "poll" && key[1] === poll?.id?.toString())
          );
        },
      });

      // Invalidate user profile points query to update points in sidebar
      await queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      toast.success("Poll deleted", {
        description: "Your poll has been permanently deleted.",
      });

      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/polls");
      }
    },

    onError: (error: Error) => {
      console.error("Error deleting poll:", error);

      toast.error("Error", {
        description: error.message ?? "Failed to delete poll.",
      });

      setLocation("/polls");
    },
  });

  const voteMutation = useApiMutation({
    endpoint: "polls/vote", // dummy endpoint just to satisfy the type

    mutationFn: async (optionIds: (string | number)[]) => {
      console.log("🚀 ~ PollContent ~ optionIds:", optionIds);
      const actualPollId = poll?.id || pollId;
      if (!actualPollId) throw new Error("No poll ID available");

      return apiCall({
        endpoint: `${import.meta.env.VITE_API_URL}polls/${actualPollId}/vote`,
        method: "POST",
        body: { optionIds },
      });
    },

    onSuccess: async () => {
      // Clear selections immediately
      setSelectedOptions([]);
      
      // Refetch the poll to get updated state with hasVoted and selectedOptions
      // Use skipViewCount to prevent incrementing view count on refetch
      const actualPollId = poll?.id || pollId;
      if (actualPollId) {
        try {
          const pollData = await apiCall<{ poll?: Poll } | Poll>({
            endpoint: `polls/${actualPollId}`,
            method: "GET",
            params: { skipViewCount: "true" }, // Don't increment view count on refetch
          });
          const updatedPoll = (pollData as { poll?: Poll }).poll || (pollData as Poll);
          queryClient.setQueryData(["poll", pollId], updatedPoll);
          } catch {
            // If refetch fails, fall back to regular refetch
            refetch();
          }
      } else {
        refetch();
      }

      queryClient.invalidateQueries({
        queryKey: ["polls"],
      });

      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      toast.success("Vote submitted", {
        description: "Your vote has been recorded successfully.",
      });
    },

    onError: async (error: Error & { response?: { data?: { error?: string; message?: string } } }) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "";

      // Check if the error is because user already voted
      if (
        errorMessage.includes("ALREADY_VOTED") ||
        errorMessage.toLowerCase().includes("already voted")
      ) {
        toast.warning("Already voted", {
          description: "You have already voted on this poll.",
        });
        // Refetch without incrementing view count
        const actualPollId = poll?.id || pollId;
        if (actualPollId) {
          try {
            const pollData = await apiCall<{ poll?: Poll } | Poll>({
              endpoint: `polls/${actualPollId}`,
              method: "GET",
              params: { skipViewCount: "true" },
            });
            const updatedPoll = (pollData as { poll?: Poll }).poll || (pollData as Poll);
            queryClient.setQueryData(["poll", pollId], updatedPoll);
          } catch {
            refetch();
          }
        } else {
          refetch();
        }
        setSelectedOptions([]); // Clear selections
      } else {
        toast.error("Error", {
          description:
            error?.response?.data?.message ||
            error.message ||
            "Failed to submit vote.",
        });
      }
    },
  });

  const bookmarkMutation = useApiMutation({
    endpoint: "users/bookmarks",
    onSuccess: () => {
      // Invalidate user bookmarks and profile points queries
      queryClient.invalidateQueries({ queryKey: ["user-bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
      toast.success("Poll bookmarked!");
    },
    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to bookmark poll",
      });
    },
  });

  const handleVote = (optionId: string | number) => {
    // Don't allow voting if user has already voted
    if (poll?.hasVoted) return;

    if (!poll?.allowMultipleChoices) {
      // Single choice - replace previous selection
      setSelectedOptions([optionId]);
    } else {
      // Multiple choice - toggle selection
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const submitVote = async () => {
    if (poll?.hasVoted) return;
    if (selectedOptions.length === 0) return;

    voteMutation.mutate(selectedOptions);
  };

  const getAuthorDisplay = () => {
    if (!poll) return "User";
    const author = poll.author;
    return author?.username || "Anonymous";
  };

  const getVotePercentage = (voteCount: number) => {
    if (!poll || poll.totalVotes === 0) return 0;
    return Math.round((voteCount / poll.totalVotes) * 100);
  };

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

  if (authLoading) {
    return <div>Loading...</div>;
  }

  // if (!isAuthenticated) {
  //   return <div>Please log in to view polls.</div>;
  // }

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

  return (
    <div className="max-w-[1400px] mx-auto">
      {pollLoading ? (
        <Card className="border border-gray-600 shadow-lg rounded-lg">
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
      ) : pollError ? (
        <Card className="border border-gray-600">
          <CardContent className="p-12 text-center">
            <div className="mb-6">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Poll not found
            </h3>
            <p className="text-gray-400 mb-6">
              The poll you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => setLocation("/polls")}
              className="bg-gray-700 hover:bg-gray-600 text-white"
            >
              Back to Polls
            </Button>
          </CardContent>
        </Card>
      ) : poll ? (
        <>
          {/* Poll Card - Matching Post Content Design */}
          <article className=" bg-[rgba(234,234,234,0.02)] overflow-hidden">
            <div className="border-[0.2px] border-[#525252]/30 p-6 flex flex-col gap-6">
              {/* Header Section */}
              <div className=" flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <img
                    src={poll.author.avatar || DEFAULT_PROFILE_PICTURE}
                    className="h-10 w-10 object-cover"
                  />
                  <div className="flex flex-row gap-1">
                    <span
                      className="text-[#8E8E93] text-xs tracking-[.24px] font-normal underline cursor-pointer hover:text-gray-200 transition-colors truncate"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {getAuthorDisplay()}
                    </span>

                    <span className="text-[#525252] text-xs tracking-[0.2px]">
                      {formatTimeAgo(poll.createdAt || "")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Green Thumbs Up Badge */}
                  <div className=" p-1 flex items-center justify-center flex-shrink-0 ">
                    <img src={PostLikeIcon} alt="like" />
                    {/* <ThumbsUp className="w-7 h-7 fill-green-500 text-green-500" /> */}
                  </div>

                  {/* Green Badge with custom icon */}
                  <div className="w-[30px] h-[30px] p-1.5 flex items-center justify-center flex-shrink-0">
                    {poll.community?.avatar ? (
                      <img
                        src={poll.community.avatar}
                        alt={poll.community.displayName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs">
                        {poll.community?.displayName}
                      </span>
                    )}
                  </div>
                  {/* Post Actions Menu (Delete) */}

                  {(() => {
                    return (
                      user?.id &&
                      poll.author?.id &&
                      (user.id === poll.author.id ||
                        user?.id === poll?.author.id.toString()) && (
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
              <div className="cursor-default flex flex-col gap-4">
                {/* Poll Title */}
                {(poll.question || poll.title) && (
                  <div className="text-base font-normal font-spacemono text-[#E8EAE9] leading-normal">
                    {poll.question || poll.title}
                  </div>
                )}

                {/* Quoted Market Embed */}
                {poll.attachedMarket && typeof poll.attachedMarket === "object" && (
                  <QuotedMarketEmbed market={poll.attachedMarket} mode="feed" />
                )}

                {/* Poll Description */}
                {poll.description && (
                  <div className="text-[#8E8E93] text-base leading-relaxed">
                    <div className="prose prose-xs max-w-none">
                      <MarkdownRenderer
                        content={poll.description}
                        className="text-[#8E8E93]"
                      />
                    </div>
                  </div>
                )}

                {/* Poll Options - Matching Image Design */}
                <div
                  className={`grid gap-3 ${poll.options.length <= 2 ? "grid-cols-1" : "grid-cols-2"
                    } w-full`}
                >
                  {poll.options && poll.options.length > 0 ? (
                    poll.options.map((option) => {
                      const percentage = getVotePercentage(option.voteCount);
                      const isSelected = selectedOptions.includes(option._id);
                      // Check if this option was voted for by the user
                      // selectedOptions can contain either _id or id, so check both
                      const optionId = option._id || option.id;
                      const isVotedOption =
                        poll.hasVoted &&
                        poll.selectedOptions?.some(
                          (selectedId: string | number) =>
                            selectedId?.toString() === optionId?.toString() ||
                            selectedId?.toString() === option.id?.toString() ||
                            selectedId?.toString() === option._id?.toString()
                        );

                      return (
                        <div
                          key={option.id}
                          className={`border-[0.2px] border-[#525252]/30 py-3 px-6 transition-all duration-200 ${poll?.hasVoted
                            ? "cursor-default"
                            : "cursor-pointer hover:border-gray-500"
                            } ${isSelected || isVotedOption
                              ? "bg-[#E8EAE9] text-[#525252]"
                              : "bg-transparent text-white"
                            }`}
                          onClick={() => handleVote(option._id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs ">
                              {option.text} [ {percentage}% ]
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No poll options available
                    </div>
                  )}
                </div>

                {/* Vote Button */}
                {!poll?.hasVoted && selectedOptions.length > 0 && (
                  <div className="pt-6 border-t border-[#525252]/30">
                    <Button
                      onClick={submitVote}
                      disabled={poll?.hasVoted || voteMutation.isPending}
                      className="w-full rounded-none border border-[#525252]/30 hover:bg-[#E8EAE9] hover:text-[#525252] text-white py-2 font-normal text-xs transition-all duration-300"
                    >
                      {voteMutation.isPending
                        ? "Voting..."
                        : `Vote [ ${selectedOptions.length} selected ]`}
                    </Button>
                  </div>
                )}

                {/* Poll Stats */}
                <div className="flex items-center justify-between text-[#525252] text-xs uppercase">
                  <div>{formatPostTime(poll?.createdAt)}</div>
                  <div>{formatPostDate(poll?.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-x-[0.2px] border-b flex flex-col md:flex-row items-stretch border-[#525252]/30">
              {/* Left Side - Upvote/Downvote with border */}
              <div>
                <VoteButtons
                  targetId={poll.id}
                  targetType="poll"
                  upvotes={poll.upvotes}
                  downvotes={poll.downvotes}
                  userVote={poll.userVote}
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
                  onClick={() =>
                    bookmarkMutation.mutate({
                      type: "poll",
                      itemId: poll.id,
                    })
                  }
                  aria-label="Bookmark"
                  className="flex items-center justify-center px-4 py-3 transition-colors hover:bg-gray-800/50 text-white"
                >
                  <SvgIcon
                    src="/icons/Post bookmark icon.svg"
                    color={"text-white"}
                    alt="bookmark"
                  />
                </button>

                {/* Share Button */}
                <ShareButton
                  size="sm"
                  url={window.location.href}
                  title={poll.title}
                  description={poll.description}
                />
              </div>
            </div>
          </article>

          {/* Comments Section - Matching Post Content Design */}
          <div className="overflow-hidden ">
            {/* Abstract Row */}
            <div className="border-x-[0.2px] border-[#525252]/30 flex items-center justify-between p-6 ">
              <div className="text-[#525252] text-xs">
                Join the conversation
              </div>

              <div className="flex gap-4 md:gap-6 lg:gap-9 items-center">
                <div className="flex">
                  <div className="flex cursor-pointer items-center justify-center bg-[#ABEFC6] hover:bg-green-300 transition w-[30px] h-[30px]">
                    <img src={PostLikeIcon1} alt="thumbs-up" />
                  </div>

                  <div className="flex cursor-pointer items-center justify-center bg-[#FDA29B] hover:bg-red-300 transition w-[30px] h-[30px]">
                    <img src={PostDislikeIcon} alt="thumbs-down" />
                  </div>
                </div>
              </div>
            </div>

            {/* Comment Form */}
            <div className="border-[0.2px] border-[#525252]/30 bg-[#0c0c0c]">
              <div className="w-full">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget; // Store reference before async
                    const formData = new FormData(form);
                    const content = formData.get("content") as string;

                    if (!content.trim()) {
                      toast.error("Empty comment", {
                        description: "Please enter a comment before posting.",
                      });
                      return;
                    }

                    try {
                      await apiCall({
                        method: "POST",
                        endpoint: `polls/${poll.id}/comments`,
                        body: { content },
                      });

                      // Clear the form using stored reference
                      form.reset();

                      // Show success toast
                      toast.success("Comment posted", {
                        description:
                          "Your comment has been successfully added.",
                      });

                      // Refetch comments to show the new one
                      refetchComments();
                      
                      // Invalidate user profile points query to update points in sidebar
                      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
                    } catch (error) {
                      console.error("Error posting comment:", error);
                      toast.error("Error", {
                        description:
                          "Failed to post comment. Please try again.",
                      });
                    }
                  }}
                  className="flex items-center justify-between"
                >
                  {/* Left: Yellow box + input */}
                  <div className="flex items-center pl-9 py-6 flex-1 pr-4 gap-4">
                    {/* Yellow square */}
                    <div className="w-[30px] h-[30px] bg-[#FFB82A] flex-shrink-0"></div>

                    {/* Text input */}
                    <input
                      type="text"
                      name="content"
                      placeholder="post your reply"
                      className="w-full bg-transparent text-[#525252] text-base font-spacemono focus:outline-none"
                    />
                  </div>

                  {/* Right: POST button */}
                  <Button
                    type="submit"
                    className="py-10 px-6 flex items-center justify-center text-[#17181C] font-normal bg-gradient-to-r from-[#A0D9FF] to-[#E8EAE9] hover:opacity-90 transition rounded-none"
                  >
                    <img src={PostButtonIcon} />
                    POST
                  </Button>
                </form>
              </div>
            </div>

            {/* Comments Count */}
            <div className="h-[40px] text-center flex justify-center items-center">
              <div className="text-[#525252] text-xs font-medium">
                [ {comments?.length || 0} COMMENTS ]
              </div>
            </div>

            {/* Comments List */}
            <div>
              {commentsLoading ? (
                <InfiniteScrollSkeleton count={3} />
              ) : comments && comments.length > 0 ? (
                comments.map((comment: CommentWithDetails) => (
                  <div
                    key={comment.id}
                    className="transition-colors mb-4 border border-[#525252]/30"
                  >
                    <PollCommentReply
                      comment={comment}
                      pollId={poll.id}
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
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your poll and remove its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={deletePoll.mutate}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
