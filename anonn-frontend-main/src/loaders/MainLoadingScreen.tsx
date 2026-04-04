

export default function MainLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e0e] text-gray-300">
      {/* Spinner */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="h-14 w-14 border-2 border-gray-700 border-t-gray-200 rounded-full animate-spin"></div>
        <div className="absolute h-14 w-14 border-2 border-gray-700 rounded-full animate-ping opacity-10"></div>
      </div>

      {/* Loading Text */}
      <h2 className="text-lg font-mono tracking-wide text-gray-300 mb-3">
        Loading <span className="text-gray-100">Anonn</span>...
      </h2>

      {/* Subtle Dots */}
      <div className="flex justify-center space-x-2">
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
    </div>
  );
}
