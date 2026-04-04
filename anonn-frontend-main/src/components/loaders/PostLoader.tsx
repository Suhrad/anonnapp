
import { Skeleton } from '../ui/skeleton'

export default function PostLoader() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-black border border-gray-800 rounded-lg overflow-hidden"
        >
          <div className="bg-[#3a3a3a] p-4">
            <Skeleton className="h-6 w-1/4 bg-gray-700" />
          </div>
          <div className="p-4">
            <Skeleton className="h-6 w-3/4 mb-4 bg-gray-700" />
            <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
            <Skeleton className="h-4 w-full mb-2 bg-gray-700" />
            <Skeleton className="h-4 w-2/3 bg-gray-700" />
          </div>
          <div className="border-t border-gray-700 p-4">
            <Skeleton className="h-8 w-32 bg-gray-700" />
          </div>
        </div>
      ))}
    </>
  )
}
