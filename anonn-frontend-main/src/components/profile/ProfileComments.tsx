import CommentReply from "@/components/Comments/CommentReply";
import PollCommentReply from "@/components/Comments/PollCommentReply";
import PostCard from "@/components/cards/PostCard";
import PollCard from "@/components/cards/PollCard";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { CommentWithDetails, PostWithDetails, PollWithDetails } from "@/types";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

// Component to fetch and display a single post with its comments
function PostWithComments({ 
  postId, 
  comments 
}: { 
  postId: string | number; 
  comments: CommentWithDetails[];
}) {
  const { data: post, isLoading } = useApiQuery<PostWithDetails>({
    queryKey: ["post", postId],
    endpoint: `posts/${postId}`,
    enabled: !!postId,
    on401: "returnNull",
    retry: false,
    select: (response: any) => {
      let postData = response;
      if (response?.data) {
        postData = response.data.post || response.data;
      } else if (response?.post) {
        postData = response.post;
      }
      if (postData && !postData.sentiment && postData.bias) {
        postData.sentiment = postData.bias;
      } else if (postData && postData.sentiment && !postData.bias) {
        postData.bias = postData.sentiment;
      }
      return postData;
    },
  });

  if (isLoading) return null;
  if (!post) return null;

  return (
    <div className="mb-6 last:mb-0">
      {/* Post Card */}
      <PostCard post={post} onUpdate={() => {}} />
      
      {/* Comments with spacing like posts */}
      <div className="space-y">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border border-[#525252]/30 bg-[#1a1a1a]/50"
          >
            <CommentReply
              comment={comment}
              postId={typeof postId === 'number' ? postId : parseInt(String(postId), 10)}
              onSuccess={() => {}}
              depth={0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to fetch and display a single poll with its comments
function PollWithComments({ 
  pollId, 
  comments 
}: { 
  pollId: string | number; 
  comments: CommentWithDetails[];
}) {
  const { data: poll, isLoading } = useApiQuery<PollWithDetails>({
    queryKey: ["poll", pollId],
    endpoint: `polls/${pollId}`,
    enabled: !!pollId,
    on401: "returnNull",
    retry: false,
    select: (response: any) => {
      let pollData = response;
      if (response?.data) {
        pollData = response.data.poll || response.data;
      } else if (response?.poll) {
        pollData = response.poll;
      }
      return pollData;
    },
  });

  if (isLoading) return null;
  if (!poll) return null;

  return (
    <div className="mb-6 last:mb-0">
      {/* Poll Card */}
      <PollCard poll={poll} onUpdate={() => {}} />
      
      {/* Comments with spacing like posts */}
      <div className="space-y">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border border-[#525252]/30 rounded-lg bg-[#1a1a1a]/50"
          >
            <PollCommentReply
              comment={comment}
              pollId={typeof pollId === 'number' ? pollId : parseInt(String(pollId), 10)}
              onSuccess={() => {}}
              depth={0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileComments({ userComments }: {
  userComments: CommentWithDetails[]
}) {
  // Helper to extract ID from comment
  const getNumericId = (id: string | number | undefined): string | number => {
    if (!id) return 0;
    if (typeof id === 'number') return id;
    // If it's a MongoDB ObjectId (24 char hex string), keep as string
    if (typeof id === 'string' && id.length === 24) return id;
    // Otherwise try to parse as number
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? id : parsed;
  };

  // Group comments by postId or pollId
  const groupedComments = useMemo(() => {
    const groups: Map<string | number, {
      type: 'post' | 'poll';
      id: string | number;
      comments: CommentWithDetails[];
    }> = new Map();

    userComments.forEach((comment: CommentWithDetails & { 
      post?: { _id?: string; id?: string | number } | string; 
      poll?: { _id?: string; id?: string | number } | string;
    }) => {
      const postId = comment.postId || (typeof comment.post === 'object' && comment.post !== null ? (comment.post._id || comment.post.id) : comment.post);
      const pollId = comment.pollId || (typeof comment.poll === 'object' && comment.poll !== null ? (comment.poll._id || comment.poll.id) : comment.poll);
      
      if (postId) {
        const id = getNumericId(postId);
        const key = `post-${id}`;
        if (!groups.has(key)) {
          groups.set(key, { type: 'post', id, comments: [] });
        }
        groups.get(key)!.comments.push(comment as CommentWithDetails);
      } else if (pollId) {
        const id = getNumericId(pollId);
        const key = `poll-${id}`;
        if (!groups.has(key)) {
          groups.set(key, { type: 'poll', id, comments: [] });
        }
        groups.get(key)!.comments.push(comment as CommentWithDetails);
      }
    });

    return Array.from(groups.values());
  }, [userComments]);

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-center py-4 border-b border-gray-600 px-4">
        <p className="text-gray-400 text-sm">[ {userComments.length} TOTAL ]</p>
      </div>
      {groupedComments.length > 0 ? (
        <div className="space-y-6">
          {groupedComments.map((group) => {
            if (group.type === 'post') {
              return (
                <PostWithComments
                  key={`post-${group.id}`}
                  postId={group.id}
                  comments={group.comments}
                />
              );
            } else {
              return (
                <PollWithComments
                  key={`poll-${group.id}`}
                  pollId={group.id}
                  comments={group.comments}
                />
              );
            }
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No comments yet</p>
        </div>
      )}
    </div>
  );
}
