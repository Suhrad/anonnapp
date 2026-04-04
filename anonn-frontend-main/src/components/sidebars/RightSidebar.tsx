import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useApiQuery } from "@/hooks/useApiQuery";
import WalletConnectButton from "@/components/WalletConnectButton";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Bowl, Organization, User } from "@/types";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";

import { ArrowRight, Camera, Circle, Edit3, Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";


import { z } from "zod";
import { SvgIcon } from "@/components/SvgIcon";
import { toast } from "sonner";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

interface RightSidebarProps {
  bowls?: Bowl[];
  organizations?: Organization[];
  onCreatePost: (type?: string) => void;
}

// Add the profile schema (same as backend)
const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  avatar: z.string().url().optional(),
});

type ProfileData = z.infer<typeof profileSchema>;

export default function RightSidebar({
  bowls,
  organizations,
  onCreatePost,
}: RightSidebarProps) {
  const {
    isAuthenticated,
    user,
    login,
    getAccessToken,
    setDbProfile,
    isLoading: authLoading,
    isRestoredSession,
    dbProfile,
    refreshProfile,
  } = useAuth();
  // const { setVisible } = useWalletModal();
  const { connected, publicKey, connecting: _connecting } = useWallet();
  const queryClient = useQueryClient();

  // Get user ID for fetching profile stats
  const userId = dbProfile?._id || dbProfile?.id || user?.id;

  // Fetch user profile with stats - use consistent query key for auth/me
  const { data: userProfile, refetch: refetchUserProfile } = useApiQuery<User & { stats?: { posts: number; polls: number; comments: number } }>({
    queryKey: userId ? ["user-profile-stats", userId] : ["/api/auth/me"],
    endpoint: userId ? `users/${userId}` : "auth/me",
    enabled: isAuthenticated && !!userId,
    on401: "returnNull",
    retry: false,
    staleTime: 30 * 1000, // Cache for 30 seconds
    select: (data: any) => data?.user || data,
  });

  const [location] = useLocation();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editUsernameDialogOpen, setEditUsernameDialogOpen] = useState(false);

  const [editImageDialogOpen, setEditImageDialogOpen] = useState(false); // Add image edit dialog
  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isConnecting, setIsConnecting] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [imageUrl, setImageUrl] = useState(""); // For image URL input
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // For file upload
  const [imagePreview, setImagePreview] = useState<string>(""); // For preview
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file"); // Upload mode toggle

  // const [showHot, setShowHot] = useState(!isMobile); // Auto-collapse hot section on mobile
  // Auto-authenticate if wallet is connected and token exists but not authenticated
  useEffect(() => {
    // Only run if not authenticated, not loading, but wallet is connected
    if (!isAuthenticated && !authLoading && connected && publicKey) {
      const phantomToken = localStorage.getItem("phantom_auth_token");
      const metamaskToken = localStorage.getItem("metamask_auth_token");
      if (phantomToken || metamaskToken) {
        // Attempt login (will be a no-op if already authenticated)
        login();
      }
    }
  }, [isAuthenticated, authLoading, connected, publicKey, login]);

  // Check if we're on the profile page
  const isProfilePage =
    location.includes("/profile") ||
    location.includes("/settings") ||
    location.includes("/bookmarks");
  const isBowlsPage = location.includes("/bowls");
  const isOrganizationsPage = location.includes("/organizations");

  // React Hook Form for profile editing
  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      bio: user?.bio || "",
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        username: user.username || "",
        bio: user.bio || "",
      });
    }
  }, [user, profileForm]);

  // Helper function to parse and format error messages
  const parseError = async (response: Response): Promise<string> => {
    try {
      const errorText = await response.text();
      let errorData: any;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If not JSON, treat as plain text
        return errorText || `Failed to update profile: ${response.status}`;
      }

      // Check if it's a validation error with errors array
      if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        // Extract validation error messages
        const errorMessages = errorData.errors
          .map((err: any) => err.msg || err.message)
          .filter(Boolean);
        
        if (errorMessages.length > 0) {
          return errorMessages.join(". ");
        }
      }

      // Check if it's a server error (500+)
      if (response.status >= 500) {
        return "Server error. Please try again later.";
      }

      // For other errors, return the message if available
      return errorData.message || errorData.error || `Failed to update profile: ${response.status}`;
    } catch (parseError) {
      // If parsing fails, check status code
      if (response.status >= 500) {
        return "Server error. Please try again later.";
      }
      return `Failed to update profile: ${response.status}`;
    }
  };

  // Function to update profile
  const updateProfile = async (data: ProfileData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(
          "Authentication token not available. Please log in again."
        );
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorMessage = await parseError(response);
        throw new Error(errorMessage);
      }

      const updatedUser = await response.json();
      setDbProfile(updatedUser);

      // Refresh profile in auth context
      await refreshProfile();

      // Refetch user profile stats to update the sidebar
      await refetchUserProfile();

      // Invalidate related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["user-profile-stats", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-stats"] });

      toast.success("Profile updated!", {
        description: "Your profile has been updated successfully.",
      });

      setEditUsernameDialogOpen(false);
      setEditImageDialogOpen(false);
    } catch (error) {
      console.error("[profile] Profile update error:", error);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes("fetch")) {
        toast.error("Profile update failed", {
          description: "Server error. Please try again later.",
        });
      } else {
        toast.error("Profile update failed", {
          description:
            error instanceof Error
              ? error.message
              : "Unable to update profile. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle username edit specifically
  const handleUsernameEdit = () => {
    setNewUsername(user?.username || "");
    setEditUsernameDialogOpen(true);
  };

  const submitUsernameEdit = async () => {
    if (!newUsername.trim()) return;

    await updateProfile({ username: newUsername.trim() });
  };

  // Handle profile image edit
  const handleImageEdit = () => {
    setImageUrl(user?.avatar || "");
    setSelectedFile(null);
    setImagePreview("");
    setUploadMode("file");
    setEditImageDialogOpen(true);
  };

  // Helper function to process a file (used by both file select and paste)
  const processImageFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please select an image file",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    setSelectedFile(file);
    setImageUrl(""); // Clear URL when file is selected
    setUploadMode("file"); // Switch to file mode

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  // Handle paste event for images
  const handlePaste = useCallback(async (e: Event) => {
    const clipboardEvent = e as ClipboardEvent;
    // Only handle paste when the image edit dialog is open
    if (!editImageDialogOpen) return;

    const items = clipboardEvent.clipboardData?.items;
    if (!items) return;

    // Look for image items in clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the item is an image
      if (item.type.startsWith("image/")) {
        clipboardEvent.preventDefault();
        clipboardEvent.stopPropagation();

        // Get the file from clipboard
        const file = item.getAsFile();
        if (file) {
          processImageFile(file);
          toast.success("Image pasted!", {
            description: "Image has been pasted. Click 'Upload Image' to save.",
          });
        }
        return;
      }
    }
  }, [editImageDialogOpen, processImageFile]);

  // Add paste event listener when image edit dialog is open
  useEffect(() => {
    if (editImageDialogOpen) {
      window.addEventListener("paste", handlePaste);
      return () => {
        window.removeEventListener("paste", handlePaste);
      };
    }
  }, [editImageDialogOpen, handlePaste]);

  const submitImageEdit = async () => {
    if (uploadMode === "file") {
      // File upload mode
      if (!selectedFile) {
        toast.warning("No file selected", {
          description: "Please select an image file to upload",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        // Upload to Cloudinary
        const uploadedUrl = await uploadImageToCloudinary(
          selectedFile,
          "user-pfps"
        );

        // Update profile with Cloudinary URL
        await updateProfile({
          ...profileForm.getValues(),
          avatar: uploadedUrl,
        });

        setSelectedFile(null);
        setImagePreview("");
      } catch (error) {
        console.error("[RightSidebar] Image upload error:", error);
        toast.error("Upload failed", {
          description:
            error instanceof Error
              ? error.message
              : "Failed to upload image. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // URL input mode
      if (!imageUrl.trim()) {
        toast.warning("Image URL required", {
          description: "Please enter a valid image URL",
        });
        return;
      }

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        toast.error("Invalid URL", {
          description: "Please enter a valid image URL",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        await updateProfile({
          ...profileForm.getValues(),
          avatar: imageUrl.trim(),
        });
      } catch (error) {
        console.error("[RightSidebar] Profile update error:", error);
        toast.error("Update failed", {
          description: "Failed to update profile image. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle wallet connection and authentication flow
  // Use a ref to track if we've shown the toast this session (survives re-renders)
  const hasShownWalletToastRef = useRef(false);

  useEffect(() => {
    // Only trigger authentication if not already in progress or authenticated
    if (connected && publicKey && !isAuthenticated && !authLoading) {
      handleAuthentication();
    }

    // Show "Wallet connected!" toast only once after successful authentication
    // AND only for fresh sign-ups (not restored sessions)
    if (isAuthenticated && !isRestoredSession && !hasShownWalletToastRef.current) {
      toast.success("Wallet connected!", {
        description: `Successfully authenticated with Anonn.`,
      });
      hasShownWalletToastRef.current = true;
    }

    // Only show dialog if bio is empty and not completed
    if (isAuthenticated && user) {
      const hasBio = Boolean(user.bio && user.bio.trim());
      const profileCompleted = localStorage.getItem("profile_completed");
      if (!hasBio && profileCompleted !== "true") {
        setBio(user.bio || "");
        setProfileDialogOpen(true);
      } else {
        setProfileDialogOpen(false);
      }
    }
  }, [connected, publicKey, isAuthenticated, user, authLoading, isRestoredSession]);

  // Handle connecting state
  // No need to set connecting state, use 'connecting' directly from useWallet

  const handleAuthentication = async () => {
    try {
      if (!publicKey) {
        // Only show error if publicKey is not available after connection
        console.warn("[RightSidebar] No public key available yet");
        return;
      }
      // Call login to trigger wallet connection (backend auth is handled by useAuth hook)
      await login();
      // Immediately update UI with wallet address
      setDbProfile({ walletAddress: publicKey.toString() });
    } catch (error) {
      // Only log the error, don't show toast - useAuth hook handles the actual backend auth
      // and will show appropriate errors there
      console.error("[RightSidebar] handleAuthentication error:", error);
      // Only show error if it's a wallet connection error, not backend auth error
      if (error instanceof Error && error.message.includes("connect")) {
        toast.error("Wallet connection failed", {
          description: "Failed to connect to your wallet. Please try again.",
        });
      }
    }
  };

  // Use WalletConnectButton for simple wallet connect UI
  const handleConnectWallet = () => {
    console.log("[RightSidebar] handleConnectWallet called, isAuthenticated:", isAuthenticated);
    if (isAuthenticated) {
      console.log("[RightSidebar] onCreatePost type:", typeof onCreatePost, "value:", onCreatePost);
      if (onCreatePost && typeof onCreatePost === 'function') {
        console.log("[RightSidebar] Calling onCreatePost()");
        try {
          onCreatePost();
          console.log("[RightSidebar] onCreatePost() completed");
        } catch (error) {
          console.error("[RightSidebar] Error calling onCreatePost:", error);
        }
      } else {
        console.error("[RightSidebar] onCreatePost is not a function:", onCreatePost);
      }
      return;
    }
    // WalletConnectButton will handle wallet modal
  };

  // const handleEditProfile = () => {
  //   navigate("/settings");
  // };

  // Calculate trust percentage from post statistics
  const getTrustPercentage = (org: Organization) => {
    // Use positivePosts and negativePosts from the organization data
    if ('positivePosts' in org && 'negativePosts' in org) {
      const orgWithStats = org as Organization & { positivePosts?: number; negativePosts?: number };
      if (orgWithStats.positivePosts !== undefined && orgWithStats.negativePosts !== undefined) {
        const totalPosts = orgWithStats.positivePosts + orgWithStats.negativePosts;
        if (totalPosts > 0) {
          // Calculate trust percentage based on positive vs negative posts
          const trustPercentage = Math.round(
            (orgWithStats.positivePosts / totalPosts) * 100
          );
          const distrustPercentage = 100 - trustPercentage;
          return {
            trust: trustPercentage,
            distrust: distrustPercentage,
          };
        }
      }
    }

    // Fallback to existing bullishCount/bearishCount if available
    if (org.bullishCount !== undefined && org.bearishCount !== undefined) {
      const total = org.bullishCount + org.bearishCount;
      if (total > 0) {
        const trustPercentage = Math.round((org.bullishCount / total) * 100);
        return {
          trust: trustPercentage,
          distrust: 100 - trustPercentage,
        };
      }
    }

    // Default fallback
    return { trust: 80, distrust: 20 };
  };

  async function submitProfile() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(
          "Authentication token not available. Please try logging in again."
        );
      }

      if (!user || !user.id) {
        throw new Error("User ID not available.");
      }

      const payload = {
        bio: bio.trim() || undefined,
      };

      // Use correct endpoint: /api/users/me
      const response = await fetch(`${import.meta.env.VITE_API_URL}users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await parseError(response);
        throw new Error(errorMessage);
      }

      const { user: updatedUser } = await response.json();
      setDbProfile(updatedUser);

      // Refresh profile in auth context
      await refreshProfile();

      // Refetch user profile stats to update the sidebar
      await refetchUserProfile();

      // Invalidate related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["user-profile-stats", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-stats"] });

      toast.success("Profile completed!", {
        description: "Your profile has been set up successfully.",
      });
      localStorage.setItem("profile_completed", "true");
      setProfileDialogOpen(false);
    } catch (error) {
      console.error("[auth] Profile submission error:", error);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes("fetch")) {
        toast.error("Profile update failed", {
          description: "Server error. Please try again later.",
        });
      } else {
        toast.error("Profile update failed", {
          description:
            error instanceof Error
              ? error.message
              : "Unable to complete your profile. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pt-4 flex flex-col h-full overflow-y-auto transition-all duration-300 relative z-10 bg-[#0a0a0a]">
      {/* Content */}
      {/* Conditional Section based on Authentication */}
      <div>
        <div className="relative h-[180px] w-full bg-[linear-gradient(117deg,_#A0D9FF_-0.07%,_#E8EAE9_99.93%)] overflow-hidden">
          <div className="h-5 w-5 bg-[#0A0A0A] absolute top-0 left-0"></div>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {(() => {
                console.log("[RightSidebar] Render check - connected:", connected, "isAuthenticated:", isAuthenticated);
                if (!connected) {
                  return <WalletConnectButton />;
                }
                if (isAuthenticated) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        console.log("[RightSidebar] Button clicked!", e);
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("[RightSidebar] About to call handleConnectWallet");
                        handleConnectWallet();
                      }}
                      onMouseDown={(e) => {
                        console.log("[RightSidebar] Button mousedown!", e);
                      }}
                      className="flex items-center gap-2 uppercase text-gray-700 text-xl hover:text-gray-900 hover:scale-105 font-normal px-4 py-2 rounded-md transition-colors disabled:opacity-50 outline-none shadow-none cursor-pointer"
                      style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                    >
                      <span style={{ pointerEvents: 'none' }}>
                        <SvgIcon src="@/icons/Create pencil.svg" />
                      </span>
                      <span style={{ pointerEvents: 'none' }}>CREATE</span>
                    </button>
                  );
                }
                // If a token exists, show 'Authenticating...' else prompt to connect wallet
                if (localStorage.getItem("phantom_auth_token") || localStorage.getItem("metamask_auth_token")) {
                  return (
                    <Button disabled className="flex items-center gap-2 px-4 py-2 rounded-md">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </Button>
                  );
                }
                return <WalletConnectButton />;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex mb-4 items-center border-l-[0.2px] border-r-[0.2px] border-b-[0.2px] border-[#525252]/30">
        <button
          onClick={() => onCreatePost("poll")}
          className="flex flex-1 items-center text-[#E8EAE9] justify-center gap-4 py-4 hover:bg-gray-900 text-xs font-medium transition-colors border-r border-[#525252]/30"
        >
          {/* <BarChart3 className="w-3 h-3" /> */}
          <SvgIcon src="@/icons/Polls icon.svg" />
          POLL
        </button>
        <button
          onClick={() => onCreatePost("text")}
          className="flex flex-1 items-center text-[#E8EAE9] justify-center gap-4 py-4 hover:bg-gray-900 text-xs font-medium transition-colors"
        >
          {/* <FileText className="w-3 h-3" /> */}
          <SvgIcon src="@/icons/Post option icon.svg" />
          POST
        </button>
      </div>

      {/* COMMUNITIES Section */}
      {!isProfilePage && !isBowlsPage && (
        <>
          <div className="px-4 mb-2">
            <div className="flex items-center gap-[10px] py-[10px] mb-4">
              <Circle className="h-3 w-3 text-white fill-white" />
              <div className="font-medium text-[#E8EAE9] uppercase text-xs">
                COMMUNITIES
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {bowls?.slice(0, 4).map((bowl, idx) => {
                const bowlId = bowl._id || bowl.id;
                return (
                  <div key={bowlId || idx}>
                    <a
                      href={`/bowls/${encodeURIComponent(String(bowlId))}`}
                      className="font-spacemono text-[#8E8E93] hover:text-white transition-colors text-xs underline block"
                    >
                      {bowl.name?.toLowerCase().replace(/\s+/g, "")}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* COMPANIES Section */}
      {!isProfilePage && !isOrganizationsPage && (
        <>
          <div className="px-4 flex flex-col flex-1 min-h-0">
            <div className="text-xs py-[8px] text-[#E8EAE9] font-medium mb-4 flex items-center gap-2 uppercase tracking-wide">
              <SvgIcon src="@/icons/Companies-right icon.svg" />
              COMPANIES
            </div>
            <div className="space-y-4 overflow-y-auto scrollbar-hide flex-1 pb-3">
              {organizations?.slice(0, 5).map((org, index) => {
                const orgId = org.id;
                const trustScores = getTrustPercentage(org);
                return (
                  <a
                    key={orgId || index}
                    href={`/organizations/${encodeURIComponent(String(orgId))}`}
                    className="flex items-center justify-between hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <div
                      className={`w-4 h-4 flex items-center justify-center flex-shrink-0`}
                    >
                      {org.logo && <img src={org.logo} className="fit" />}
                    </div>
                    <span className="text-xs text-[#8E8E93] truncate">
                      {org.name}
                    </span>

                    <div className="flex items-center">
                      <div className="bg-[#ABEFC6] flex justify-center py-1 w-[30px] text-[#079455] font-semibold text-xs disabled:opacity-50  text-center">
                        {trustScores.trust}
                      </div>
                      <div className="bg-[#FDA29B] flex justify-center py-1 w-[30px] text-[#D92D20] font-semibold text-xs disabled:opacity-50 text-center">
                        {trustScores.distrust}
                      </div>
                    </div>

                    {/* <div className="flex items-center flex-shrink-0">
                    <div className="px-[7.5px] py-[11px] bg-[#ABEFC6] text-[#079455] text-xs font-bold w-[30px] text-center">
                      {Math.floor(Math.random() * 40) + 60}
                    </div>
                    <div className="px-2 py-2 bg-red-300 text-red-900  text-xs font-bold min-w-[32px] text-center">
                      {Math.floor(Math.random() * 40) + 30}
                    </div>
                  </div> */}
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Profile Edit Section - Only show on profile page when authenticated */}
      {isAuthenticated && isProfilePage && (
        <>
          {/* Profile Image Section */}
          <div className="border mt-4 border-[#525252]/30">
            <div className="relative px-2 py-4">
              <div className="relative h-[218px] mx-auto">
                <Avatar className="w-full h-full rounded-none">
                  <AvatarImage
                    src={
                      user?.avatar ||
                      DEFAULT_PROFILE_PICTURE
                    }
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gray-800 text-white font-bold text-4xl rounded-none">
                    {user?.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Edit Icon on Image - Fixed to open image edit dialog */}
                <button
                  onClick={handleImageEdit}
                  className="absolute bottom-4 text-[#E8EAE9] right-4 w-[30px] h-[30px] bg-[#17181C] hover:bg-black flex items-center justify-center transition-colors"
                >
                  <SvgIcon src="@/icons/Pencil.svg" />
                </button>
              </div>
            </div>

            {/* Username Section */}
            <div className="px-2 py-4">
              <div className="relative border px-6 border-[#525252]/30 ">
                <div className="absolute -top-3 px-2 py-1 bg-[#17181C] text-xs inline-block text-[#525252] border border-[#525252]/30 uppercase tracking-wider">
                  USERNAME
                </div>
                <div className="flex items-center justify-between py-5">
                  <span className="text-[#8E8E93] underline text-xs font-medium">
                    {user?.username || "Anonymous"}
                  </span>
                  <button
                    onClick={handleUsernameEdit}
                    className="w-3.5 h-3.5 text-[#E8EAE9] flex items-center justify-center hover:bg-gray-800 transition-colors"
                  >
                    <SvgIcon src="@/icons/Pencil.svg" />
                  </button>
                </div>
              </div>

              {/* Stats Section */}
              <div className="flex border w-full border-[#525252]/30 ">
              <div className="px-6 py-3 flex flex-1 items-center justify-center text-[#525252] gap-2 border-[#525252]/30 border-r">
                  <SvgIcon src="@/icons/profile-share.svg" />
                </div>
                <div className="px-6 py-3 flex flex-1 items-center justify-center text-[#525252] gap-2 border-[#525252]/30 border-r">
                  <SvgIcon src="@/icons/Post option icon.svg" />
                  <div className="text-xs">{userProfile?.stats?.posts || 0}</div>
                </div>
                <div className="px-6 py-3 flex flex-1 items-center justify-center text-[#525252] gap-2">
                  <SvgIcon src="@/icons/Polls icon.svg" />
                  <div className="text-xs">{userProfile?.stats?.polls || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Username Edit Dialog */}
      <Dialog
        open={editUsernameDialogOpen}
        onOpenChange={setEditUsernameDialogOpen}
      >
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-black border-gray-700">
          <DialogHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#a8d5e2] to-[#b3d9e6] rounded-2xl mb-4">
              <Edit3 className="h-8 w-8 text-gray-900" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">
              Edit Username
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">
              Choose a new username for your profile
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Username
              </label>
              <Input
                placeholder="Enter new username..."
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="rounded-xl border-gray-600 bg-gray-900 text-white focus:border-[#a8d5e2] focus:ring-[#a8d5e2]/20 h-12"
              />
            </div>
          </div>
          <DialogFooter className="pt-6">
            <Button
              disabled={isSubmitting || !newUsername.trim()}
              onClick={submitUsernameEdit}
              className="w-full h-12 bg-gradient-to-r from-[#a8d5e2] to-[#b3d9e6] text-gray-900 font-bold rounded-xl disabled:opacity-50 shadow-lg hover:from-[#9bc8d5] hover:to-[#a6ccd9]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  Updating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Update Username
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Image Edit Dialog */}
      <Dialog open={editImageDialogOpen} onOpenChange={setEditImageDialogOpen}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-black border-gray-700">
          <DialogHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#a8d5e2] to-[#b3d9e6] rounded-2xl mb-4">
              <Camera className="h-8 w-8 text-gray-900" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">
              Update Profile Image
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">
              Upload an image, paste from clipboard, or enter a URL
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {/* Upload Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setUploadMode("file");
                  setImageUrl("");
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === "file"
                    ? "bg-[#a8d5e2] text-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("url");
                  setSelectedFile(null);
                  setImagePreview("");
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === "url"
                    ? "bg-[#a8d5e2] text-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Enter URL
              </button>
            </div>

            {uploadMode === "file" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Select Image
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center hover:border-[#a8d5e2] transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="image-upload"
                    disabled={isSubmitting}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Camera className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-400">
                      Click to select, drag and drop, or paste (Ctrl+V)
                    </span>
                    <span className="text-xs text-gray-500">
                      PNG, JPG up to 5MB
                    </span>
                  </label>
                </div>
                {imagePreview && (
                  <div className="flex justify-center mt-4">
                    <div className="w-32 h-32 border border-gray-600 rounded overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Image URL
                </label>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="rounded-xl border-gray-600 bg-gray-900 text-white focus:border-[#a8d5e2] focus:ring-[#a8d5e2]/20 h-12"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Enter a direct link to your profile image
                </p>
                {imageUrl && (
                  <div className="flex justify-center mt-4">
                    <div className="w-20 h-20 border border-gray-600 rounded overflow-hidden">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="pt-6">
            <Button
              disabled={
                isSubmitting ||
                (uploadMode === "file" && !selectedFile) ||
                (uploadMode === "url" && !imageUrl.trim())
              }
              onClick={submitImageEdit}
              className="w-full h-12 bg-gradient-to-r from-[#a8d5e2] to-[#b3d9e6] text-gray-900 font-bold rounded-xl disabled:opacity-50 shadow-lg hover:from-[#9bc8d5] hover:to-[#a6ccd9]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  {uploadMode === "file" ? "Uploading..." : "Updating Image..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {uploadMode === "file" ? "Upload Image" : "Update Image"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Completion Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-black border-gray-700">
          <DialogHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#a8d5e2] to-[#b3d9e6] rounded-2xl mb-4">
              <Edit3 className="h-8 w-8 text-gray-900" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">
              Complete your profile
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">
              Help us personalize your experience
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Bio (Optional)
              </label>
              <Input
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="rounded-xl border-gray-600 bg-gray-900 text-white focus:border-[#a8d5e2] focus:ring-[#a8d5e2]/20 h-12"
              />
            </div>
          </div>
          <DialogFooter className="pt-6">
            <Button
              disabled={isSubmitting}
              onClick={submitProfile}
              className="w-full h-12 bg-gradient-to-r from-[#a8d5e2] to-[#b3d9e6] text-gray-900 font-bold rounded-xl disabled:opacity-50 shadow-lg hover:from-[#9bc8d5] hover:to-[#a6ccd9]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                  Completing Profile...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Complete Profile
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
