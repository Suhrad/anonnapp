import { Button } from "@/components/ui/button";
import QuotedMarketEmbed from "@/components/markets/QuotedMarketEmbed";
import { useAuth } from "@/hooks/useAuth";
import { formatTimeAgo } from "@/lib/utils";
import type { PollWithDetails } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { SvgIcon } from "../SvgIcon";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface PollCardProps {
  poll: PollWithDetails;
  onUpdate?: () => void; // Optional callback to refresh data after voting
}

export default function PollCard({
  poll: initialPoll,
  onUpdate,
}: PollCardProps) {
  const { isAuthenticated } = useAuth();
  // Normalize poll data - convert arrays to numbers if needed
  const normalizePoll = (p: PollWithDetails) => {
    return {
      ...p,
      upvotes: Array.isArray(p.upvotes) ? p.upvotes.length : (typeof p.upvotes === 'number' ? p.upvotes : 0),
      downvotes: Array.isArray(p.downvotes) ? p.downvotes.length : (typeof p.downvotes === 'number' ? p.downvotes : 0),
    };
  };
  const [poll, setPoll] = useState(normalizePoll(initialPoll));
  const [selectedOptions, setSelectedOptions] = useState<(string | number)[]>([]);
  const [animatingVote, setAnimatingVote] = useState<"up" | "down" | null>(
    null
  );
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [_location, setLocation] = useLocation();

  // Update poll state when initialPoll changes
  useEffect(() => {
    const normalized = normalizePoll(initialPoll);
    setPoll((prev) => ({
      ...normalized,
      // Preserve selectedOptions if they exist in the new data
      selectedOptions: normalized.selectedOptions || prev.selectedOptions,
    }));
  }, [initialPoll.id]);

  // === BOOKMARK STATE ===
  const [isSaved, setIsSaved] = useState(false);

  // Check if poll is saved
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
    const polls = bookmarksData?.bookmarks?.polls || [];
    setIsSaved(polls.some((p: any) => p._id === poll.id || p.id === poll.id));
  }, [isAuthenticated, user, poll.id, bookmarksData, bookmarksLoading]);

  // === BOOKMARK MUTATION ===
  const bookmarkMutation = useMutation({
    mutationFn: async (shouldSave: boolean) => {
      const endpoint = shouldSave
        ? "users/bookmarks"
        : `users/bookmarks/${poll.id}?type=poll`;
      const method = shouldSave ? "POST" : "DELETE";

      return await apiCall({
        endpoint,
        method,
        body: shouldSave ? { type: "poll", itemId: poll.id } : undefined,
      });
    },

    onMutate: async (shouldSave: boolean) => {
      setIsSaved(shouldSave);
    },

    onError: (err, shouldSave) => {
      setIsSaved(!shouldSave);
      if (isUnauthorizedError(err)) {
        toast.warning("Unauthorized", { description: "You are logged out." });
        return;
      }
      toast.error("Error", {
        description: `Failed to ${shouldSave ? "save" : "unsave"} poll. Please try again.`,
      });
    },

    onSuccess: (_, shouldSave) => {
      toast.success(shouldSave ? "Poll saved!" : "Poll unsaved", {
        description: shouldSave
          ? "You can find this poll in your saved items."
          : "Poll removed from your saved items.",
      });
      queryClient.invalidateQueries({ queryKey: ["user-bookmarks"] });
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
    },
  });

  // Vote mutation for upvote/downvote
  const voteMutation = useMutation({
    mutationFn: async ({ voteType }: { voteType: "upvote" | "downvote" }) => {
      const token = await (window as any).__getDynamicToken?.();
      const response = await fetch(`${import.meta.env.VITE_API_URL}polls/${poll.id}/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ voteType }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to vote");
      }

      return await response.json();
    },

    onError: (err: any) => {
      setAnimatingVote(null);

      if (
        err.message?.includes("401") ||
        err.message?.includes("Unauthorized")
      ) {
        toast.error("Unauthorized", {
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

    onSuccess: (response) => {
      // API response is wrapped in { success, message, data: { upvotes, downvotes, userVote } }
      // Since we're using fetch directly (not apiCall), we need to extract the data field
      const responseData = response.data || response;
      const upvotes = typeof responseData.upvotes === 'number' ? responseData.upvotes : (Array.isArray(responseData.upvotes) ? responseData.upvotes.length : 0);
      const downvotes = typeof responseData.downvotes === 'number' ? responseData.downvotes : (Array.isArray(responseData.downvotes) ? responseData.downvotes.length : 0);
      
      // Handle userVote - backend returns { voteType: 'up' | 'down' | null }
      // Convert to match the component checks which expect 'up'/'down' (not 'upvote'/'downvote')
      let userVote: typeof poll.userVote = undefined;
      if (responseData.userVote?.voteType) {
        userVote = {
          id: 0,
          userId: user?.id || '',
          targetId: poll.id,
          targetType: 'poll',
          voteType: responseData.userVote.voteType as 'up' | 'down', // Backend returns 'up'/'down'
          createdAt: null,
        } as typeof poll.userVote;
      }
      
      // Update local state with new vote counts
      setPoll((prev) => ({
        ...prev,
        upvotes,
        downvotes,
        userVote,
      }));

      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      // Call parent refresh if provided
      if (onUpdate) {
        onUpdate();
      }
    },

    onSettled: () => {
      setTimeout(() => setAnimatingVote(null), 300);
    },
  });

  // Poll option vote mutation
  const pollVoteMutation = useMutation({
    mutationFn: async ({ optionIds }: { optionIds: (string | number)[] }) => {
      const token = await (window as any).__getDynamicToken?.();
      const response = await fetch(`${import.meta.env.VITE_API_URL}polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ optionIds }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to submit vote");
      }

      return await response.json();
    },

    onError: (err: any) => {
      if (
        err.message?.includes("401") ||
        err.message?.includes("Unauthorized")
      ) {
        toast.error("Unauthorized", {
          description: "You are logged out.",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast.error("Error", {
        description: "Failed to submit vote. Please try again.",
      });
    },

    onSuccess: (data) => {
      // Update local state with new poll data
      setPoll((prev) => ({
        ...prev,
        hasVoted: true,
        options: data.options || prev.options,
        totalVotes: data.totalVotes || prev.totalVotes,
        selectedOptions: data.selectedOptions || selectedOptions,
      }));

      // Clear selected options from local state (they're now in poll.selectedOptions)
      setSelectedOptions([]);

      toast.success("Vote submitted!", {
        description: "Your vote has been recorded.",
      });

      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      // Call parent refresh if provided
      if (onUpdate) {
        onUpdate();
      }
    },
  });

  // Authentication handler - similar to PostCard
  const showAuthToast = (action: string) => {
    toast.error("Authentication Required", {
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

  const handlePollVote = (voteType: "upvote" | "downvote") => {
    if (!handleAuthRequired("vote on polls")) return;
    if (voteMutation.isPending) return;

    setAnimatingVote(voteType === "upvote" ? "up" : "down");
    voteMutation.mutate({ voteType });
  };

  const handleVoteOption = (optionId: string | number, allowMultiple: boolean) => {
    if (!handleAuthRequired("select poll options")) return;
    if (poll.hasVoted) return;

    setSelectedOptions((prev) => {
      if (allowMultiple) {
        return prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId];
      } else {
        return [optionId];
      }
    });
  };

  const handleSubmitVote = () => {
    if (!handleAuthRequired("submit poll votes")) return;
    if (poll.hasVoted) return;
    if (selectedOptions.length === 0 || pollVoteMutation.isPending) return;
    pollVoteMutation.mutate({ optionIds: selectedOptions });
  };

  const handlePollClick = () => {
    if (!handleAuthRequired("view poll details")) return;
    setLocation(`/poll?id=${poll.id}`);
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!handleAuthRequired("view user profiles")) return;
    setLocation(`/u/${poll.author.username}`);
  };

  const handleBookmark = () => {
    if (!handleAuthRequired("bookmark polls")) return;
    if (bookmarkMutation.isPending) return;
    bookmarkMutation.mutate(!isSaved);
  };

  const showVoteButton = !poll.hasVoted && selectedOptions.length > 0;

  // Ensure upvotes/downvotes are numbers (should already be normalized, but double-check)
  const upvotesValue = poll.upvotes as unknown;
  const downvotesValue = poll.downvotes as unknown;
  const displayUpvotes = typeof upvotesValue === 'number' ? upvotesValue : (Array.isArray(upvotesValue) ? upvotesValue.length : 0);
  const displayDownvotes = typeof downvotesValue === 'number' ? downvotesValue : (Array.isArray(downvotesValue) ? downvotesValue.length : 0);

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + "...";
  };

  const attachedMarket =
    poll.attachedMarket && typeof poll.attachedMarket === "object"
      ? (poll.attachedMarket as any)
      : null;

  return (
    <article className=" border-[0.5px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] max-w-full overflow-hidden">
      {/* Header Section */}
      <div className="px-3 md:px-4 text-[#8E8E93] bg-[#525252] flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span
            className="text-sm py-3 md:py-3 md:text-base font-medium underline hover:text-gray-300 cursor-pointer transition-colors truncate"
            onClick={handleAuthorClick}
          >
            {poll.author?.username || "Anonymous"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-base">{formatTimeAgo(poll.createdAt)}</span>
        </div>
      </div>

      {/* Content Section */}
      <div
        className="px-4 md:px-9 py-4 md:py-4 cursor-pointer flex flex-col gap-4"
        onClick={handlePollClick}
      >
        {/* Poll Title */}
        <h3 className="font-spacemono text-base font-normal text-[#E8EAE9] leading-normal">
          {(poll as any).question || poll.title}
        </h3>
        {attachedMarket && (
          <div onClick={(e) => e.stopPropagation()}>
            <QuotedMarketEmbed market={attachedMarket} mode="feed" />
          </div>
        )}
        {/* Poll Description */}
        {poll.description && (
          <div className="text-[#8E8E93] text-sm leading-relaxed flex flex-col gap-4">
            {truncateContent(poll.description, 100)}
          </div>
        )}
        {/* Poll Options - Matching PollContent Design */}
        <div
          className={`grid gap-3 ${poll.options.length <= 2 ? "grid-cols-1" : "grid-cols-2"
            } w-full`}
        >
          {poll.options.map((option) => {
            const showResults = poll.hasVoted || poll.totalVotes > 0;
            const percentage =
              poll.totalVotes > 0
                ? Math.round((option.voteCount / poll.totalVotes) * 100)
                : 0;

            const isSelected = selectedOptions.includes(option.id);
            const isVotedOption =
              poll.hasVoted &&
              poll.selectedOptions?.includes(option.id);

            return (
              <div
                key={option.id}
                className={`relative border-[0.2px] border-[#525252]/30 py-3 px-6 transition-all duration-200 overflow-hidden ${poll?.hasVoted
                  ? "cursor-default"
                  : "cursor-pointer hover:border-gray-500"
                  } ${isSelected || isVotedOption
                    ? "bg-[#E8EAE9]"
                    : "bg-transparent"
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoteOption(option.id, poll.allowMultipleChoices);
                }}
              >
                {/* Progress bar background - fills based on percentage */}
                {showResults && (
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      isSelected || isVotedOption
                        ? "bg-[#525252]/40"
                        : "bg-[#525252]/30"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                {/* Content */}
                <div className={`relative z-10 flex items-center justify-between ${
                  isSelected || isVotedOption
                    ? "text-[#525252]"
                    : "text-white"
                  }`}>
                  <span className="text-xs">
                    {option.text}{" "}
                    {showResults && (
                      <span>[ {percentage}% ]</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vote Button */}
        {showVoteButton && (
          <div className="pt-6 border-t border-[#525252]/30" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={handleSubmitVote}
              disabled={poll.hasVoted || pollVoteMutation.isPending}
              className="w-full rounded-none border border-[#525252]/30 hover:bg-[#E8EAE9] hover:text-[#525252] text-white py-2 font-normal text-xs transition-all duration-300"
            >
              {pollVoteMutation.isPending
                ? "Voting..."
                : `Vote [ ${selectedOptions.length} selected ]`}
            </Button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col md:flex-row items-stretch border-t border-[#525252]/30">
        {/* Left Side - Upvote/Downvote */}
        <div
          className="flex items-center justify-between px-4 md:px-0 md:items-stretch border-b border-[#525252]/30 md:border-b-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Upvote Button */}
          <button
            aria-label="Upvote"
            onClick={(e) => {
              e.stopPropagation();
              handlePollVote("upvote");
            }}
            disabled={voteMutation.isPending}
            className={`flex flex-1 justify-center md:justify-start text-center md:text-left md:flex-none items-center gap-2 md:px-6 py-3 border-r-[0.5px] border-[#525252]/30 transition-colors ${poll.userVote?.voteType === "up"
              ? "text-blue-500 bg-blue-500/30"
              : "text-white hover:bg-gray-800/50"
              } ${voteMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {voteMutation.isPending && animatingVote === "up" ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="/icons/up-vote.svg"
                color={
                  poll.userVote?.voteType === "up"
                    ? "text-blue-500"
                    : "text-white"
                }
                alt="upvote"
              />
            )}
            <span className="text-base font-normal">{displayUpvotes}</span>
          </button>

          {/* Downvote Button */}
          <button
            aria-label="Downvote"
            onClick={(e) => {
              e.stopPropagation();
              handlePollVote("downvote");
            }}
            disabled={voteMutation.isPending}
            className={`flex flex-1 justify-center md:justify-start md:flex-none items-center gap-2 md:px-6 py-3 border-r-none md:border-r-[0.5px] border-[#525252]/30 transition-colors  ${poll.userVote?.voteType === "down"
              ? "text-orange-500 bg-orange-500/30"
              : "text-white hover:bg-gray-800/50"
              } ${voteMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {voteMutation.isPending && animatingVote === "down" ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="/icons/down-vote.svg"
                color={
                  poll.userVote?.voteType === "down"
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

        {/* Spacer */}
        <div className="flex-1 hidden md:block"></div>

        {/* Right Side - Comments & Bookmark */}
        <div
          className="flex justify-end md:justify-normal items-stretch"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Comments Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!handleAuthRequired("view comments")) return;
              setLocation(`/poll?id=${poll.id}`);
            }}
            className="flex items-center gap-2 px-4 py-3 text-white hover:bg-gray-800/50 transition-colors"
          >
            <SvgIcon
              src="/icons/Post comment icon.svg"
              color="text-white"
              alt="comment"
            />
            <span className="text-base font-normal">{(poll as any).commentCount ?? 0}</span>
          </button>

          {/* Bookmark Button */}
          <button
            aria-label={isSaved ? "Unsave poll" : "Save poll"}
            onClick={(e) => {
              e.stopPropagation();
              handleBookmark();
            }}
            disabled={bookmarkMutation.isPending}
            className={`flex items-center justify-center px-4 py-3 transition-colors hover:bg-gray-800/50 ${isSaved ? "text-blue-500" : "text-white"
              }`}
          >
            {bookmarkMutation.isPending ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <SvgIcon
                src="/icons/Post bookmark icon.svg"
                color={isSaved ? "text-blue-500" : "text-white"}
                alt="bookmark"
              />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
