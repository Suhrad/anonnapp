import Navigation from "@/components/navbar/Navigation";
import LeftSidebar from "@/components/sidebars/LeftSidebar";
import RightSidebar from "@/components/sidebars/RightSidebar";
import GlobalChatListener from "@/components/chat/GlobalChatListener";
import type { Bowl, Organization } from "@/types";
import type { ReactNode } from "react";

interface MainLayoutProps {
  onCreatePost?: (type?: string) => void;
  bowls?: Bowl[];
  organizations?: Organization[];
  children: ReactNode;
  rightSidebar?: ReactNode;
  hideRightSidebar?: boolean;
}

export default function MainLayout({
  onCreatePost,
  bowls,
  organizations,
  children,
  rightSidebar,
  hideRightSidebar = false,
}: MainLayoutProps) {
  return (
    <div className="h-screen flex flex-col py-2 overflow-hidden">
      <GlobalChatListener />
      <div className="fixed bg-[#0a0a0a] top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      <div className="flex-1 flex overflow-hidden pt-14 sm:pt-[68px] md:pt-[72px] px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24 2xl:px-32">
        <div className="flex pt-1 flex-col lg:grid lg:grid-cols-8 gap-4 sm:gap-6 lg:gap-8 xl:gap-12 w-full h-full">
          {/* Left Sidebar - Fixed on mobile for overlay behavior, sticky on desktop */}
          <aside className="fixed lg:sticky left-0 top-14 sm:top-[68px] md:top-[72px] lg:top-[72px] z-40 lg:z-auto lg:col-span-2 bg-[#0a0a0a] py-4 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4.25rem)] md:h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-4.5rem)] lg:self-start">
            <div className="h-full overflow-y-auto">
              <LeftSidebar />
            </div>
          </aside>

          {/* Center Content - Scrollable */}
          <main className={`w-full pt-1 sm:pt-4 pb-2 sm:pb-7 overflow-y-auto text-white pl-20 lg:pl-0 h-full ${hideRightSidebar ? 'lg:col-span-6' : 'lg:col-span-4'}`}>
            {children}
          </main>

          {/* Right Sidebar - Sticky */}
          {!hideRightSidebar && (
            <aside className="w-full lg:col-span-2 text-white sm:py-2 order-1 lg:order-2 lg:sticky lg:top-[72px] lg:h-[calc(100vh-4.5rem)] lg:self-start overflow-y-auto">
              {rightSidebar ?? (
                <RightSidebar
                  bowls={bowls}
                  organizations={organizations}
                  onCreatePost={onCreatePost || (() => {})}
                />
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
