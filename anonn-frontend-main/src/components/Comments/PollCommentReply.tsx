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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { formatTimeAgo } from "@/lib/utils";
import { DEFAULT_PROFILE_PICTURE } from "@/lib/anonymity";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CommentWithDetails } from "@/types";
import { MessageSquare, MoreHorizontal, Send, Trash, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import MarkdownRenderer from "../MarkdownRenderer";
import { SvgIcon } from "../SvgIcon/index";
import VoteButtons from "./VoteButtons";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiCall } from "@/lib/api";

const replySchema = z.object({
  content: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(1000, "Reply must be less than 1000 characters"),
});

type ReplyData = z.infer<typeof replySchema>;

interface PollCommentReplyProps {
  comment: CommentWithDetails;
  pollId: number;
  onSuccess?: () => void;
  depth?: number;
}

export default function PollCommentReply({
  comment,
  pollId,
  onSuccess,
  depth = 0,
}: PollCommentReplyProps) {
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const maxDepth = 3;

  const form = useForm<ReplyData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: "",
    },
  });

  const createReplyMutation = useApiMutation({
    endpoint: `polls/${pollId}/comments`,
    method: "POST",

    // Use our custom mutation function
    mutationFn: async (data: ReplyData) => {
      const requestData = {
        content: data.content,
        parentId: comment.id,
      };

      return apiCall({
        endpoint: `polls/${pollId}/comments`,
        method: "POST",
        body: requestData,
      });
    },

    onSuccess: () => {
      toast.success("Reply posted!", {
        description: "Your reply has been added successfully",
      });

      form.reset();
      setShowReplyForm(false);

      queryClient.invalidateQueries({
        queryKey: ["poll-comments", pollId],
      });
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      onSuccess?.();
    },

    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to post reply",
      });
    },
  });

  const deleteCommentMutation = useApiMutation({
    endpoint: `comments`, // base endpoint, commentId will be passed dynamically
    method: "DELETE",

    mutationFn: async (commentId: number) => {
      return apiCall({
        endpoint: `comments/${commentId}`,
        method: "DELETE",
      });
    },

    invalidateQueries: [["poll-comments", pollId]],

    onSuccess: () => {
      toast.success("Comment deleted", {
        description: "Your comment has been deleted successfully",
      });
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });

      onSuccess?.();
    },

    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to delete comment",
      });
    },
  });

  const onSubmit = (data: ReplyData) => {
    createReplyMutation.mutate(data);
  };

  const handleDeleteComment = () => {
    deleteCommentMutation.mutate(comment.id);
    setShowDelete(false);
  };

  const canReply = depth < maxDepth;

  const handleVoteUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["poll-comments", pollId] });
    onSuccess?.();
  };

  const getAuthorDisplay = () => {
    const author = comment.author;
    return author.username || "User";
  };

  return (
    <div className="transition-colors">
      {/* Comment Header */}
      <div className="px-9 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-row gap-4 items-center">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={comment.author?.avatar || DEFAULT_PROFILE_PICTURE}
                className="object-cover"
              />
              <AvatarFallback className="bg-gray-700 text-gray-400">
                {comment.author?.username ? (
                  comment.author.username.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <span className="text-[#8E8E93] font-medium text-xs underline cursor-pointer hover:text-white">
              {getAuthorDisplay()}
            </span>
            <span className="text-[#525252] text-xs">
              {formatTimeAgo(comment.createdAt || "")}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* 3 Dots Menu for Author */}
            {user?.id &&
              comment.authorId &&
              (user?.id === comment.authorId ||
                user?.id === comment.authorId.toString()) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-300 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 bg-[#1a1a1a] border border-gray-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={() => setShowDelete(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
          </div>
        </div>
      </div>

      {/* Comment Content */}
      <div className="px-9 pb-4">
        <div className="text-[#8E8E93] text-sm leading-relaxed">
          <MarkdownRenderer
            content={comment.content}
            className="text-[#8E8E93] text-sm"
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-stretch border-y border-l border-[#525252]/30">
        {/* Left Side - Voting */}
        <div className="flex items-stretch">
          <VoteButtons
            targetId={comment.id}
            targetType="comment"
            upvotes={comment.upvotes}
            downvotes={comment.downvotes}
            userVote={comment.userVote}
            onUpdate={handleVoteUpdate}
            layout="horizontal"
            showCount={true}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Right Side - Actions */}
        <div className="flex items-stretch">
          <div className="flex items-center">
            {/* Bookmark Button */}
            <button
              aria-label="Bookmark"
              className={`flex items-center justify-center px-4 py-3 transition-colors hover:bg-gray-800/50 text-white
                `}
            >
              <SvgIcon
                src="/icons/Post bookmark icon.svg"
                color={"text-white"}
                alt="bookmark"
              />
            </button>
            {/* Reply Button */}
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-2 px-6 text-white hover:bg-gray-800/50 transition-colors "
              >
                <MessageSquare className="h-[14px] w-[14px]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && canReply && (
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Write your reply..."
                        rows={3}
                        className="resize-none text-base border border-gray-600 bg-[#1a1a1a] text-white placeholder-gray-400 focus:border-gray-300 rounded-sm transition-all duration-300"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowReplyForm(false);
                    form.reset();
                  }}
                  className="px-6 py-2 border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    createReplyMutation.isPending ||
                    !form.watch("content").trim()
                  }
                  className="px-6 py-2 bg-gray-700 text-white hover:bg-gray-600 transition-all duration-300"
                >
                  {createReplyMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Posting...</span>
                    </div>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post Reply
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          <div className="pl-4">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="first:pt-4 last:pb-0">
                <PollCommentReply
                  comment={reply}
                  pollId={pollId}
                  onSuccess={onSuccess}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-[#1a1a1a] border border-gray-600">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete this comment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete your
              comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteComment}
              disabled={deleteCommentMutation.isPending}
            >
              {deleteCommentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
