import { SvgIcon } from "@/components/SvgIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Facebook, Linkedin, Mail, Share2, Twitter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareButtonProps {
  url?: string;
  title?: string;
  description?: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

export default function ShareButton({
  url,
  title = "Check out this post",
  description = "Interesting post on Anonn",
  className = "",
  variant: _variant = "ghost",
  size: _size = "lg",
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const shareUrl = url || window.location.href;
  const shareText = `${title} - ${description}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!", {
        description: "The link has been copied to your clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy", {
        description: "Please copy the link manually.",
      });
    }
  };

  const shareViaNative = async () => {
    if (navigator.share) {
      try {
        setIsSharing(true);
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          toast.error("Share failed", {
            description: "Please try sharing manually.",
          });
        }
      } finally {
        setIsSharing(false);
      }
    } else {
      copyToClipboard();
    }
  };

  const shareViaSocial = (platform: string) => {
    let socialShareUrl = "";

    switch (platform) {
      case "twitter":
        socialShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "facebook":
        socialShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareUrl
        )}`;
        break;
      case "linkedin":
        socialShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          shareUrl
        )}`;
        break;
      case "email":
        socialShareUrl = `mailto:?subject=${encodeURIComponent(
          title
        )}&body=${encodeURIComponent(`${description}\n\n${shareUrl}`)}`;
        break;
      default:
        return;
    }

    window.open(socialShareUrl, "_blank", "width=600,height=400");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isSharing}
          className={`flex items-center px-4 py-3 text-white space-x-2  hover:bg-gray-800/50  hover:text-gray-100 transition-all duration-300 ${className}`}
        >
          <SvgIcon src="/icons/Post-share.svg" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-white border border-gray-200 shadow-lg"
      >
        <DropdownMenuItem
          onClick={shareViaNative}
          className="flex items-center space-x-2"
        >
          <Share2 className="h-4 w-4" />
          <span>Share via...</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={copyToClipboard}
          className="flex items-center space-x-2"
        >
          <Copy className="h-4 w-4" />
          <span>Copy link</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => shareViaSocial("twitter")}
          className="flex items-center space-x-2"
        >
          <Twitter className="h-4 w-4 text-blue-400" />
          <span>Share on Twitter</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => shareViaSocial("facebook")}
          className="flex items-center space-x-2"
        >
          <Facebook className="h-4 w-4 text-blue-600" />
          <span>Share on Facebook</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => shareViaSocial("linkedin")}
          className="flex items-center space-x-2"
        >
          <Linkedin className="h-4 w-4 text-blue-700" />
          <span>Share on LinkedIn</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => shareViaSocial("email")}
          className="flex items-center space-x-2"
        >
          <Mail className="h-4 w-4" />
          <span>Share via Email</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
