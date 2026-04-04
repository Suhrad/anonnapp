import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="fixed top-4 right-4 z-50 max-w-sm bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You're currently offline. Some features may not work properly.
      </AlertDescription>
    </Alert>
  );
}
