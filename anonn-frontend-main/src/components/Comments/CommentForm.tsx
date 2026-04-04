import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/useApiMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import PostIcon from "@/icons/post-button-icon.svg";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be less than 1000 characters"),
});

type CommentData = z.infer<typeof commentSchema>;

interface CommentFormProps {
  postId: number;
  onSuccess?: () => void;
}

export default function CommentForm({ postId, onSuccess }: CommentFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<CommentData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  const createMutation = useApiMutation({
    endpoint: `posts/${postId}/comments`,
    method: "POST",
    invalidateQueries: [["/api/posts", postId, "comments"]],
    onSuccess: () => {
      toast.success("Comment posted!", {
        description: "Your comment has been added successfully",
      });
      form.reset();
      // Invalidate user profile points query to update points in sidebar
      queryClient.invalidateQueries({ queryKey: ["user-profile-points"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to post comment",
      });
    },
  });

  const onSubmit = (data: CommentData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex items-center justify-between"
      >
        {/* Left: Yellow box + input */}
        <div className="flex items-center pl-9 py-6 flex-1 pr-4 gap-4">
          {/* Yellow square */}
          <div className="w-[30px] h-[30px] bg-[#FFB82A] flex-shrink-0"></div>

          {/* Text input */}
          <input
            type="text"
            placeholder="post your reply"
            {...form.register("content")}
            className="w-full bg-transparent text-[#525252] text-sm font-spacemono focus:outline-none "
          />
        </div>

        {/* Right: POST button */}
        <Button
          type="submit"
          disabled={createMutation.isPending || !form.watch("content").trim()}
          className="py-10 px-6 flex items-center justify-center text-[#17181C] font-normal bg-gradient-to-r from-[#A0D9FF] to-[#E8EAE9] hover:opacity-90 transition rounded-none"
        >
          {createMutation.isPending ? (
            "Posting..."
          ) : (
            <>
              <img src={PostIcon} alt="post" />
              POST
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
