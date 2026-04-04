import BowlCard from "@/components/cards/BowlCard";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useAuth } from "@/hooks/useAuth";
import { apiCall } from "@/lib/api";
import type { BowlWithStats } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfileCommunity({ userCommunities }: {
  userCommunities: BowlWithStats[]
}) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [followingBowls, setFollowingBowls] = useState<Set<string | number>>(new Set());

  // Initialize followingBowls from userCommunities (all are joined in profile)
  useEffect(() => {
    const newSet = new Set<string | number>();
    userCommunities.forEach((bowl) => {
      const id = bowl._id || bowl.id;
      if (id) {
        const normalizedId = typeof id === 'string' && id.length === 24 ? id : (typeof id === 'number' ? id : String(id));
        newSet.add(normalizedId);
      }
    });
    setFollowingBowls(newSet);
  }, [userCommunities]);

  const unfollowMutation = useApiMutation({
    endpoint: "bowls/:id/leave",
    mutationFn: async (bowlId: number | string) => {
      const id = String(bowlId);
      return apiCall({
        endpoint: `bowls/${id}/leave`,
        method: "DELETE",
      });
    },
    method: "DELETE",
    onSuccess: (_data: unknown, bowlId: number | string) => {
      const id = typeof bowlId === 'string' && bowlId.length === 24 ? bowlId : (typeof bowlId === 'number' ? bowlId : String(bowlId));
      setFollowingBowls((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/bowls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bowls"] });
      queryClient.invalidateQueries({ queryKey: ["user-bowls"] });
      toast.success("Success", {
        description: "Channel unfollowed successfully!",
      });
    },
    onError: () => {
      toast.error("Error", {
        description: "Failed to unfollow channel",
      });
    },
  });

  const handleAuthRequired = useCallback(
    (action: string, callback?: () => void) => {
      if (!isAuthenticated) {
        toast.warning("Authentication Required", {
          description: `Please connect your wallet to ${action}.`,
        });
        return false;
      }
      callback?.();
      return true;
    },
    [isAuthenticated]
  );

  const handleUnfollow = useCallback(
    (bowlId: number | string) => {
      if (!handleAuthRequired("unfollow channels")) return;
      unfollowMutation.mutate(bowlId);
    },
    [handleAuthRequired, unfollowMutation]
  );

  const handleFollow = useCallback(() => {
    // Not used in profile page since all bowls are already joined
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center h-[40px]">
        <p className="text-[#525252] text-sm font-medium">
          [ {userCommunities.length} TOTAL ]
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {userCommunities.map((community) => (
          <BowlCard
            key={community.id}
            bowl={community}
            followingBowls={followingBowls}
            handleAuthRequired={handleAuthRequired}
            handleUnfollow={handleUnfollow}
            handleFollow={handleFollow}
            unfollowPending={unfollowMutation.isPending}
            followPending={false}
            isLoadingMembership={false}
            leaveButtonStyle="profile"
          />
        ))}
      </div>
    </div>
  );
}
