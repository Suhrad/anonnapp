import { QueryClient } from "@tanstack/react-query";
import { getAllPostsQueryKeys, queryKeys } from "./queryKeys";
import type { Vote } from "@/types";
import { apiCall } from "@/lib/api";

/**
 * Centralized vote handling utility
 * Manages optimistic updates, server communication, and cache invalidation
 */

export interface VoteState {
  upvotes: string[] | number;
  downvotes: string[] | number;
  userVote?: Vote;
}

export interface VoteParams {
  targetId: string | number;
  targetType: "post" | "comment" | "poll";
  voteType: "upvote" | "downvote"; // Changed from "up" | "down" to match backend
}

/**
 * Helper to update vote count or array
 */
function updateVoteValue(
  current: string[] | number,
  action: "add" | "remove",
  userId: string
): string[] | number {
  if (Array.isArray(current)) {
    if (action === "add") {
      return current.includes(userId) ? current : [...current, userId];
    } else {
      return current.filter((id) => id !== userId);
    }
  } else {
    if (action === "add") {
      return current + 1;
    } else {
      return Math.max(0, current - 1);
    }
  }
}

/**
 * Calculate optimistic vote changes
 */
export function calculateOptimisticVoteUpdate(
  currentState: VoteState,
  voteType: "upvote" | "downvote", // Changed from "up" | "down"
  targetId: string | number,
  targetType: "post" | "poll" | "comment",
  userId: string
): VoteState {
  let newUpvotes = currentState.upvotes;
  let newDownvotes = currentState.downvotes;
  let newUserVote = currentState.userVote;

  if (currentState.userVote) {
    if (currentState.userVote.voteType === voteType) {
      // Remove vote (clicking same button twice)
      if (voteType === "upvote") {
        newUpvotes = updateVoteValue(newUpvotes, "remove", userId);
      } else {
        newDownvotes = updateVoteValue(newDownvotes, "remove", userId);
      }
      newUserVote = undefined;
    } else {
      // Change vote type
      if (currentState.userVote.voteType === "upvote") {
        newUpvotes = updateVoteValue(newUpvotes, "remove", userId);
        if (voteType === "downvote") {
          newDownvotes = updateVoteValue(newDownvotes, "add", userId);
        }
      } else {
        newDownvotes = updateVoteValue(newDownvotes, "remove", userId);
        if (voteType === "upvote") {
          newUpvotes = updateVoteValue(newUpvotes, "add", userId);
        }
      }
      newUserVote = {
        ...currentState.userVote,
        voteType,
      };
    }
  } else {
    // New vote
    if (voteType === "upvote") {
      newUpvotes = updateVoteValue(newUpvotes, "add", userId);
    } else {
      newDownvotes = updateVoteValue(newDownvotes, "add", userId);
    }
    newUserVote = {
      id: 0,
      userId: userId,
      targetId: targetId,
      targetType: targetType,
      voteType,
      createdAt: null,
    };
  }

  return {
    upvotes: newUpvotes,
    downvotes: newDownvotes,
    userVote: newUserVote,
  };
}

/**
 * Update a post/poll in all relevant query caches
 */
export function updatePostInAllCaches(
  queryClient: QueryClient,
  targetId: string | number,
  _targetType: "post" | "poll" | "comment",
  updateFn: (item: any) => any
) {
  // Update all possible query caches that might contain this post/poll
  const queries = queryClient.getQueryCache().getAll();

  queries.forEach((query) => {
    const key = query.queryKey;
    if (!Array.isArray(key)) return;

    // Check if this query might contain posts
    const mightContainPosts =
      key[0] === "posts" ||
      key[0] === "/api/posts" ||
      key[0] === "featured-posts" ||
      key[0] === "trending-posts" ||
      key[0] === "polls";

    if (!mightContainPosts) return;

    // Update the query data
    queryClient.setQueryData(key, (oldData: any) => {
      if (!oldData) return oldData;

      // Handle arrays of posts/polls
      if (Array.isArray(oldData)) {
        return oldData.map((item: any) => {
          if (item.id === targetId) {
            return updateFn(item);
          }
          return item;
        });
      }

      // Handle single post/poll
      if (oldData.id === targetId) {
        return updateFn(oldData);
      }

      return oldData;
    });
  });
}

/**
 * Invalidate all relevant queries after a vote
 */
export function invalidateVoteQueries(
  queryClient: QueryClient,
  targetId: string | number,
  targetType: "post" | "poll" | "comment"
) {
  // Invalidate all post-related queries
  const invalidationTargets = getAllPostsQueryKeys();

  invalidationTargets.forEach((target) => {
    queryClient.invalidateQueries(target);
  });

  // Invalidate specific target queries
  if (targetType === "post") {
    queryClient.invalidateQueries({
      queryKey: queryKeys.posts.detail(targetId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.posts.api.comments(targetId),
    });
  } else if (targetType === "poll") {
    queryClient.invalidateQueries({
      queryKey: queryKeys.polls.detail(targetId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.polls.comments(targetId),
    });
  }

  // Invalidate user data to update karma and points
  queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
  queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
}

/**
 * Submit a vote to the server
 */
export async function submitVote(params: VoteParams): Promise<any> {
  const { targetId, targetType, voteType } = params;

  if (targetType === "poll") {
    return await apiCall({
      endpoint: `${import.meta.env.VITE_API_URL}polls/${targetId}/votes`,
      method: "POST",
      body: {
        voteType,
      },
    });
  } else if (targetType === "comment") {
    return await apiCall({
      endpoint: `comments/${targetId}/vote`,
      method: "POST",
      body: {
        voteType,
      },
    });
  } else {
    return await apiCall({
      endpoint: `posts/${targetId}/vote`,
      method: "POST",
      body: {
        voteType,
      },
    });
  }
}

/**
 * Cancel all outgoing queries that might be affected by a vote
 */
export async function cancelVoteQueries(
  queryClient: QueryClient,
  targetId: string | number,
  targetType: "post" | "poll" | "comment"
) {
  // Cancel all post-related queries
  await queryClient.cancelQueries({ queryKey: queryKeys.posts.all() });
  await queryClient.cancelQueries({ queryKey: queryKeys.posts.api.all() });
  await queryClient.cancelQueries({ queryKey: queryKeys.posts.featured() });
  await queryClient.cancelQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      return (
        key[0] === "trending-posts" || (key[0] === "posts" && key.length >= 2)
      );
    },
  });

  // Cancel specific target queries
  if (targetType === "post") {
    await queryClient.cancelQueries({
      queryKey: queryKeys.posts.detail(targetId),
    });
  } else if (targetType === "poll") {
    await queryClient.cancelQueries({
      queryKey: queryKeys.polls.detail(targetId),
    });
  }
}
