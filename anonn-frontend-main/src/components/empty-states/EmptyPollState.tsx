import { BarChart3, Plus } from "lucide-react";

import { Button } from "../ui/button";

export default function EmptyPollState({
  searchQuery,
  handleCreatePoll,
}: {
  searchQuery: string;
  handleCreatePoll: () => void;
}) {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="text-center py-16 px-4">
        <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        {searchQuery ? (
          <>
            <h3 className="text-2xl font-bold text-gray-300 mb-3">
              No results found
            </h3>
            <p className="text-gray-500 text-lg mb-6 max-w-md mx-auto">
              Try adjusting your search terms.
            </p>
          </>
        ) : (
          <div>
            <h3 className="text-2xl font-bold text-gray-300 mb-3">
              No polls yet
            </h3>

            <p className="text-gray-500 text-lg mb-6 max-w-md mx-auto">
              Be the first to create a poll and see what the community thinks!
            </p>
            <Button
              onClick={handleCreatePoll}
              className="bg-white cursor-pointer text-gray-500 px-8 py-3 rounded-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Poll
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
