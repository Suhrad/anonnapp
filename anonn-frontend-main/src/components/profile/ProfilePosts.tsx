import PostCard from "../cards/PostCard";
import PollCard from "../cards/PollCard";
import type { PollWithDetails, PostWithDetails } from "@/types";

export default function ProfilePosts({
  userPosts,
  fetchUserPosts,
}: {
  userPosts: PostWithDetails[] | PollWithDetails[];
  fetchUserPosts: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center h-[40px]">
        <p className="text-[#525252] text-sm font-medium">
          [ {userPosts.length} TOTAL ]
        </p>
      </div>
      {userPosts.map((item, index) => {
        // Render polls with PollCard
        if ('allowMultipleChoices' in item) {
          return (
            <PollCard
              key={item.id}
              poll={item as PollWithDetails}
              onUpdate={fetchUserPosts}
            />
          );
        }
        // Render posts with PostCard
        return (
          <PostCard
            key={item.id}
            post={item as PostWithDetails}
            onUpdate={fetchUserPosts}
            compact={false}
            showCommunity={true}
            index={index}
          />
        );
      })}
    </div>
  );
}
