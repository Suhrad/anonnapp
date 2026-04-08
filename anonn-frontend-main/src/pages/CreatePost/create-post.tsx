import QuotedMarketEmbed from "@/components/markets/QuotedMarketEmbed";
import { SvgIcon } from "@/components/SvgIcon";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Building,
  Camera,
  Code,
  Image,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
  Smile,
  Underline,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { apiCall } from "@/lib/api";
import CloseIcon from "@/icons/x-close.svg";
import BackIcon from "@/icons/Arrow-left.svg";

interface Bowl {
  id: number;
  name: string;
  description: string;
  category: string;
  icon?: string;
}

interface PollOption {
  id: string;
  text: string;
}

interface ImportedMarket {
  _id?: string;
  id?: string;
  title: string;
  source: string;
  url?: string;
  probabilityYes?: number;
  liquidity?: number;
  volume24h?: number;
  status?: string;
  closeTime?: string;
  icon?: string;
}

type PostType = "text" | "poll";
type CreateStep = "select" | "create";

// Text formatting utility functions
const formatText = (command: string, value: string = "") => {
  document.execCommand(command, false, value);
  document.getElementById("content-editable")?.focus();
};

const createLink = () => {
  const url = prompt("Enter URL:");
  if (url) {
    formatText("createLink", url);
  }
};

const insertEmoji = (emoji: string) => {
  formatText("insertText", emoji);
};

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "text" | "poll";
  initialBowlId?: number;
  /** Pre-attach a market (quote flow — opened from MarketCard "Quote" button) */
  initialMarket?: ImportedMarket;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  initialType,
  initialBowlId,
  initialMarket,
}: CreatePostModalProps) {
  console.log("[CreatePostModal] Rendering with isOpen:", isOpen, "initialType:", initialType);
  // True when modal was opened from a MarketCard "Quote" button
  const isQuoteFlow = !!initialMarket;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CreateStep>("select");
  const [postType, setPostType] = useState<PostType>("text");
  const [selectedBowl, setSelectedBowl] = useState<Bowl | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);
  const [marketUrl, setMarketUrl] = useState("");
  const [importedMarket, setImportedMarket] = useState<ImportedMarket | null>(null);
  const [isImportingMarket, setIsImportingMarket] = useState(false);
  const [showBowlSelector, setShowBowlSelector] = useState(false);
  const [bowlSearch, setBowlSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Image edit dialog state
  const [editImageDialogOpen, setEditImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const contentEditableRef = useRef<HTMLDivElement>(null);

  const mutation = useApiMutation({
    endpoint: "posts",
  });

  const pollMutation = useApiMutation({
    endpoint: "polls",
  });

  // Defensive: always ensure bowls is an array - use consistent query key to share cache
  const { data: bowlsRaw } = useApiQuery<Bowl[]>({
    endpoint: "bowls",
    queryKey: ["/api/bowls"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  interface BowlsResponse {
    bowls?: Bowl[];
  }
  
  const bowls: Bowl[] = useMemo(() => {
    if (Array.isArray(bowlsRaw)) {
      return bowlsRaw;
    }
    if (bowlsRaw && typeof bowlsRaw === 'object' && 'bowls' in bowlsRaw) {
      const response = bowlsRaw as BowlsResponse;
      return Array.isArray(response.bowls) ? response.bowls : [];
    }
    return [];
  }, [bowlsRaw]);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setStep("select");
      setPostType("text");
      setTitle("");
      setContent("");
      setPollOptions([
        { id: "1", text: "" },
        { id: "2", text: "" },
      ]);
      setMarketUrl("");
      setImportedMarket(initialMarket ?? null);
      setSelectedBowl(null);
      setBowlSearch("");
      // Reset image dialog state
      setEditImageDialogOpen(false);
      setImageUrl("");
      setSelectedFile(null);
      setImagePreview("");
      setUploadMode("file");

      // Apply initial props if provided
      if (initialType && ["text", "poll"].includes(initialType)) {
        setPostType(initialType as PostType);
        setStep("create");
      }
    }
  }, [isOpen, initialType]);

  // Separate effect for initial bowl and organization setup
  useEffect(() => {
    if (isOpen && initialBowlId && bowls.length > 0) {
      const bowl = bowls.find((b) => b.id === initialBowlId);
      if (bowl) setSelectedBowl(bowl);
    }
  }, [isOpen, initialBowlId, bowls]);

  // Common emojis for quick access
  const commonEmojis = [
    "😊",
    "😂",
    "❤️",
    "🔥",
    "👍",
    "👎",
    "🎉",
    "🙏",
    "🤔",
    "👀",
  ];

  const handleContentChange = () => {
    if (contentEditableRef.current) {
      setContent(contentEditableRef.current.innerHTML);
    }
  };

  // Handle image edit dialog open
  const handleImageEdit = () => {
    setImageUrl("");
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
            description: "Image has been pasted. Click 'Insert Image' to add it.",
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

  // Insert image into content editable
  const insertImageIntoContent = (url: string) => {
    if (!contentEditableRef.current) return;
    
    // Focus the content editable area first
    contentEditableRef.current.focus();
    
    // Insert image at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "8px 0";
      range.insertNode(img);
      // Move cursor after the image
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Fallback: append to end
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "8px 0";
      contentEditableRef.current.appendChild(img);
      // Move cursor after the image
      const range = document.createRange();
      range.setStartAfter(img);
      range.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    
    // Update content state
    handleContentChange();
  };

  // Submit image edit
  const submitImageEdit = async () => {
    if (uploadMode === "file") {
      // File upload mode
      if (!selectedFile) {
        toast.warning("No file selected", {
          description: "Please select an image file to upload",
        });
        return;
      }

      setIsUploadingImage(true);
      try {
        // Upload to Cloudinary
        const uploadedUrl = await uploadImageToCloudinary(
          selectedFile,
          "post-images"
        );

        // Insert image into content
        insertImageIntoContent(uploadedUrl);

        setSelectedFile(null);
        setImagePreview("");
        setEditImageDialogOpen(false);
        
        toast.success("Image uploaded!", {
          description: "Image has been added to your post",
        });
      } catch (error) {
        console.error("[CreatePost] Image upload error:", error);
        toast.error("Upload failed", {
          description:
            error instanceof Error
              ? error.message
              : "Failed to upload image. Please try again.",
        });
      } finally {
        setIsUploadingImage(false);
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

      // Insert image into content
      insertImageIntoContent(imageUrl.trim());
      setEditImageDialogOpen(false);
      
      toast.success("Image added!", {
        description: "Image has been added to your post",
      });
    }
  };

  const filteredBowls =
    bowls?.filter(
      (bowl) =>
        bowl.name.toLowerCase().includes(bowlSearch.toLowerCase()) ||
        bowl.description.toLowerCase().includes(bowlSearch.toLowerCase())
    ) || [];

  const addPollOption = () => {
    const newId = (pollOptions.length + 1).toString();
    setPollOptions([...pollOptions, { id: newId, text: "" }]);
  };

  const removePollOption = (id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((option) => option.id !== id));
    }
  };

  const handleClear = () => {
    if (!contentEditableRef.current) return;
  
    contentEditableRef.current.innerHTML = "";
  
    contentEditableRef.current.focus();
  
    setContent("");
  };

  const updatePollOption = (id: string, text: string) => {
    setPollOptions(
      pollOptions.map((option) =>
        option.id === id ? { ...option, text } : option
      )
    );
  };

  const saveDraft = () => {
    try {
      const draft = {
        title,
        content,
        selectedBowl,
        postType,
        pollOptions,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem("postDraft", JSON.stringify(draft));
      toast.success("Draft saved", {
        description: "Your draft has been saved successfully",
      });
    } catch {
      toast.error("Save failed", {
        description: "Couldn't save your draft",
      });
    }
  };

  const handleImportMarket = async () => {
    if (!marketUrl.trim()) {
      toast.error("Add a market URL", {
        description: "Paste a Polymarket URL to import market details.",
      });
      return;
    }

    setIsImportingMarket(true);
    try {
      const response = await apiCall<{ market: ImportedMarket }>({
        endpoint: "markets/import",
        method: "POST",
        body: {
          source: "polymarket",
          url: marketUrl.trim(),
        },
      });

      if (!response?.market) {
        throw new Error("Market import failed");
      }

      setImportedMarket(response.market);
      toast.success("Market imported", {
        description: "This market will be attached to your post/poll.",
      });
    } catch (error) {
      console.error("Error importing market:", error);
      toast.error("Failed to import market", {
        description: "Check the URL and try again.",
      });
    } finally {
      setIsImportingMarket(false);
    }
  };

  const handlePost = async () => {
    if (!title.trim()) {
      toast.error("Add a title", {
        description: "Please add a title for your post",
      });
      return;
    }

    if (postType === "poll" && pollOptions.some((opt) => !opt.text.trim())) {
      toast.error("Fill poll options", {
        description: "Please fill in all poll options",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // For rich text content, we need to handle HTML properly
      const postContent =
        content.trim() || contentEditableRef.current?.innerText || "";

      // If a market is attached, ensure it has a valid MongoDB ObjectId.
      // Markets from Supabase/quote flow have a Polymarket hex ID, not a Mongo ID —
      // call /api/markets/import to upsert into MongoDB and get back the real _id.
      let attachedMarketMongoId: string | undefined;
      if (importedMarket) {
        const rawId = String(importedMarket._id || importedMarket.id || "");
        const isMongoId = /^[0-9a-fA-F]{24}$/.test(rawId);
        if (isMongoId) {
          attachedMarketMongoId = rawId;
        } else {
          // Upsert into MongoDB via the import endpoint
          try {
            const upserted = await apiCall<{ market: { _id: string } }>({
              endpoint: "markets/import",
              method: "POST",
              body: {
                source: importedMarket.source || "polymarket",
                externalId: rawId,
                slug: (importedMarket as any).slug || "",
                url: importedMarket.url,
                title: importedMarket.title,
                probabilityYes: importedMarket.probabilityYes,
                liquidity: importedMarket.liquidity,
                volume24h: importedMarket.volume24h,
                closeTime: importedMarket.closeTime,
                status: importedMarket.status || "active",
                icon: importedMarket.icon,
              },
            });
            attachedMarketMongoId = upserted?.market?._id;
          } catch (err) {
            console.error("[CreatePost] market upsert failed:", err);
            // Throw so the user sees the actual error rather than posting without the market
            throw new Error("Failed to attach market. Please try again.");
          }
        }
      }

      if (postType === "poll") {
        const pollData = {
          question: title.trim(),
          description: postContent,
          options: pollOptions.map((opt) => opt.text),
          ...(selectedBowl && { community: selectedBowl.id }),
          ...(selectedBowl && { bowl: selectedBowl.id }),
          ...(attachedMarketMongoId && { attachedMarket: attachedMarketMongoId }),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        // Await the mutation to ensure it completes before invalidating queries
        await pollMutation.mutateAsync(pollData);
      } else {
        const postData = {
          title: title.trim(),
          content: postContent,
          htmlContent: content,
          ...(selectedBowl && { community: selectedBowl.id }),
          ...(selectedBowl && { bowl: selectedBowl.id }),
          ...(attachedMarketMongoId && { attachedMarket: attachedMarketMongoId }),
          type: "text",
          mediaUrl: "",
          linkUrl: "",
          bias: "neutral",
        };
        // Await the mutation to ensure it completes before invalidating queries
        await mutation.mutateAsync(postData);
      }

      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            (key[0] === "posts" ||
              key[0] === "/api/posts" ||
              key[0] === "bowl-posts" ||
              key[0] === "community-posts")
          );
        },
      });

      // Invalidate user profile points query to update points in sidebar
      await queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      toast.success("Post created!", {
        description: "Your post has been published",
      });
      localStorage.removeItem("postDraft");

      // Reset form and close modal
      setTitle("");
      setContent("");
      setSelectedBowl(null);
      setMarketUrl("");
      setImportedMarket(null);
      setPollOptions([
        { id: "1", text: "" },
        { id: "2", text: "" },
      ]);
      setStep("select");
      onClose();
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to post", {
        description: "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rest of the component remains the same until the text formatting section...

  console.log("[CreatePostModal] Current step:", step, "isOpen:", isOpen);
  
  if (step === "select") {
    console.log("[CreatePostModal] Rendering select step dialog");
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-screen p-0 bg-[#0a0a0a] border-0 rounded-none [&>button]:hidden" aria-describedby="create-post-dialog-desc">
          <span id="create-post-dialog-desc" className="sr-only">Create a new post or poll. Fill in the required fields and submit.</span>
          <DialogTitle className="sr-only">
            Create Post - Select Type
          </DialogTitle>
          <div className="bg-[#525252] px-4 py-2 flex flex-end items-center justify-end">
            <button onClick={onClose}>
              <img src={CloseIcon} alt="close" />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center overflow-hidden">
                <img 
                  src={user?.avatar || DEFAULT_PROFILE_PICTURE} 
                  alt="Profile Pic" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>
              <span className="text-[#8E8E93] text-xs">
                {user?.username || ""}
              </span>
            </div>

            <div>
              <p className="text-[#525252] text-xs font-normal">
                Choose what you wanna
              </p>
              <p className="text-[#525252] text-xs font-normal">
                create today...
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setPostType("text");
                  setStep("create");
                }}
                className="h-[70px] flex flex-col md:flex-row gap-4 items-center border-[0.2px] border-[#525252]/30 justify-center hover:bg-[#252525] transition-colors"
              >
                <div className="mb-3 md:mb-0 text-[#E8EAE9]">
                  <SvgIcon src="/icons/Post option icon.svg" />
                </div>
                <span className="text-[#E8EAE9] font-medium text-xs">POST</span>
              </button>

              <button
                onClick={() => {
                  setPostType("poll");
                  setStep("create");
                }}
                className="h-[70px] flex flex-col md:flex-row gap-4 items-center border-[0.2px] border-[#525252]/30 justify-center hover:bg-[#252525] transition-colors"
              >
                <div className="mb-3 md:mb-0 text-[#E8EAE9]">
                  <SvgIcon src="/icons/Polls icon.svg" />
                </div>
                <span className="text-[#E8EAE9] font-medium text-xs">POLL</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-screen p-0 bg-[#0a0a0a] border-0 rounded-none flex flex-col [&>button]:hidden" aria-describedby="create-post-dialog-desc-main">
        <span id="create-post-dialog-desc-main" className="sr-only">Create a new post or poll. Fill in the required fields and submit.</span>
        <DialogTitle className="sr-only">
          {postType === "poll" ? "Create Poll" : "Create Post"}
        </DialogTitle>
        <div className="bg-[#525252] px-4 py-2 flex items-center justify-between shrink-0">
          <button onClick={() => setStep("select")}>
            <img src={BackIcon} alt="Back Icon" />
          </button>
          <div className="flex items-center gap-4 text-[#E8EAE9]">
            {postType === "poll" ? (
              <>
                <SvgIcon src="/icons/Polls icon.svg" />
                <span className="font-medium text-xs">POLL</span>
              </>
            ) : (
              <>
                <SvgIcon src="/icons/Post option icon.svg" />
                <span className="font-medium text-xs">POST</span>
              </>
            )}
          </div>
          <button onClick={onClose}>
            <img src={CloseIcon} alt="close" />
          </button>
        </div>

        <div className="flex-1 py-6  overflow-y-auto">
          <div className="space-y-6">
            <div className="px-9 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center overflow-hidden">
                    <img 
                      src={user?.avatar || DEFAULT_PROFILE_PICTURE} 
                      alt="Profile Pic " 
                      className="w-10 h-10 object-cover"
                    />
                  </div>
                  <span className="text-[#8E8E93] text-xs">
                    {user?.username || ""}
                  </span>
                </div>

                <button
                  onClick={() => setShowBowlSelector(true)}
                  className="flex p-4 rounded-[58px] bg-[#1B1C20] gap-4 items-center text-[#525252] hover:text-gray-300 transition-colors"
                >
                  <span className="text-xs">
                    {selectedBowl ? selectedBowl.name : "CHOOSE COMMUNITY"}
                  </span>
                  <SvgIcon src="/icons/dropdown-icon.svg" />
                </button>
              </div>

              <div className="relative">
                <label className="h-4 w-[84px] py-1 z-10 bg-[#0a0a0a] flex justify-center items-center absolute -top-2 left-6 text-xs text-[#525252] border-[0.2px] border-[#525252]/30">
                  TITLE
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-20 py-2 px-9 bg-[rgba(234,234,234,0.04)] text-[#E8EAE9] text-sm outline-none"
                  maxLength={300}
                />
              </div>

              <div className="relative">
                <label className="h-4 w-[84px] py-1 z-10 bg-[#0a0a0a] flex justify-center items-center absolute -top-2 left-6 text-xs text-[#525252] border-[0.2px] border-[#525252]/30">
                  BODY
                </label>

                {/* Content Editable Area for Rich Text */}
                <div
                  ref={contentEditableRef}
                  id="content-editable"
                  contentEditable
                  onInput={handleContentChange}
                  className="w-full h-[140px] py-6 px-9 bg-[rgba(234,234,234,0.04)] text-[#E8EAE9] text-sm outline-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap"
                  style={{
                    caretColor: "white",
                    lineHeight: "1.5",
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                  }}
                />

                {postType === "text" && (
                  <div className="flex items-center gap-2 mt-4 pt-4 flex-wrap">
                    {/* Text Formatting Buttons */}
                    <button
                      onClick={() => formatText("bold")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("italic")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("underline")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Underline"
                    >
                      <Underline className="w-4 h-4" />
                    </button>

                    {/* Lists */}
                    <button
                      onClick={() => formatText("insertUnorderedList")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Bullet List"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("insertOrderedList")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Numbered List"
                    >
                      <List className="w-4 h-4" />
                    </button>

                    {/* Code & Quote */}
                    <button
                      onClick={() => formatText("formatBlock", "<pre>")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Code Block"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("formatBlock", "<blockquote>")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Quote"
                    >
                      <Quote className="w-4 h-4" />
                    </button>

                    {/* Link & Image */}
                    <button
                      onClick={createLink}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Insert Link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleImageEdit}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Insert Image"
                    >
                      <Image className="w-4 h-4" />
                    </button>

                    {/* Text Alignment */}
                    <button
                      onClick={() => formatText("justifyLeft")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Align Left"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("justifyCenter")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Align Center"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => formatText("justifyRight")}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                      title="Align Right"
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>

                    {/* Emoji Picker */}
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
                        title="Insert Emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 bg-[#2a2a2a] border border-gray-600 rounded-lg p-2 grid grid-cols-5 gap-1 z-10">
                          {commonEmojis.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                insertEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-600 rounded text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Clear Formatting */}
                    <button
                      onClick={() =>handleClear()}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700 text-xs font-medium"
                      title="Clear Formatting"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            {postType === "poll" && (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {pollOptions.map((option, index) => (
                    <div key={option.id} className="relative">
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) =>
                          updatePollOption(option.id, e.target.value)
                        }
                        placeholder={`option ${index + 1}`}
                        className="w-full py-3 px-6 text-[#E8EAE9] placeholder:text-[#525252] text-xs font-normal border border-[#525252]/30 focus:border-gray-400"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(option.id)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addPollOption}
                    className="w-full py-3 px-6 bg-[rgba(234,234,234,0.04)] text-[#525252] text-xs font-normal"
                  >
                    Add another
                  </button>
                </div>
                {/* Quote flow: show embed preview (readonly). Normal flow: show URL import */}
                {isQuoteFlow && importedMarket ? (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[#525252] text-xs">QUOTED MARKET</span>
                      <button
                        onClick={() => setImportedMarket(null)}
                        title="Remove quoted market"
                        className="text-[#525252] hover:text-red-400 transition-colors flex items-center gap-1 text-xs"
                      >
                        <img src={CloseIcon} alt="remove" className="w-3 h-3" />
                      </button>
                    </div>
                    <QuotedMarketEmbed market={importedMarket} mode="compose" />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 flex items-center gap-4">
                      <span className="text-[#525252] transition-colors text-xs whitespace-nowrap">
                        ATTACH MARKET
                      </span>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={marketUrl}
                          onChange={(e) => setMarketUrl(e.target.value)}
                          placeholder="Paste Polymarket URL..."
                          className="flex-1 bg-[rgba(234,234,234,0.04)] border-[0.2px] border-[#525252]/30 px-4 py-3 text-xs text-[#E8EAE9] outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleImportMarket}
                          disabled={isImportingMarket}
                          className="px-4 py-3 text-xs bg-[#373737] text-[#E8EAE9] disabled:opacity-60"
                        >
                          {isImportingMarket ? "IMPORTING..." : "IMPORT"}
                        </button>
                      </div>
                    </div>
                    {importedMarket && (
                      <div className="border-[0.2px] border-[#525252]/30 p-6 mt-4 w-fit">
                        <div className="flex items-center gap-6">
                          <div className="text-[#E8EAE9] text-xs font-medium">
                            {importedMarket.title}
                          </div>
                          <div className="text-[#8E8E93] text-xs uppercase">
                            {importedMarket.source}
                          </div>
                          <button
                            onClick={() => setImportedMarket(null)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            title="Remove attached market"
                          >
                            <img src={CloseIcon} alt="close" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {postType === "text" && (
              <div className="border-t border-[#525252]/30 p-6 space-y-6">
                {/* Quote flow: show embed preview (readonly). Normal flow: show URL import */}
                {isQuoteFlow && importedMarket ? (
                  <div>
                    <span className="text-[#525252] text-xs block mb-3">QUOTED MARKET</span>
                    <QuotedMarketEmbed market={importedMarket} mode="compose" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-9">
                      <span className="text-[#525252] transition-colors text-xs whitespace-nowrap">
                        ATTACH MARKET
                      </span>
                      <div className="w-2/4 flex gap-2">
                        <input
                          type="text"
                          value={marketUrl}
                          onChange={(e) => setMarketUrl(e.target.value)}
                          placeholder="Paste Polymarket URL..."
                          className="flex-1 bg-[rgba(234,234,234,0.04)] border-[0.2px] border-[#525252]/30 px-4 py-3 text-xs text-[#E8EAE9] outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleImportMarket}
                          disabled={isImportingMarket}
                          className="px-4 py-3 text-xs bg-[#373737] text-[#E8EAE9] disabled:opacity-60"
                        >
                          {isImportingMarket ? "IMPORTING..." : "IMPORT"}
                        </button>
                      </div>
                    </div>

                    {importedMarket && (
                      <div className="border-[0.2px] border-[#525252]/30 p-6 mt-4 w-fit">
                        <div className="flex items-center gap-6">
                          <div className="text-[#E8EAE9] text-xs font-medium">
                            {importedMarket.title}
                          </div>
                          <div className="text-[#8E8E93] text-xs uppercase">
                            {importedMarket.source}
                          </div>
                          <button
                            onClick={() => setImportedMarket(null)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            title="Remove attached market"
                          >
                            <img src={CloseIcon} alt="close" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 grid grid-cols-3 border-t border-[#525252]/30">
          <button
            onClick={saveDraft}
            className="flex items-center justify-center border-r border-[#525252]/30 gap-2 py-3 px-12 bg-[#0a0a0a] hover:bg-[#1B1C20] transition-colors text-[#E8EAE9]"
          >
            <SvgIcon src="/icons/Save-draft.svg" />
            <span className="font-normal text-xs">SAVE DRAFT</span>
          </button>
          <div></div>
          <button
            onClick={handlePost}
            disabled={isSubmitting || !title.trim()}
            className="flex items-center justify-center text-[#17181C] gap-2 py-4 bg-gradient-to-br from-[#A0D9FF] to-[#E8EAE9] hover:bg-gradient-to-br hover:from-[#a5dafe] hover:to-[#edf0ef] transition-colors disabled:opacity-50"
          >
            <SvgIcon src="/icons/Publish-icon.svg" />
            <span className="font-normal text-xs">
              {isSubmitting ? "POSTING..." : "POST"}
            </span>
          </button>
        </div>

        {/* Rest of the modals remain the same */}
        <AnimatePresence>
          {showBowlSelector && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-end"
              onClick={() => setShowBowlSelector(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full bg-[#0a0a0a] rounded-t-2xl max-h-[70vh] flex flex-col border-t border-[#525252]/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-[#525252]/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[#E8EAE9] font-semibold">
                      Select Community
                    </h3>
                    <button
                      onClick={() => setShowBowlSelector(false)}
                      className="text-[#8E8E93] hover:text-[#E8EAE9] transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Search communities..."
                    value={bowlSearch}
                    onChange={(e) => setBowlSearch(e.target.value)}
                    className="w-full bg-[rgba(234,234,234,0.04)] text-[#E8EAE9] px-3 py-2 rounded outline-none border border-[#525252]/30 focus:border-[#525252]/50"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredBowls.map((bowl) => (
                    <button
                      key={bowl.id}
                      onClick={() => {
                        setSelectedBowl(bowl);
                        setShowBowlSelector(false);
                        setBowlSearch("");
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-[rgba(234,234,234,0.02)] transition-colors border-b border-[#525252]/30"
                    >
                      <div className="w-10 h-10 bg-[#1B1C20] rounded-full flex items-center justify-center border border-[#525252]/30">
                          <Building className="w-5 h-5 text-[#E8EAE9]" />
                        </div>
                      <div className="text-left">
                        <div className="text-[#E8EAE9] font-medium">
                          {bowl.name}
                        </div>
                        <div className="text-[#8E8E93] text-sm">
                          {bowl.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Edit Dialog */}
        <Dialog open={editImageDialogOpen} onOpenChange={setEditImageDialogOpen}>
          <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-black border-gray-700">
            <DialogHeader className="text-center pb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#a8d5e2] to-[#b3d9e6] rounded-2xl mb-4">
                <Camera className="h-8 w-8 text-gray-900" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white">
                Insert Image
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
                      id="post-image-upload"
                      disabled={isUploadingImage}
                    />
                    <label
                      htmlFor="post-image-upload"
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
                    disabled={isUploadingImage}
                  />
                  <p className="text-xs text-gray-500">
                    Enter a direct link to your image
                  </p>
                  {imageUrl && (
                    <div className="flex justify-center mt-4">
                      <div className="w-20 h-20 border border-gray-600 rounded overflow-hidden">
                        <img
                          src={imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
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
                disabled={isUploadingImage || (uploadMode === "file" && !selectedFile) || (uploadMode === "url" && !imageUrl.trim())}
                onClick={submitImageEdit}
                className="w-full h-12 bg-gradient-to-r from-[#a8d5e2] to-[#b3d9e6] text-gray-900 font-bold rounded-xl disabled:opacity-50 shadow-lg hover:from-[#9bc8d5] hover:to-[#a6ccd9]"
              >
                {isUploadingImage ? (
                  <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin"></div>
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Insert Image
                    <Image className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
