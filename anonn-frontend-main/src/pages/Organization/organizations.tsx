// components/OrganizationsContent.tsx
import CreateOrganizationDialog from "@/components/Dialog/CreateOrganizationDialog";
import SearchBar from "@/components/searchbar/searchbar";
import { SvgIcon } from "@/components/SvgIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutData } from "@/context/LayoutDataContext";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { OrganizationWithStats } from "@/types";
import { Building } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type TabType = "verified" | "recent" | "popular";

export default function OrganizationsPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("verified");
  const { organizations: layoutOrganizations } = useLayoutData();

  useEffect(() => {
    document.title = "Companies & Organizations";
  }, []);

  // Use data from LayoutDataContext if available, otherwise fetch
  const { data: fetchedOrganizations = [], isLoading } = useApiQuery<
    OrganizationWithStats[]
  >({
    endpoint: "companies",
    queryKey: ["/api/companies"],
    retry: false,
    enabled: !layoutOrganizations || layoutOrganizations.length === 0,
    select: (data: any) => data?.companies || [],
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/auth";
      }
    },
  });

  // Use layout organizations if available, otherwise use fetched organizations
  // Cast layoutOrganizations to OrganizationWithStats[] since they're compatible
  const organizations: OrganizationWithStats[] = (layoutOrganizations as OrganizationWithStats[]) || fetchedOrganizations;

  const { data: organizationsSearch = [], isLoading: isLoadingSearch } = useApiQuery<
    OrganizationWithStats[]
  >({
    endpoint: `companies?search=${encodeURIComponent(searchQuery)}`,
    queryKey: ["/api/companies", "search", searchQuery],
    retry: false,
    enabled: !!searchQuery,
    select: (data: any) => data?.companies || [],
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/auth";
      }
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

  // Handle search from SearchBar component
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Calculate trust percentage from post statistics
  const getTrustPercentage = (org: OrganizationWithStats) => {
    // Use positivePosts and negativePosts from the organization data
    if (org.positivePosts !== undefined && org.negativePosts !== undefined) {
      const totalPosts = org.positivePosts + org.negativePosts;
      if (totalPosts > 0) {
        // Calculate trust percentage based on positive vs negative posts
        const trustPercentage = Math.round(
          (org.positivePosts / totalPosts) * 100
        );
        const distrustPercentage = 100 - trustPercentage;
        return {
          trust: trustPercentage,
          distrust: distrustPercentage,
        };
      }
    }

    // Fallback to existing trustData if available
    if (org.trustData?.trustPercentage !== undefined) {
      return {
        trust: org.trustData.trustPercentage,
        distrust: 100 - org.trustData.trustPercentage,
      };
    }

    // Default fallback
    return { trust: 80, distrust: 20 };
  };

  function formatNumber(num?: number) {
    if (!num) return "0";

    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    }

    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    }

    return num.toLocaleString();
  }

  // Get member count - uses author count from organization data, falls back to followerCount
  const getMemberCount = (org: OrganizationWithStats) => {
    // Use authorCount from the organization data if available, otherwise fall back to followerCount
    return formatNumber(org.authorCount !== undefined ? org.authorCount : org.followerCount);
  };

  // Get engagement count
  const getEngagementCount = (org: OrganizationWithStats) => {
    return formatNumber(org.pollCount);
  };

  // Get activity percentage
  const getActivityPercentage = (org: OrganizationWithStats) => {
    return formatNumber(org.postCount);
  };

  const finalCompanies =
    searchQuery && organizationsSearch.length > 0
      ? organizationsSearch
      : organizations;

  const isSearching = !!searchQuery && isLoadingSearch;

  const renderOrganizationCard = (org: OrganizationWithStats) => {
    const trustScores = getTrustPercentage(org);
    const memberCount = getMemberCount(org);
    const engagementCount = getEngagementCount(org);
    const activityPercentage = getActivityPercentage(org);

    const handleCardClick = (_e: React.MouseEvent) => {
      if (!handleAuthRequired("view organization details")) return;
      setLocation(`/organizations/${encodeURIComponent(org.id)}`);
    };

    return (
      <div
        key={org.id}
        onClick={handleCardClick}
        className="flex flex-col mb-6 pt-4 border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] hover:bg-[#222222] transition-all duration-200  cursor-pointer"
      >
        <div className="flex mb-4 px-4 items-center justify-between">
          {/* Left: Logo and Info */}
          <div className="flex items-start flex-1">
            {/* Company Logo */}
            {org.logo && (
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <img src={org.logo} />
              </div>
            )}
          </div>

          {/* Right: Trust Scores */}
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
            {/* Positive/Negative Percentage Badges */}
            <div className="flex items-center">
              <div className="bg-[#ABEFC6] flex justify-center py-2 px-2 text-[#079455] font-semibold text-xs text-center">
                {trustScores.trust}%
              </div>
              <div className="bg-[#FDA29B] flex justify-center py-2 px-2 text-[#D92D20] font-semibold text-xs text-center">
                {trustScores.distrust}%
              </div>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="flex-1 min-w-0 gap-4 mb-4 px-4">
          <h3 className="text-[#E8EAE9] text-sm mb-4 font-normal font-spacemono">
            {org.name}
          </h3>
          <p className="text-[#8E8E93] text-xs leading-relaxed line-clamp-2 ">
            {org.description ||
              "Welcome to the Web3 Privacy Collective, a community focused on privacy in the decentralized web. We unite enthusiasts and developers who believe privacy is a funda..."}
          </p>
        </div>

        {/* Stats Row at Bottom */}
        <div className="flex items-center gap-8 text-[#525252] text-base border-t-[0.2px] border-[#525252]/30">
          <div className="flex justify-center flex-1 items-center gap-2 py-3 border-r-[0.2px] border-[#525252]/30">
            <SvgIcon src="/icons/Comments-user icon.svg" />
            <span className="font-medium text-xs">{memberCount}</span>
          </div>

          <div className="flex justify-center flex-[2] items-center gap-2 py-3 border-r-[0.2px] border-[#525252]/30">
            <SvgIcon src="/icons/Comments-poll icon.svg" />
            <span className="font-medium text-xs">{engagementCount}</span>
          </div>

          <div className="flex justify-center flex-[2] items-center gap-2 py-3">
            <SvgIcon src="/icons/Comments icon.svg" />
            <span className="font-medium text-xs">{activityPercentage}</span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-black text-white px-4 pt-6 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-32 bg-gray-800 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-800 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-800 rounded animate-pulse"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-gray-800 rounded animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-6 mt-9 min-w-[200px] mx-auto lg:mx-0">
        {/* Tabs */}
        <div className="flex items-center gap-[10px] text-xs text-[#525252]">
          <button
            onClick={() => setActiveTab("verified")}
            className={`px-4 py-4 rounded-full font-medium text-xs transition-all ${activeTab === "verified"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
              }`}
          >
            VERIFIED
          </button>
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-4 py-4 rounded-full font-medium text-xs transition-all  ${activeTab === "recent"
              ? "bg-[#E8EAE9]"
              : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
              }`}
          >
            RECENTLY ADDED
          </button>
          <button
            onClick={() => setActiveTab("popular")}
            className={`px-4 py-4 rounded-full font-medium text-xs transition-all  ${activeTab === "popular"
              ? "bg-[#E8EAE9] "
              : "bg-[#1B1C20] hover:bg-[#E8EAE9]"
              }`}
          >
            POPULAR
          </button>
        </div>

        {/* Search Bar Component */}
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search for companies..."
        />

        {/* Organizations List */}
        <div className="space-y-0">
          {isSearching ? (
            // Show skeleton loaders while searching
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col mb-6 pt-4 border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)]"
                >
                  <div className="flex mb-4 px-4 items-center justify-between">
                    <div className="flex items-start flex-1">
                      <Skeleton className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-gray-800" />
                    </div>
                    <div className="flex items-center gap-3 md:gap-6 shrink-0">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-12 bg-gray-800" />
                        <Skeleton className="h-8 w-12 bg-gray-800" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 gap-4 mb-4 px-4">
                    <Skeleton className="h-5 w-48 mb-4 bg-gray-800" />
                    <Skeleton className="h-4 w-full mb-2 bg-gray-800" />
                    <Skeleton className="h-4 w-3/4 bg-gray-800" />
                  </div>
                  <div className="flex items-center gap-8 text-[#525252] text-base border-t-[0.2px] border-[#525252]/30">
                    <div className="flex justify-center flex-1 items-center gap-2 py-3 border-r-[0.2px] border-[#525252]/30">
                      <Skeleton className="h-4 w-4 bg-gray-800" />
                      <Skeleton className="h-4 w-8 bg-gray-800" />
                    </div>
                    <div className="flex justify-center flex-2 items-center gap-2 py-3 border-r-[0.2px] border-[#525252]/30">
                      <Skeleton className="h-4 w-4 bg-gray-800" />
                      <Skeleton className="h-4 w-8 bg-gray-800" />
                    </div>
                    <div className="flex justify-center flex-2 items-center gap-2 py-3">
                      <Skeleton className="h-4 w-4 bg-gray-800" />
                      <Skeleton className="h-4 w-8 bg-gray-800" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : finalCompanies.length > 0 ? (
            finalCompanies.map(renderOrganizationCard)
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No organizations found
              </h3>
              <p className="text-gray-500 mb-6">
                Try adjusting your search or filters
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  Clear Search
                </Button>
                <CreateOrganizationDialog
                  trigger={
                    <Button className="bg-green-500 hover:bg-green-600 text-white">
                      Add Organization
                    </Button>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
