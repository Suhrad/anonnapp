import { SvgIcon } from "@/components/SvgIcon";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  calculateOptimisticVoteUpdate,
  cancelVoteQueries,
  invalidateVoteQueries,
  submitVote,
  updatePostInAllCaches,
  type VoteState,
} from "@/lib/voteUtils";
import type { Vote } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface VoteButtonsProps {
  targetId: number;
  targetType: "post" | "comment" | "poll";
  upvotes: number;
  downvotes: number;
  userVote?: Vote;
  onUpdate: () => void;
  size?: "default" | "sm";
  layout?: "vertical" | "horizontal";
  showCount?: boolean;
}

export default function VoteButtons({
  targetId,
  targetType,
  upvotes,
  downvotes,
  userVote,
  onUpdate,
  size = "default",
  layout: _layout = "vertical",
  showCount = true,
}: VoteButtonsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [animatingVote, setAnimatingVote] = useState<"upvote" | "downvote" | null>(
    null
  );

  // Track optimistic state
  const [optimisticState, setOptimisticState] = useState<VoteState>({
    upvotes,
    downvotes,
    userVote,
  });

  // Sync optimistic state when props change
  useEffect(() => {
    setOptimisticState({
      upvotes,
      downvotes,
      userVote,
    });
  }, [upvotes, downvotes, userVote, targetId]);

  const voteMutation = useMutation({
    mutationFn: async (voteType: "upvote" | "downvote") => {
      return await submitVote({ targetId, targetType, voteType });
    },

    onMutate: async (voteType: "upvote" | "downvote") => {
      await cancelVoteQueries(queryClient, targetId, targetType);

      const previousState = { ...optimisticState };
      const newState = calculateOptimisticVoteUpdate(
        optimisticState,
        voteType,
        targetId,
        targetType,
        user?.id || ""
      );

      setOptimisticState(newState);

      updatePostInAllCaches(queryClient, targetId, targetType, (item: any) => ({
        ...item,
        upvotes: newState.upvotes,
        downvotes: newState.downvotes,
        userVote: newState.userVote,
      }));

      return { previousState };
    },

    onError: (err, _voteType, context: any) => {
      if (context?.previousState) {
        setOptimisticState(context.previousState);

        updatePostInAllCaches(
          queryClient,
          targetId,
          targetType,
          (item: any) => ({
            ...item,
            upvotes: context.previousState.upvotes,
            downvotes: context.previousState.downvotes,
            userVote: context.previousState.userVote,
          })
        );
      }

      setAnimatingVote(null);

      if (isUnauthorizedError(err)) {
        toast.warning("Authentication Required", {
          description: "Please connect your wallet to vote.",
        });
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

        updatePostInAllCaches(
          queryClient,
          targetId,
          targetType,
          (item: any) => ({
            ...item,
            upvotes: serverState.upvotes,
            downvotes: serverState.downvotes,
            userVote: serverState.userVote,
          })
        );
      }
    },

    onSettled: () => {
      invalidateVoteQueries(queryClient, targetId, targetType);
      setTimeout(() => setAnimatingVote(null), 300);
      onUpdate();
    },
  });

  const handleVote = (voteType: "upvote" | "downvote") => {
    if (voteMutation.isPending) return;

    console.log("votetype", voteType);
    setAnimatingVote(voteType);
    voteMutation.mutate(voteType);
  };

  // Use optimistic state for display
  // Handle upvotes/downvotes as arrays or numbers
  const displayUpvotes = Array.isArray(optimisticState.upvotes)
    ? optimisticState.upvotes.length
    : optimisticState.upvotes;
  const displayDownvotes = Array.isArray(optimisticState.downvotes)
    ? optimisticState.downvotes.length
    : optimisticState.downvotes;
  const displayUserVote = optimisticState.userVote;

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  // if (layout === "horizontal") {
  return (
    <div className="flex items-center justify-between px-4 md:px-0 md:items-stretch">
      {/* Upvote Button */}
      <button
        disabled={voteMutation.isPending}
        onClick={() => handleVote("upvote")}
        className={`flex flex-1 justify-center md:justify-start text-center md:text-left md:flex-none items-center gap-2 md:px-6 py-3 border-r-[0.5px] border-[#525252]/30 transition-colors ${displayUserVote?.voteType === "upvote"
          ? "text-blue-500 bg-blue-500/30"
          : "text-white hover:bg-gray-800/50"
          } ${voteMutation.isPending ? "opacity-75 cursor-not-allowed" : ""}`}
        title="Upvote"
      >
        {voteMutation.isPending && animatingVote === "upvote" ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <SvgIcon
            src="/icons/up-vote.svg"
            color={
              displayUserVote?.voteType === "upvote"
                ? "text-blue-500"
                : "text-white"
            }
            alt="upvote"
          />
        )}
        {showCount && (
          <span className="text-xs font-normal">{displayUpvotes}</span>
        )}
      </button>

      {/* Downvote Button */}
      <button
        disabled={voteMutation.isPending}
        onClick={() => handleVote("downvote")}
        className={`flex flex-1 justify-center md:justify-start md:flex-none items-center gap-2 md:px-6 py-3 border-r-none md:border-r-[0.5px] border-[#525252]/30 transition-colors ${displayUserVote?.voteType === "downvote"
          ? "text-orange-500 bg-orange-500/30"
          : "text-white hover:bg-gray-800/50"
          } ${voteMutation.isPending ? "opacity-75 cursor-not-allowed" : ""}`}
        title="Downvote"
      >
        {voteMutation.isPending && animatingVote === "downvote" ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <SvgIcon
            src="/icons/down-vote.svg"
            color={
              displayUserVote?.voteType === "downvote"
                ? "text-orange-500"
                : "text-white"
            }
            alt="downvote"
          />
        )}
        {showCount && (
          <span className="text-xs font-normal sm:inline">
            {displayDownvotes}
          </span>
        )}
      </button>
    </div>
  );
}
