import { ChevronDown } from "lucide-react";

interface FeedControlsProps {
  sortBy: "hot" | "new";
  timeFilter: "all" | "hour" | "day" | "week" | "month" | "year";
  onSortChange: (sort: "hot" | "new") => void;
  onTimeFilterChange: (
    filter: "all" | "hour" | "day" | "week" | "month" | "year"
  ) => void;
}

export default function FeedControls({
  sortBy,
  timeFilter,
  onSortChange,
  onTimeFilterChange,
}: FeedControlsProps) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row md:items-center justify-between">
        {/* Left Side - NEW and HOT tabs */}
        <div className="mb-2 md:mb-0 flex items-center gap-[10px]">
          <button
            onClick={() => onSortChange("new")}
            className={`font-medium rounded-[58px] text-xs uppercase tracking-wide transition-all ${
              sortBy === "new"
                ? "p-4 bg-[#E8EAE9] text-gray-900"
                : "p-4 text-[#525252] hover:text-gray-300 bg-[#1B1C20]"
            }`}
          >
            NEW
          </button>
          <button
            onClick={() => onSortChange("hot")}
            className={`font-medium text-xs uppercase tracking-wide transition-all rounded-[58px] ${
              sortBy === "hot"
                ? "p-4  bg-[#E8EAE9] text-gray-900"
                : "p-4 text-[#525252] hover:text-gray-300 bg-[#1B1C20]"
            }`}
          >
            HOT
          </button>
        </div>

        {/* Right Side - Time Filter Dropdown */}
        <div className="relative w-1/2 md:w-auto">
          <select
            value={timeFilter}
            onChange={(e) =>
              onTimeFilterChange(
                e.target.value as
                  | "all"
                  | "hour"
                  | "day"
                  | "week"
                  | "month"
                  | "year"
              )
            }
            className="w-full md:w-auto p-4 pr-8 rounded-[58px] bg-[#1B1C20] text-[#525252] text-xs font-medium uppercase tracking-wide border-none focus:outline-none appearance-none cursor-pointer hover:text-gray-300"
          >
            <option value="all" className="bg-[#1a1a1a]">
              ALL TIME
            </option>
            <option value="hour" className="bg-[#1a1a1a]">
              PAST HOUR
            </option>
            <option value="day" className="bg-[#1a1a1a]">
              PAST DAY
            </option>
            <option value="week" className="bg-[#1a1a1a]">
              THIS WEEK
            </option>
            <option value="month" className="bg-[#1a1a1a]">
              PAST MONTH
            </option>
            <option value="year" className="bg-[#1a1a1a]">
              PAST YEAR
            </option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
