import { Edit3, MessageSquare, Users } from "lucide-react";
import { Button } from "../ui/button";

type EmptyPostStateProps = {
  onCreatePost: () => void;
  onExploreCommunities: () => void;
};

export default function EmptyPostState({
  onCreatePost,
  onExploreCommunities,
}: EmptyPostStateProps) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">No posts yet</h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm">
          Be the first to start a discussion! Create a post to get the
          conversation going.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            onClick={onCreatePost}
            className="bg-white hover:bg-gray-200 text-black px-5 py-2 rounded-full font-medium text-sm"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Create Post
          </Button>
          <Button
            onClick={onExploreCommunities}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 py-2 rounded-full font-medium text-sm"
          >
            <Users className="h-4 w-4 mr-2" />
            Explore Communities
          </Button>
        </div>
      </div>
    </div>
  );
}
