import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Check, ChevronDown, Copy, Edit3, MessageCircle, MessageSquare, Twitter } from "lucide-react";
import { SvgIcon } from "@/components/SvgIcon";
import { useEffect, useRef, useState } from "react"; // Added useRef
import { Link, useLocation } from "wouter";
import { useWallet } from "@solana/wallet-adapter-react";
import type { User } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function LeftSidebar() {
  const { isAuthenticated, user } = useAuth();
  const { publicKey } = useWallet();
  const [location, setLocation] = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [isCopied, setIsCopied] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null); // Added ref for profile dropdown

  // Fetch user profile with points - use consistent query key to share cache
  const { data: userProfile } = useApiQuery<User>({
    queryKey: ["/api/auth/me"],
    endpoint: "auth/me",
    enabled: isAuthenticated,
    on401: "returnNull",
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    select: (data: any) => data?.user || data,
  });

  const mutation = useApiMutation({
    endpoint: "/api/auth/logout",
    method: "POST",
  });

  // Check screen size and set initial state
  // Check screen size and set initial state - FIXED VERSION
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint is 1024px
      setIsMobile(mobile);

      // Use a functional update to get the *current* state
      // This avoids stale state and dependency loops
      setIsOpen((currentIsOpen) => {
        if (mobile && currentIsOpen) {
          return false; // Collapse if mobile and currently open
        } else if (!mobile && !currentIsOpen) {
          return true; // Expand if desktop and currently closed
        }
        return currentIsOpen; // Otherwise, no change
      });
    };

    // Initial check
    checkScreenSize();

    // Add event listener
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []); // Empty dependency array is now correct

  // Load favorites from server on component mount
  // const { data: serverFavorites } = useApiQuery<{ bowlId: number }[]>({
  //   endpoint: "user/favorites",
  //   queryKey: ["/api/user/favorites"],
  //   retry: false,
  //   enabled: true,
  // });

  // Sync with server favorites when available
  // useEffect(() => {
  //   if (serverFavorites) {
  //     const serverFavoritesSet = new Set(serverFavorites.map((f) => f.bowlId));
  //     localStorage.setItem(
  //       "bowl-favorites",
  //       JSON.stringify(Array.from(serverFavoritesSet))
  //     );
  //   }
  // }, [serverFavorites]);

  // Get notifications for unseen count (only when authenticated)
  const { data: notifications } = useApiQuery<
    Array<{ id: number; read: boolean }>
  >({
    endpoint: "notifications",
    queryKey: ["notifications"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Calculate unseen notification count
  // Normalize notifications to array if not already
  const notificationList: Array<{ id: number; read: boolean }> = Array.isArray(notifications)
    ? notifications
    : (notifications && Array.isArray((notifications as any).data))
      ? (notifications as any).data
      : [];

  const unseenNotificationCount = notificationList.filter((n: { read: boolean }) => !n.read).length;

  // Format wallet address to abbreviated form (e.g., "0XAS....2343")
  const formatWalletAddress = (address: string | null | undefined): string => {
    if (!address) return "";
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}....${address.slice(-4)}`;
  };

  const walletAddress = user?.walletAddress || publicKey?.toString() || "";

  // Copy wallet address to clipboard
  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  // Main navigation items
  const sidebarItems: Array<{
    href: string;
    label: string;
    iconPath: string;
    isActive: boolean;
    badge?: number;
  }> = [
      {
        href: "/",
        label: "HOME",
        iconPath: "@/icons/Home icon.svg",
        isActive: location === "/",
      },
      {
        href: "/polls",
        label: "POLLS",
        iconPath: "@/icons/Polls icon.svg",
        isActive: location === "/polls",
      },
      ...(isAuthenticated ? [{
        href: "/notifications",
        label: "NOTIFICATIONS",
        iconPath: "@/icons/Notifications icon.svg",
        isActive: location === "/notifications",
        badge: unseenNotificationCount > 0 ? unseenNotificationCount : 0,
      }] : []),
      {
        href: "/markets",
        label: "MARKETS",
        iconPath: "@/icons/Hot icon.svg",
        isActive: location.startsWith("/markets"),
      },
      {
        href: "/bowls",
        label: "BOWLS",
        iconPath: "@/icons/Bowls icon.svg",
        isActive: location.startsWith("/bowls") && !isProfileOpen,
      },
    ];

  const [showHot, setShowHot] = useState(!isMobile); // Auto-collapse hot section on mobile

  // Fetch top hot posts dynamically
  const { data: hotPostsData } = useApiQuery<{ posts: Array<{ id: string; _id?: string; title: string }> }>({
    queryKey: ["/api/posts/hot-sidebar"],
    endpoint: "posts",
    params: { sortBy: "hot", limit: 5, page: 1 },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
    select: (data: any) => ({ posts: data?.posts || [] }),
  });

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setIsProfileOpen(!isProfileOpen);
    if (!isProfileOpen) {
      setLocation("/profile");
    }
  };

  const handleSubmenuClick = (e: React.MouseEvent, href: string) => {
    e.stopPropagation(); // Prevent event from bubbling to parent
    setLocation(href);
    // Don't close the dropdown - keep it open
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to parent
    setIsLogoutDialogOpen(true);
  };

  const performLogout = async () => {
    try {
      // Call server logout endpoint
      // await apiRequest("POST", "/api/auth/logout", {});
      mutation.mutate({});

      // Clear localStorage items
      localStorage.removeItem("phantom_auth_token");
      localStorage.removeItem("bowl-favorites");
      localStorage.removeItem("dynamic_store");
      localStorage.removeItem("dynamic_device_fingerprint");
      localStorage.removeItem("walletName");
      localStorage.removeItem("wallet-uicluster");
      // Clear any other auth-related items

      // Clear sessionStorage
      sessionStorage.clear();

      // Redirect to auth page
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      // Even if server logout fails, still clear local data and redirect
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    }
  };

  // Toggle sidebar function
  const handleToggleSidebar = () => {
    setIsOpen(!isOpen);

    // When expanding sidebar on mobile, also expand the hot section
    if (!isOpen && isMobile) {
      setShowHot(true);
    }
  };

  useEffect(() => {
    if (
      location === "/profile" ||
      location === "/settings" ||
      location === "/bookmarks"
    ) {
      setIsProfileOpen(true);
    } else {
      setIsProfileOpen(false);
    }
  }, [location]);
  // Auto-expand hot section when sidebar expands
  useEffect(() => {
    if (isOpen && isMobile) {
      setShowHot(true);
    }
  }, [isOpen, isMobile]);

  return (
    <div
      className={`pt-0 flex flex-col h-full transition-all duration-300 ${isMobile ? (isOpen ? "w-64" : "w-20") : ""
        } relative z-10`}
    >
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-5"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Header with Toggle Button - Hidden on lg screens and above */}
      {isMobile && (
        <div className="flex justify-between items-center px-4 mb-0">
          {isOpen && (
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">
              Navigation
            </h2>
          )}
          <button
            onClick={handleToggleSidebar}
            className={`p-2 rounded-md hover:bg-[#252525] transition-colors duration-200 ${!isOpen ? "mx-auto" : ""
              }`}
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-400 transform rotate-90" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 transform -rotate-90" />
            )}
          </button>
        </div>
      )}

      {/* Wallet & Points Display - Only show when authenticated and sidebar is open */}
      {isAuthenticated && isOpen && walletAddress && (
        <div className="mb-2">
        <div className="flex items-center justify-between px-4 py-6 border border-[#525252]/20 w-full">
            {/* Left side: Wallet icon and address */}
            <div 
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer relative"
              onClick={handleCopyAddress}
            >
              <SvgIcon
                src="@/icons/wallet2.svg"
                className="text-[#525252] shrink-0"
                alt="wallet"
              />
              <span className="text-sm text-[#525252] truncate">
                {formatWalletAddress(walletAddress)}
              </span>
              <div className="relative h-3 w-3 shrink-0">
                <AnimatePresence mode="wait">
                  {isCopied ? (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0"
                    >
                      <Check className="h-3 w-3 text-[#525252]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.1 }}
                      className="absolute inset-0"
                    >
                      <Copy className="h-3 w-3 text-[#525252]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {/* Divider */}
            <div className="self-stretch w-px bg-[#525252]/30 mx-2 shrink-0"></div>
            {/* Right side: Star icon and points */}
            <div className="flex items-center gap-2 shrink-0">
              <SvgIcon
                src="@/icons/star.svg"
                className="text-[#60A5FA] shrink-0"
                alt="points"
                forceFill
              />
              <span className="text-sm text-gray-300 font-medium">
                {userProfile?.points?.toLocaleString() || user?.points?.toLocaleString() || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="flex-1 flex flex-col scrollbar-hide overflow-y-auto relative z-10 ">
        {/* Main Navigation */}
        <LayoutGroup id="side-nav">
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex gap-[10px] items-center py-[10px] px-4 text-sm font-normal rounded-lg transition-all duration-200 group ${item.isActive
                      ? "text-white bg-[#2a2a2a]"
                      : "text-gray-200 hover:text-gray-300 hover:bg-[#252525]"
                    } ${!isOpen ? "justify-center" : ""}`}
                  title={!isOpen ? item.label : undefined}
                >
                  <motion.div
                    className={`relative z-10`}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <SvgIcon
                      src={item.iconPath}
                      alt={item.label}
                      className={`transition-all duration-200 ${item.isActive ? "text-white" : "text-[#525252]"
                        }`}
                      forceFill={item.isActive}
                    />
                  </motion.div>

                  {isOpen && (
                    <div className="flex justify-between flex-1 items-center">
                      <div
                        className={`relative z-10 truncate font-medium text-sm uppercase
                      ${item.isActive ? "text-white" : "text-[#525252]"}`}
                      >
                        {item.label}
                      </div>
                      {/* This badge only appears when sidebar is OPEN */}
                      {item.badge && (
                        <div
                          className={`
                          flex items-center justify-center
                          h-5 min-w-5 px-1
                          rounded-full 
                          text-xs font-semibold
                          ${item.isActive
                              ? "bg-white text-black"
                              : "bg-[#525252] text-white"
                            }
                        `}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </div>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Profile Dropdown */}
            {isAuthenticated && (
              <Link
                href="/chat"
                className={`relative flex gap-[10px] items-center py-[10px] px-4 mb-1 text-sm font-normal rounded-lg transition-all duration-200 group ${
                  location === "/chat"
                    ? "text-white bg-[#2a2a2a]"
                    : "text-gray-200 hover:text-gray-300 hover:bg-[#252525]"
                } ${!isOpen ? "justify-center" : ""}`}
                title={!isOpen ? "CHAT" : undefined}
              >
                <motion.div
                  className="relative z-10"
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <MessageSquare
                    className={`h-4 w-4 transition-all duration-200 ${
                      location === "/chat" ? "text-white" : "text-[#525252]"
                    }`}
                  />
                </motion.div>
                {isOpen && (
                  <div
                    className={`relative z-10 truncate font-medium text-sm uppercase ${
                      location === "/chat" ? "text-white" : "text-[#525252]"
                    }`}
                  >
                    CHAT
                  </div>
                )}
              </Link>
            )}

            {isAuthenticated && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={handleProfileClick}
                  className={`relative flex items-center w-full px-4 py-[10px] text-sm font-normal rounded-lg transition-all duration-200 group ${location === "/profile" ||
                      location === "/settings" ||
                      location === "/bookmarks" ||
                      isProfileOpen
                      ? "text-white bg-[#2a2a2a]"
                      : "text-[#525252] hover:bg-[#252525]"
                    } ${!isOpen ? "justify-center" : ""}`}
                >
                  <motion.div
                    className={`relative z-10 ${isOpen ? "mr-3" : ""}`}
                    animate={
                      location === "/profile" || location === "/settings"
                        ? { scale: 1, y: 0 }
                        : { scale: 1, y: 0 }
                    }
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <SvgIcon
                      src="@/icons/Profile-sidebar icon.svg"
                      alt="profile"
                      className={`transition-all duration-200 ${location === "/profile" ||
                          location === "/settings" ||
                          location === "/bookmarks"
                          ? "text-white"
                          : "text-[#525252]"
                        }`}
                      forceFill={
                        location === "/profile" ||
                        location === "/settings" ||
                        location === "/bookmarks"
                      }
                    />
                  </motion.div>

                  {isOpen && (
                    <>
                      <span className="relative z-10 truncate font-semibold text-sm uppercase flex-1 text-left">
                        PROFILE
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""
                          }`}
                      />
                    </>
                  )}
                </button>

                {/* Profile Submenu - Only show when sidebar is open */}
                {isAuthenticated && isProfileOpen && isOpen && (
                  <div className="mt-1 ml-3 space-y-1  pl-3">
                    {isMobile && (
                      <button
                        onClick={(e) => handleSubmenuClick(e, "/create-post")}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-300 hover:bg-[#252525] rounded-lg transition-all duration-200"
                      >
                        <Edit3 className="h-4 w-4 mr-3" />
                        <span className="text-sm">CREATE</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => handleSubmenuClick(e, "/bookmarks")}
                      className={`flex gap-[10px] items-center w-full px-4 py-[10px] text-sm rounded-lg transition-all duration-200 ${location === "/bookmarks"
                          ? "text-white bg-[#2a2a2a]"
                          : "text-[#525252] hover:text-gray-300 hover:bg-[#252525]"
                        }`}
                    >
                      <SvgIcon
                        src="@/icons/Bookmark-sidebar.svg"
                        noFill={location !== "/bookmarks"}
                        className={`transition-all duration-200 ${location === "/bookmarks"
                            ? "text-white"
                            : "text-[#525252]"
                          }`}
                        forceFill={location === "/bookmarks"}
                      />
                      <span
                        className={`text-sm font-medium ${location === "/bookmarks"
                            ? "text-white"
                            : "text-[#525252]"
                          }`}
                      >
                        BOOKMARKS
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleSubmenuClick(e, "/settings")}
                      className={`flex gap-[10px] items-center w-full px-4 py-[10px] text-sm rounded-lg transition-all duration-200 ${location === "/settings"
                          ? "text-white bg-[#2a2a2a]"
                          : "text-[#525252] hover:text-gray-300 hover:bg-[#252525]"
                        }`}
                    >
                      <SvgIcon
                        src="@/icons/Settings-sidebar.svg"
                        noFill={location !== "/settings"}
                        className={`transition-all duration-200 ${location === "/settings"
                            ? "text-white"
                            : "text-[#525252]"
                          }`}
                        forceFill={location === "/settings"}
                      />
                      <span
                        className={`text-sm font-medium ${location === "/settings"
                            ? "text-white"
                            : "text-[#525252]"
                          }`}
                      >
                        SETTINGS
                      </span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex gap-[10px] items-center w-full px-4 py-[10px] text-xs rounded-lg  hover:bg-[#252525] transition-all duration-200 text-red-400 hover:text-red-300"
                    >
                      <SvgIcon
                        src="@/icons/Logout.svg"
                        className="text-[#7A271A]"
                        noFill
                      />
                      <span className="text-sm font-medium text-[#7A271A]">
                        LOGOUT
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </LayoutGroup>

        {/* Divider - Only show when sidebar is open */}
        {isOpen && <div className="my-2 mx-4 h-px bg-gray-700"></div>}

        {/* HOT Section */}
        <div className="mb-6">
          {isOpen && (
            <button
              onClick={() => setShowHot((s) => !s)}
              className="group w-full px-4 py-[10px] text-sm font-medium text-white uppercase tracking-wider mb-2 flex items-center justify-between  rounded-md"
            >
              <div className="flex items-center gap-2">
                <SvgIcon
                  src="@/icons/Hot icon.svg"
                  className="transition-all duration-200 text-white"
                />
                <span>HOT</span>
              </div>
            </button>
          )}
          <div
            className={`space-y-1 overflow-hidden transition-[max-height,opacity] duration-300 ${showHot && isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            {(hotPostsData?.posts || []).map((post) => (
              <Link
                key={post.id || post._id}
                href={`/post?id=${post._id || post.id}`}
                className="block font-spacemono px-4 py-3 text-sm underline text-[#8E8E93] hover:text-gray-300 hover:bg-[#252525] rounded transition-all duration-200 cursor-pointer"
              >
                {post.title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Points/Airdrop Info Box
      {isOpen && (
        <div className="px-3 mb-4">
          <div className="relative bg-[#3b4a57] border-l-4 border-[#60A5FA] p-4">
            <div className="text-white text-xs leading-relaxed">
              <p>Everything that you do at</p>
              <p>anonn generates you points</p>
              <p>thats everything from a</p>
              <p>comment to upvote to invite</p>
              <p>and posting. This translates</p>
              <p>directly to the{" "}
                <span className="text-[#a0d9fe]">airdrop</span> you
              </p>
              <p>will receive</p>
            </div>
          </div>
        </div>
      )}
 */}
      {/* Social Media Links - Bottom */}
      <div className="mt-auto px-3 pb-4">
        <div
          className={`flex ${isOpen
              ? "justify-center space-x-3"
              : "flex-col justify-center space-y-3"
            }`}
        >
          <a
            href="https://discord.gg/2M4DxRUkXR"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-[#252525] hover:text-gray-300 transition-all duration-200"
            title="Discord"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
          </a>

          <a
            href="https://x.com/Anonn_xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center p-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-[#252525] hover:text-gray-300 transition-all duration-200"
            title="X (Twitter)"
          >
            <Twitter className="w-5 h-5 shrink-0" />
          </a>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent className="bg-[]  border border-[#525252]/30 rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-spacemono text-base font-normal text-[#E8EAE9] leading-normal">
              Are you sure you want to logout?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-spacemono text-base font-normal text-[#E8EAE9] leading-normal">
              You will need to log in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600 rounded-none">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performLogout}
              className="bg-red-900 text-white hover:bg-red-700 rounded-none"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
