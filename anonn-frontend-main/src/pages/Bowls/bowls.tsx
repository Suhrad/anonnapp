// components/BowlsMain.tsx
import BowlCard from "@/components/cards/BowlCard";
import BowlLoader from "@/components/loaders/BowlLoader";
import SearchBar from "@/components/searchbar/searchbar";

import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutData } from "@/context/LayoutDataContext";
import { apiCall } from "@/lib/api";
import type { BowlWithStats } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface BowlsMainProps {
  onCreatePost?: () => void;
  bowls?: BowlWithStats[];
  organizations?: any[];
}

export default function BowlsPage({
  onCreatePost: _onCreatePost,
  bowls: propBowls,
  organizations: _organizations,
}: BowlsMainProps) {
  const [_location, _setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: _authLoading, user: _user } = useAuth();
  const { bowls: layoutBowls } = useLayoutData();
  const [searchTerm, setSearchTerm] = useState("");
  const [followingBowls, setFollowingBowls] = useState<Set<string | number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [sortBy, setSortBy] = useState("popular");

  // Use data from LayoutDataContext if available, otherwise fetch
  const { data: fetchedBowls = [], isLoading: bowlsLoading } = useApiQuery<
    BowlWithStats[]
  >({
    endpoint: "bowls",
    queryKey: ["/api/bowls"],
    retry: false,
    enabled: !layoutBowls || layoutBowls.length === 0,
    select: (data: any) => data?.bowls || [],
  });

  // Use layout data if available, otherwise use fetched data
  const bowls = useMemo(() => {
    return (layoutBowls && layoutBowls.length > 0)
      ? (layoutBowls as BowlWithStats[])
      : fetchedBowls;
  }, [layoutBowls, fetchedBowls]);

  const { data: searchBowls = [], isLoading: _searchBowlsLoading } = useApiQuery<
    BowlWithStats[]
  >({
    endpoint: `bowls/search?q=${searchTerm}`,
    queryKey: ["/api/bowls"],
    retry: false,
    select: (data: any) => data?.bowls || [],
  });

  // Get user's joined bowls from auth/me endpoint - use consistent query key
  type JoinedBowl = string | { _id?: string; id?: string | number } | { _id: string } | { id: string | number };
  const { data: currentUser, isLoading: isLoadingUserBowls } = useApiQuery<{ user: { joinedBowls?: JoinedBowl[] } }>({
    endpoint: "auth/me",
    queryKey: ["/api/auth/me"],
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    on401: "returnNull",
  });

  // Update following bowls when user data changes
  useEffect(() => {
    if (currentUser?.user?.joinedBowls) {
      const newSet = new Set<string | number>();
      currentUser.user.joinedBowls.forEach((bowl) => {
        // Handle both MongoDB ObjectId (_id) and regular id
        // joinedBowls can be an array of ObjectIds (strings) or populated Bowl objects
        let id: string | number | undefined;
        if (typeof bowl === 'string') {
          id = bowl;
        } else if (typeof bowl === 'object' && bowl !== null) {
          id = ('_id' in bowl && bowl._id) || ('id' in bowl && bowl.id) || undefined;
        }
        if (id) {
          // Keep as string if it's a MongoDB ObjectId, otherwise use as-is
          const normalizedId = typeof id === 'string' && id.length === 24 ? id : (typeof id === 'number' ? id : String(id));
          newSet.add(normalizedId);
        }
      });
      setFollowingBowls(newSet);
    } else if (isAuthenticated && currentUser && !currentUser.user?.joinedBowls) {
      // User is authenticated but has no joined bowls, clear the set
      setFollowingBowls(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.user?.joinedBowls, isAuthenticated]);

  // Use prop bowls if provided, otherwise use fetched bowls
  const displayBowls =
    propBowls ?? searchBowls ?? bowls ?? [];

  // Sort bowls
  const sortedBowls = [...displayBowls].sort((a, b) => {
    if (sortBy === "popular") {
      return b.memberCount - a.memberCount;
    } else if (sortBy === "newest") {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    }
    return 0;
  });

  // const followMutation = useMutation({
  //   mutationFn: async (bowlId: number) => {
  //     const response = await apiRequest(
  //       "POST",
  //       `/api/bowls/${bowlId}/follow`,
  //       {}
  //     );
  //     return response.json();
  //   },
  //   onSuccess: (data, bowlId) => {
  //     setFollowingBowls((prev) => new Set([...Array.from(prev), bowlId]));
  //     queryClient.invalidateQueries({ queryKey: ["/api/user/bowls"] });
  //     queryClient.invalidateQueries({ queryKey: ["/api/bowls"] });
  //     refetchUserBowls();
  //     toast({
  //       title: "Success",
  //       description: "Channel followed successfully!",
  //     });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: "Failed to follow channel",
  //       variant: "destructive",
  //     });
  //   },
  // });

  const followMutation = useApiMutation({
    endpoint: "bowls/:id/join",
    mutationFn: async (bowlId: number | string) => {
      // Convert bowlId to string for API call (handles both number and MongoDB ObjectId string)
      const id = String(bowlId);
      return apiCall({
        endpoint: `bowls/${id}/join`,
        method: "POST"
      });
    },
    method: "POST",
    invalidateQueries: [["/api/user/bowls", "/api/bowls", "/api/auth/me"]],
    onSuccess: (_data, bowlId) => {
      // Normalize ID: keep as string if it's a MongoDB ObjectId, otherwise use as-is
      const id = typeof bowlId === 'string' && bowlId.length === 24 ? bowlId : (typeof bowlId === 'number' ? bowlId : String(bowlId));
      setFollowingBowls((prev) => new Set([...Array.from(prev), id]));
      toast.success("Success", {
        description: "Channel followed successfully!",
      });
    },
    onError: (error, bowlId) => {
      // Handle 400 error (already a member) as success
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('400') || errorMessage.includes('Already a member')) {
        // User is already a member, update state to reflect this
        const id = typeof bowlId === 'string' && bowlId.length === 24 ? bowlId : (typeof bowlId === 'number' ? bowlId : String(bowlId));
        setFollowingBowls((prev) => new Set([...Array.from(prev), id]));
        toast.success("Success", {
          description: "You are already a member of this channel",
        });
      } else {
        toast.error("Error", {
          description: "Failed to follow channel",
        });
      }
    },
  });

  const unfollowMutation = useApiMutation({
    endpoint: "bowls/:id/leave",
    mutationFn: async (bowlId: number | string) => {
      // Convert bowlId to string for API call (handles both number and MongoDB ObjectId string)
      const id = String(bowlId);
      return apiCall({
        endpoint: `bowls/${id}/leave`,
        method: "DELETE",
      });
    },
    method: "DELETE",
    onSuccess: (_data: unknown, bowlId: number | string) => {
      // Normalize ID: keep as string if it's a MongoDB ObjectId, otherwise use as-is
      const id = typeof bowlId === 'string' && bowlId.length === 24 ? bowlId : (typeof bowlId === 'number' ? bowlId : String(bowlId));
      setFollowingBowls((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/bowls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bowls"] });
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

  // Authentication handler - similar to PostCard
  const showAuthToast = useCallback((action: string) => {
    toast.warning("Authentication Required", {
      description: `Please connect your wallet to ${action}.`,
    });
  }, []);

  const handleAuthRequired = useCallback(
    (action: string, callback?: () => void) => {
      if (!isAuthenticated) {
        showAuthToast(action);
        return false;
      }
      callback?.();
      return true;
    },
    [isAuthenticated, showAuthToast]
  );

  const handleFollow = useCallback(
    (bowlId: number | string) => {
      // if (!handleAuthRequired("follow channels")) return;
      followMutation.mutate(bowlId);
    },
    [handleAuthRequired, followMutation]
  );

  const handleUnfollow = useCallback(
    (bowlId: number | string) => {
      if (!handleAuthRequired("unfollow channels")) return;
      unfollowMutation.mutate(bowlId);
    },
    [handleAuthRequired, unfollowMutation]
  );

  if (bowlsLoading) {
    return <BowlLoader />;
  }

  return (
    <div className="flex max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-6 mt-9 min-w-[200px] mx-auto lg:mx-0">
        {/* Category Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[10px] text-xs text-[#525252]">
            <button
              onClick={() => setSelectedCategory("general")}
              className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${selectedCategory === "general"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              GENERAL
            </button>
            <button
              onClick={() => setSelectedCategory("industries")}
              className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${selectedCategory === "industries"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              INDUSTRIES
            </button>
            <button
              onClick={() => setSelectedCategory("job-groups")}
              className={`px-4 py-4 rounded-[58px] font-medium text-xs transition-all ${selectedCategory === "job-groups"
                ? "bg-[#E8EAE9]"
                : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
                }`}
            >
              JOB GROUPS
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative w-[145px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="p-4 pr-8 rounded-[58px] bg-[#1B1C20] text-[#525252] text-xs font-medium uppercase tracking-wide border-none focus:outline-none appearance-none cursor-pointer hover:text-gray-300"
            >
              <option value="popular" className="bg-[#1a1a1a]">
                MOST POPULAR
              </option>
              <option value="newest" className="bg-[#1a1a1a]">
                NEWEST
              </option>
              <option value="active" className="bg-[#1a1a1a]">
                MOST ACTIVE
              </option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search different bowls."
          onSearch={(query) => setSearchTerm(query)}
        />

        {/* Bowls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedBowls.map((bowl) => (
            <BowlCard
              key={bowl.id}
              bowl={bowl}
              followingBowls={followingBowls}
              handleAuthRequired={handleAuthRequired}
              handleUnfollow={handleUnfollow}
              handleFollow={handleFollow}
              unfollowPending={unfollowMutation.isPending}
              followPending={followMutation.isPending}
              isLoadingMembership={isLoadingUserBowls && isAuthenticated}
            />
          ))}
        </div>

        {sortedBowls.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">
              No channels found matching your criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
