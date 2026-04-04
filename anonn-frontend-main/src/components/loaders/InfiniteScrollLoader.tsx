import { motion } from "framer-motion";
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfiniteScrollLoaderProps {
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
  loadingText?: string;
  endText?: string;
  errorText?: string;
}

export function InfiniteScrollLoader({
  isLoading,
  hasMore,
  error,
  onRetry,
  onLoadMore,
  loadingText = "Loading more...",
  endText = "",
  errorText = "Something went wrong"
}: InfiniteScrollLoaderProps) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-6 text-center"
      >
        <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {errorText}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>
      </motion.div>
    );
  }

  if (!hasMore) {
    if (!endText || endText.trim() === "") {
      return null;
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-6 text-center"
      >
        <CheckCircle className="h-8 w-8 text-green-500 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {endText}
        </p>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center p-6"
      >
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {loadingText}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-center p-6"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        className="flex items-center space-x-2"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Load More</span>
      </Button>
    </motion.div>
  );
}

// Simple loading spinner for infinite scroll
export function InfiniteScrollSpinner({ 
  isLoading, 
  text = "Loading more..." 
}: { 
  isLoading: boolean; 
  text?: string; 
}) {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-center p-6"
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 dark:border-slate-700"></div>
          <div className="absolute inset-0 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {text}
        </span>
      </div>
    </motion.div>
  );
}

// End of content indicator
export function EndOfContent({ 
  text = "",
  showIcon = true 
}: { 
  text?: string; 
  showIcon?: boolean; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      {showIcon && (
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-6 w-6 text-white" />
        </div>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
        {text}
      </p>
    </motion.div>
  );
}

// Error state for infinite scroll
export function InfiniteScrollError({ 
  error, 
  onRetry, 
  text = "Something went wrong" 
}: { 
  error: string; 
  onRetry: () => void; 
  text?: string; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-6 text-center"
    >
      <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {text}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 max-w-xs">
        {error}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="flex items-center space-x-2"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Try Again</span>
      </Button>
    </motion.div>
  );
}

// Loading skeleton for infinite scroll items
export function InfiniteScrollSkeleton({ 
  count = 3, 
  className = "" 
}: { 
  count?: number; 
  className?: string; 
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="animate-pulse"
        >
          <div className="bg-gray-200 dark:bg-slate-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gray-300 dark:bg-slate-600 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-slate-600 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
