import { useMemo, useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import type { ExternalMarket, PollWithDetails, PostWithDetails } from "@/types";
import PostCard from "@/components/cards/PostCard";
import PollCard from "@/components/cards/PollCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "overview" | "discussion" | "posts" | "polls";

type MarketDataResponse = {
  market: ExternalMarket;
  stats?: {
    postCount?: number;
    pollCount?: number;
    discussionCount?: number;
    followerCount?: number;
  };
};

type PaginatedList<T> = {
  posts?: T[];
  pagination?: {
    totalItems?: number;
  };
};

interface DiscussionMessage {
  _id?: string;
  id?: string;
  content: string;
  createdAt?: string;
  author?: {
    username?: string;
    avatar?: string;
  };
}

export default function MarketContent() {
  const params = useParams();
  const marketId = (params.id as string) || "";
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [newMessage, setNewMessage] = useState("");

  const { data: marketData, refetch: refetchMarket } = useApiQuery<MarketDataResponse>({
    endpoint: `markets/${marketId}`,
    queryKey: ["/api/markets", marketId],
    enabled: !!marketId,
    retry: false,
    on401: "returnNull",
    select: (raw: any) => raw,
  });

  const { data: postsData, refetch: refetchPosts } = useApiQuery<PaginatedList<PostWithDetails>>({
    endpoint: `markets/${marketId}/posts`,
    queryKey: ["/api/markets", marketId, "posts"],
    enabled: !!marketId && (activeTab === "posts" || activeTab === "overview"),
    retry: false,
    on401: "returnNull",
    select: (raw: any) => ({
      posts: raw?.posts || [],
      pagination: raw?.pagination || {},
    }),
  });

  const { data: pollsData, refetch: refetchPolls } = useApiQuery<PaginatedList<PollWithDetails>>({
    endpoint: `markets/${marketId}/polls`,
    queryKey: ["/api/markets", marketId, "polls"],
    enabled: !!marketId && (activeTab === "polls" || activeTab === "overview"),
    retry: false,
    on401: "returnNull",
    select: (raw: any) => ({
      posts: raw?.posts || [],
      pagination: raw?.pagination || {},
    }),
  });

  const { data: discussionData, refetch: refetchDiscussion } = useApiQuery<PaginatedList<DiscussionMessage>>({
    endpoint: `markets/${marketId}/discussion`,
    queryKey: ["/api/markets", marketId, "discussion"],
    enabled: !!marketId && (activeTab === "discussion" || activeTab === "overview"),
    retry: false,
    on401: "returnNull",
    select: (raw: any) => ({
      posts: raw?.posts || [],
      pagination: raw?.pagination || {},
    }),
  });

  const followMutation = useApiMutation<{ following: boolean }, void>({
    endpoint: `markets/${marketId}/follow`,
    method: "POST",
    onSuccess: (data) => {
      toast.success(data?.following ? "Following market" : "Unfollowed market");
      refetchMarket();
    },
    onError: () => {
      toast.error("Failed to update follow status");
    },
  });

  const discussionMutation = useApiMutation<any, { content: string }>({
    endpoint: `markets/${marketId}/discussion`,
    method: "POST",
    onSuccess: () => {
      setNewMessage("");
      refetchDiscussion();
      refetchMarket();
      toast.success("Message posted");
    },
    onError: () => {
      toast.error("Failed to post message");
    },
  });

  const market = marketData?.market;
  const posts = useMemo(() => postsData?.posts || [], [postsData]);
  const polls = useMemo(() => pollsData?.posts || [], [pollsData]);
  const messages = useMemo(() => discussionData?.posts || [], [discussionData]);

  if (!marketId) {
    return <div className="text-[#8E8E93]">Missing market id.</div>;
  }

  if (!market) {
    return <div className="text-[#8E8E93]">Loading market...</div>;
  }

  return (
    <div className="flex max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-4 min-w-[200px] mx-auto lg:mx-0">
        <button
          onClick={() => setLocation("/markets")}
          className="text-xs text-[#8E8E93] hover:text-white text-left"
        >
          Back to Markets
        </button>

        <div className="border border-[#525252]/30 bg-[rgba(234,234,234,0.02)] p-4 space-y-3">
          <div className="text-white text-lg">{market.title}</div>
          <div className="text-[#8E8E93] text-xs flex gap-4 flex-wrap">
            <span className="uppercase">{market.source}</span>
            {typeof market.probabilityYes === "number" && (
              <span>Yes: {(market.probabilityYes * 100).toFixed(1)}%</span>
            )}
            {typeof market.liquidity === "number" && (
              <span>Liquidity: {market.liquidity}</span>
            )}
            {market.status && <span>Status: {market.status}</span>}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => followMutation.mutate()}
              disabled={!isAuthenticated || followMutation.isPending}
              className="bg-[#E8EAE9] text-[#17181C] hover:bg-white disabled:opacity-60"
            >
              {followMutation.isPending ? "..." : "Follow"}
            </Button>
            {market.url && (
              <Button
                onClick={() => window.open(String(market.url), "_blank")}
                className="bg-[#1B1C20] text-[#E8EAE9] border border-[#525252]/30 hover:bg-[#26272b]"
              >
                Open Source Market
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-[10px] text-xs text-[#525252]">
          {(["overview", "discussion", "posts", "polls"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 rounded-full font-medium text-xs transition-all uppercase ${
                activeTab === tab ? "bg-[#E8EAE9]" : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-[#525252]/30 p-3 text-xs text-[#8E8E93]">
                Posts: {marketData?.stats?.postCount ?? posts.length}
              </div>
              <div className="border border-[#525252]/30 p-3 text-xs text-[#8E8E93]">
                Polls: {marketData?.stats?.pollCount ?? polls.length}
              </div>
              <div className="border border-[#525252]/30 p-3 text-xs text-[#8E8E93]">
                Discussion: {marketData?.stats?.discussionCount ?? messages.length}
              </div>
            </div>
            <div className="space-y-3">
              {messages.slice(0, 5).map((message: any) => (
                <div key={message._id || message.id} className="border border-[#525252]/30 p-3">
                  <div className="text-xs text-[#8E8E93] mb-1">
                    {message.author?.username || "anonymous"}
                  </div>
                  <div className="text-sm text-[#E8EAE9]">{message.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "discussion" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isAuthenticated ? "Share your market view..." : "Login to post"}
                className="flex-1 bg-[#1B1C20] text-[#E8EAE9] px-4 py-3 rounded border border-[#525252]/30 outline-none"
                disabled={!isAuthenticated}
              />
              <Button
                onClick={() => discussionMutation.mutate({ content: newMessage })}
                disabled={!isAuthenticated || !newMessage.trim() || discussionMutation.isPending}
                className="bg-[#E8EAE9] text-[#17181C] hover:bg-white disabled:opacity-60"
              >
                Post
              </Button>
            </div>

            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-[#8E8E93] text-sm">No discussion yet.</div>
              ) : (
                messages.map((message: any) => (
                  <div key={message._id || message.id} className="border border-[#525252]/30 p-3">
                    <div className="text-xs text-[#8E8E93] mb-1">
                      {message.author?.username || "anonymous"}
                    </div>
                    <div className="text-sm text-[#E8EAE9]">{message.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "posts" && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-[#8E8E93] text-sm">No posts attached to this market yet.</div>
            ) : (
              posts.map((post: any, index: number) => (
                <PostCard key={post.id || post._id} post={post} onUpdate={refetchPosts} index={index} />
              ))
            )}
          </div>
        )}

        {activeTab === "polls" && (
          <div className="space-y-4">
            {polls.length === 0 ? (
              <div className="text-[#8E8E93] text-sm">No polls attached to this market yet.</div>
            ) : (
              polls.map((poll: any) => (
                <PollCard key={poll.id || poll._id} poll={poll} onUpdate={refetchPolls} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

