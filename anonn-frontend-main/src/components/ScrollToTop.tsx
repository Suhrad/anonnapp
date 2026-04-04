import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * ScrollToTop component - automatically scrolls to top (0, 0) on route change
 */
export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top whenever location changes
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}
