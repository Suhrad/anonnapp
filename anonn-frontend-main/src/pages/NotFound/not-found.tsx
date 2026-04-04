import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  Home, 
  Compass
} from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-lg mx-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="pt-12 pb-8 px-8 text-center">
          {/* 404 Number */}
          <div className="mb-6">
            <div className="text-8xl font-[#E8EAE9] bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent animate-pulse">
              404
            </div>
          </div>

          {/* Icon */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Page Not Found
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            The page you're looking for doesn't exist.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
            
            <Link href="/bowls">
              <Button variant="outline" className="border-2 border-gray-300 dark:border-slate-600 hover:border-orange-500 dark:hover:border-orange-400 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all duration-200">
                <Compass className="h-4 w-4 mr-2" />
                Browse Bowls
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
