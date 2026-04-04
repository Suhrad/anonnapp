import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { PollWithDetails } from "@/types";
import { useApiQuery } from "@/hooks/useApi";
import SearchBar from "@/components/searchbar/searchbar";
import PollCard from "@/components/cards/PollCard";
import FeedControls from "@/components/feed-controls/FeedControls";
import PostLoader from "@/components/loaders/PostLoader";
import EmptyPollState from "@/components/empty-states/EmptyPollState";
import { toast } from "sonner";


export default function PollsPage() {
  const { isAuthenticated } = useAuth();
  const [_selectedOptions, _setSelectedOptions] = useState<{
    [pollId: number]: number[];
  }>({});
  const [timeFilter, setTimeFilter] = useState<
    "all" | "hour" | "day" | "week" | "month" | "year"
  >("all");
  const [sortBy, setSortBy] = useState<"hot" | "new">("hot");

  const [_polls, _setPolls] = useState<PollWithDetails[] | null>();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch polls from API
  const {
    data: dbPolls,
    isLoading: pollsLoading,
    refetch: _refetch,
  } = useApiQuery<{ posts: PollWithDetails[] }>({
    endpoint: "polls",
    queryKey: ["/api/polls", sortBy, timeFilter],
    params: {
      sortBy,
      ...(timeFilter !== "all" ? { time: timeFilter } : {}),
    },
  });

  const { data: searchResults, isFetching: _searchLoading } =
    useApiQuery<{ posts: PollWithDetails[] }>({
      endpoint: `polls/search?q=${searchQuery}`,
      queryKey: ["/api/polls/search", searchQuery],
      enabled: !!searchQuery, // only run when searchQuery exists
    });

  const finalPolls =
    searchQuery && searchResults
      ? searchResults?.posts
      : dbPolls?.posts;

  // Authentication handler - similar to PostCard
  const showAuthToast = (action: string) => {
    toast.warning("Authentication Required", {
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

  //   const handlePollVote = (pollId: number, voteType: "upvote" | "downvote") => {
  //     if (!handleAuthRequired("vote on polls")) return;
  //     if (voteMutation.isPending) return;

  //     setAnimatingVote({ pollId, type: voteType });
  //     voteMutation.mutate({ pollId, voteType });
  //   };

  //   const handleVote = (
  //     pollId: number,
  //     optionId: number,
  //     allowMultiple: boolean
  //   ) => {
  //     setSelectedOptions((prev) => {
  //       const current = prev[pollId] || [];

  //       if (allowMultiple) {
  //         const newSelection = current.includes(optionId)
  //           ? current.filter((id) => id !== optionId)
  //           : [...current, optionId];
  //         return { ...prev, [pollId]: newSelection };
  //       } else {
  //         return { ...prev, [pollId]: [optionId] };
  //       }
  //     });
  //   };

  //   const submitVote = async (pollId: number) => {
  //     if (!handleAuthRequired("submit poll votes")) return;

  //     const selectedOptionIds = selectedOptions[pollId];
  //     if (!selectedOptionIds || selectedOptionIds.length === 0) return;

  //     try {
  //       const response = await fetch(`/api/polls/${pollId}/vote`, {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${await (
  //             window as any
  //           ).__getDynamicToken?.()}`,
  //         },
  //         body: JSON.stringify({ optionIds: selectedOptionIds }),
  //       });

  //       if (response.ok) {
  //         setSelectedOptions((prev) => {
  //           const newState = { ...prev };
  //           delete newState[pollId];
  //           return newState;
  //         });
  //         refetch();
  //       }
  //     } catch (error) {
  //       console.error("Error voting on poll:", error);
  //     }
  //   };

  const handleCreatePoll = () => {
    if (!handleAuthRequired("create a poll")) return;
    window.location.href = "/create-post?type=poll";
  };

  return (
    <div className="flex max-w-[1400px] mx-auto">
      {/* Center Feed */}
      <div className="flex-1 flex flex-col gap-4 min-w-[200px] mx-auto lg:mx-0">
        <SearchBar
          placeholder="Blow the whistle ....."
          onSearch={(query) => setSearchQuery(query)}
        />

        {/* Feed Controls */}
        <div className="flex flex-col gap-6 mt-9">
          <FeedControls
            sortBy={sortBy}
            timeFilter={timeFilter}
            onSortChange={setSortBy}
            onTimeFilterChange={setTimeFilter}
          />

          {/* Polls List */}
          <div className="space-y-6">
            {pollsLoading ? (
              <PostLoader />
            ) : finalPolls?.length === 0 ? (
              <EmptyPollState
                searchQuery={searchQuery}
                handleCreatePoll={handleCreatePoll}
              />
            ) : (
              finalPolls?.map((poll: PollWithDetails) => {
                return <PollCard key={poll.id} poll={poll} />;
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
