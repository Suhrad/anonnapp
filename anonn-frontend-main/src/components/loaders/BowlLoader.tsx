
import { Skeleton } from "../ui/skeleton";

export default function BowlLoader() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-48 bg-gray-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-64 bg-gray-800" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
