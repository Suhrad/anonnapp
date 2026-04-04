
import { SvgIcon } from "../SvgIcon";
import type { BowlWithStats } from "@/types";
import { Minus, Plus, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function BowlCard({
  bowl,
  followingBowls,
  handleUnfollow,
  handleFollow,
  unfollowPending,
  followPending,
  isLoadingMembership,
  leaveButtonStyle,
}: {
  bowl: BowlWithStats;
  followingBowls: Set<string | number>;
  handleAuthRequired: (action: string) => boolean;
  handleUnfollow: (bowlId: number | string) => void;
  handleFollow: (bowlId: number | string) => void;
  unfollowPending: boolean;
  followPending: boolean;
  isLoadingMembership?: boolean;
  leaveButtonStyle?: "default" | "profile";
}) {
  // Normalize ID for Set lookup: keep as string if MongoDB ObjectId, otherwise use as-is
  const normalizedId = typeof bowl.id === 'string' && bowl.id.length === 24 ? bowl.id : (typeof bowl.id === 'number' ? bowl.id : String(bowl.id));
  const isFollowing = followingBowls.has(normalizedId);
  const [, setLocation] = useLocation();

  const handleCardClick = () => {
    // Navigate to bowl detail page
    const bowlId = bowl._id || bowl.id;
    if (bowlId) {
      setLocation(`/bowls/${encodeURIComponent(String(bowlId))}`);
    }
  };

  function formatCount(num: number | undefined | null) {
    if (num === undefined || num === null || isNaN(num)) {
      return "0";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toString();
  }

  return (
    <div
      className="h-[214px] border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] overflow-hidden hover:border-gray-600 transition-colors cursor-pointer flex flex-col"
      onClick={handleCardClick}
    >
      {/* Title & Description */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="text-[#E8EAE9] text-sm font-spacemono">
          {bowl.displayName || "Unknown Channel"}
        </h3>
        <p className="text-[#8E8E93] text-xs leading-relaxed line-clamp-3">
          {bowl.description || ""}
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex border-t border-[0.2px] border-[#525252]/30 text-[#525252] ">
        <div className="flex items-center justify-center text-xs w-1/3 gap-2 py-3 border-r border-[0.2px] border-[#525252]/30">
          <SvgIcon src="/icons/Comments-user icon.svg" />
          <span>{formatCount(bowl.memberCount ?? 0)}</span>
        </div>
        <div className="flex items-center justify-center text-xs w-1/3 gap-2 py-3 border-r border-[0.2px] border-[#525252]/30">
          <SvgIcon src="/icons/Comments-poll icon.svg" />
          <span>{formatCount(bowl.postCount ?? 0)}</span>
        </div>
        <div className="flex items-center justify-center text-xs w-1/3 gap-2 py-3">
          <SvgIcon src="/icons/Comments icon.svg" />
          {/* <span>{formatCount(bowl?.pollCount)}</span> */}
        </div>
      </div>

      {/* Join / Joined Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // Use original bowl.id for API calls (handles both string and number IDs)
          const id = bowl.id;
          if (isFollowing) {
            handleUnfollow(id);
          } else {
            handleFollow(id);
          }
        }}
        disabled={followPending || unfollowPending || isLoadingMembership}
        className={`w-full py-3 flex items-center justify-center gap-2 text-xs font-normal transition-colors
      ${isFollowing
            ? leaveButtonStyle === "profile"
              ? "bg-[#e5e5e5] text-black hover:bg-[#d4d4d4]"
              : "bg-[#1B1C20] text-[#E8EAE9] border-t border-[0.2px] border-[#525252]/30 hover:bg-[#2a2b2f]"
            : "bg-white text-black hover:bg-gray-200"
          }`}
      >
        {isLoadingMembership ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="tracking-wide">Loading...</span>
          </>
        ) : isFollowing ? (
          <>
            <Minus className="w-3 h-3" />
            <span className="tracking-wide">LEAVE</span>
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" />
            <span className="tracking-wide">JOIN</span>
          </>
        )}
      </button>
    </div>
  );
}
