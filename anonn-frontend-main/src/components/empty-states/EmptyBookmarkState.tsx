import { Bookmark } from "lucide-react";

export default function EmptyBookmarkState() {
  return (
    <div className="text-center py-12">
      <Bookmark className="w-12 h-12 mx-auto mb-4 text-gray-600" />
      <h3 className="text-xl font-semibold text-white mb-2">
        No bookmarked posts
      </h3>
      <p className="text-gray-500">Posts you bookmark will appear here</p>
    </div>
  );
}
