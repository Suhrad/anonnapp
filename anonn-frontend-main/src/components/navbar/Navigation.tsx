import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Navigation() {
  const [hasShadow, setHasShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setHasShadow(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav
        className={`bg-[#0a0a0a] pt-2 sm:pt-3 md:pt-4 fixed top-0 left-0 right-0 w-full z-50 transition-shadow ${
          hasShadow ? "shadow-md" : ""
        }`}
      >
        <div className="flex justify-center items-center h-12 sm:h-14 px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24 2xl:px-32 w-full">
          {/* Centered Logo */}
          <Link href="/" className="w-full">
            <div className="border border-[#525252]/20 rounded px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 lg:py-4 w-full flex items-center justify-center">
              <img 
                src="/anonn.png" 
                alt="Anonn Logo" 
                className="w-16 h-4 sm:w-20 sm:h-5 md:w-24 md:h-6 lg:w-28 lg:h-7 xl:w-32 xl:h-8" 
              />
            </div>
          </Link>
        </div>
      </nav>
    </>
  );
}
