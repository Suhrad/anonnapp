import ActivityRows from "@/pages/Profile/ActivityRows";
import { SvgIcon } from "../SvgIcon";
import { useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type WhistleProps = {
  activityRows:
  {
    src: string;
    text: string;
    value: string;
  }[]
};

type LeaderboardUser = {
  _id?: string;
  id?: string;
  username?: string;
  points?: number;
  walletAddress?: string;
};

type LeaderboardResponse = {
  users?: LeaderboardUser[];
  data?: LeaderboardUser[];
};

export default function Whistle({ activityRows }: WhistleProps) {
  const [activeView, setActiveView] = useState<"leaderboard" | "how-it-works">("how-it-works");
  const { dbProfile, user } = useAuth();

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useApiQuery<LeaderboardResponse>({
    queryKey: ["/api/users/leaderboard"],
    endpoint: "users/leaderboard",
    enabled: activeView === "leaderboard",
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    select: (data: any) => {
      // Handle different response formats
      // API might return: { users: [...] } or directly an array
      if (Array.isArray(data)) {
        return { users: data };
      }
      return {
        users: data?.users || data?.data || [],
      };
    },
  });

  const leaderboardUsers = leaderboardData?.users || [];

  // Get current user's stats
  const currentUserPoints = dbProfile?.points || user?.points || 0;
  const currentUserInvites = 0; // TODO: Replace with actual invite count from API when available
  const currentUserRankIndex = leaderboardUsers.findIndex(
    (u) => (u._id || u.id) === (dbProfile?._id || dbProfile?.id || user?.id)
  );
  const currentUserRank = currentUserRankIndex >= 0 ? currentUserRankIndex + 1 : null;

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  // Get ordinal suffix for rank
  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return num + "ST";
    if (j === 2 && k !== 12) return num + "ND";
    if (j === 3 && k !== 13) return num + "RD";
    return num + "TH";
  };

  // Copy invite link to clipboard
  const handleCopyLink = async () => {
    const inviteLink = `${window.location.origin}?ref=${dbProfile?._id || dbProfile?.id || user?.id || ""}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copied!", {
        description: "Your invite link has been copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy", {
        description: "Please copy the link manually.",
      });
    }
  };

  return (
    <div className="space-y-9">
      {/* Header with Leaderboard and How It Works */}
      <div className="flex items-center gap-[10px]">
        <button
          onClick={() => setActiveView("leaderboard")}
          className={`flex-1 py-6 text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition-colors ${
            activeView === "leaderboard"
              ? "bg-[#E8EAE9] text-[#525252]"
              : "bg-[#1B1C20] text-[#525252] hover:text-[#E8EAE9]"
          }`}
        >
          <SvgIcon src="@/icons/Leaderboard.svg" />
          LEADERBOARD
        </button>
        <button
          onClick={() => setActiveView("how-it-works")}
          className={`flex-1 py-6 text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition-colors ${
            activeView === "how-it-works"
              ? "bg-[#E8EAE9] text-[#525252]"
              : "bg-[#1B1C20] text-[#525252] hover:text-[#E8EAE9]"
          }`}
        >
          <SvgIcon src="@/icons/star.svg" />
          HOW IT WORKS
        </button>
      </div>

      {activeView === "leaderboard" ? (
        <div className="space-y-9">
          {/* User Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Total Points Card */}
            <div className="bg-[rgba(234,234,234,0.02)] border border-[#525252]/30 p-4 flex flex-col items-center justify-center text-center">
              <div className="text-[#8E8E93] text-xs font-medium tracking-wide uppercase mb-2">
                TOTAL POINTS
              </div>
              <div className="text-white text-4xl font-bold mb-2" style={{ fontFamily: 'monospace' }}>
                {formatNumber(currentUserPoints)}
              </div>
              {currentUserRank && (
                <div className="text-[#8E8E93] text-xs">
                  {getOrdinalSuffix(currentUserRank)}
                </div>
              )}
            </div>

            {/* Total Invites Card */}
            <div className="bg-[rgba(234,234,234,0.02)] border border-[#525252]/30 flex flex-col items-center justify-center text-center overflow-hidden">
              <div className="px-4 pt-4 pb-4">
                <div className="text-[#8E8E93] text-xs font-medium tracking-wide uppercase mb-2">
                  TOTAL INVITES
                </div>
                <div className="text-white text-4xl font-bold mb-4">
                  {formatNumber(currentUserInvites)}
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full bg-white hover:bg-gray-100 text-black text-xs font-medium tracking-wide uppercase py-3 px-4 flex items-center justify-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                COPY LINK
              </button>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-[rgba(234,234,234,0.02)] border border-[#525252]/30 overflow-hidden">
            {/* Table Headers */}
            <div className="grid grid-cols-[80px_1fr_150px] border-b border-[#525252]/30">
              <div className="flex py-3 px-4 items-center text-[#8E8E93] text-xs font-medium tracking-wide uppercase">
                RANK
              </div>
              <div className="flex py-3 px-4 items-center text-[#8E8E93] text-xs font-medium tracking-wide uppercase border-x border-[#525252]/30">
                USER
              </div>
              <div className="flex py-3 px-4 items-center justify-center text-[#8E8E93] text-xs font-medium tracking-wide uppercase">
                POINTS
              </div>
            </div>

            {/* Leaderboard Rows */}
            <div>
              {isLoadingLeaderboard ? (
                <div className="py-8 text-center text-[#8E8E93] text-sm">
                  Loading leaderboard...
                </div>
              ) : leaderboardUsers.length === 0 ? (
                <div className="py-8 text-center text-[#8E8E93] text-sm">
                  No users found
                </div>
              ) : (
                leaderboardUsers.map((leaderboardUser, index) => {
                  const rank = index + 1;
                  const username = leaderboardUser.username || `User${rank}`;
                  const points = leaderboardUser.points || 0;

                  return (
                    <div
                      key={leaderboardUser._id || leaderboardUser.id || index}
                      className="grid grid-cols-[80px_1fr_150px] border-b border-[#525252]/30 last:border-b-0 hover:bg-[rgba(234,234,234,0.05)] transition-colors"
                    >
                      <div className="flex py-3 px-4 items-center text-white text-sm">
                        {rank}
                      </div>
                      <div className="flex py-3 px-4 items-center text-white text-sm border-x border-[#525252]/30">
                        <span className="underline cursor-pointer hover:text-[#A0D9FF] transition-colors">
                          {username}
                        </span>
                      </div>
                      <div className="flex py-3 px-4 items-center justify-center gap-2 text-white text-sm">
                        <span>{formatNumber(points)}</span>
                        <SvgIcon src="@/icons/star.svg" className="text-[#60A5FA] shrink-0" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Info Box */}
          <div className="bg-[#1e3a5f] border-l-[5px] border-[#A0D9FF] py-4 px-9">
            <p className="text-[#E0F2FE] text-sm leading-relaxed">
              Everything that you do at anonn generates you points thats everything
              from a comment to upvote to invite and posting. This translates
              directly to the{" "}
              <span className="text-[#7CD4FD] font-semibold">airdrop</span> you will
              receive
            </p>
          </div>

          {/* Activity Points Table */}
          <div className="bg-[rgba(234,234,234,0.02)] border border-[#525252]/30 overflow-hidden">
            {/* Table Headers */}
            <div className="grid grid-cols-[0.8fr_2.5fr_1fr] border-b border-[#525252]/30">
              <span></span>
              <div className="flex py-3 ml-4 items-center text-[#8E8E93] text-xs border-r border-[#525252]/30">
                Activity
              </div>
              <div className="flex py-3 justify-center items-center text-[#8E8E93] text-xs">
                Points
              </div>
            </div>

            {/* Activity Rows */}
            <div>
              {activityRows.map((row, index) => (
                <ActivityRows
                  src={row.src}
                  value={row.value}
                  text={row.text}
                  key={index}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
