import { Route, Switch, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";
import MainLoadingScreen from "@/loaders/MainLoadingScreen";
import { useLayoutData } from "@/context/LayoutDataContext";
import MainLayout from "@/layout/MainLayout";
import HomePage from "@/pages/Home/home";
import PollsPage from "@/pages/Polls/polls";
import BowlsPage from "@/pages/Bowls/bowls";
import NotificationsPage from "@/pages/Notification/Notifications";
import BookmarksPage from "@/pages/Bookmark/bookmark";
import ChatPage from "@/pages/Chat/chat";
import ProfilePage from "@/pages/Profile/profile";
import UserProfile from "@/pages/Profile/UserProfile";
import PostContent from "@/pages/Post/PostContent";
import BowlContent from "@/pages/Bowls/BowlContent";
import SettingsPage from "@/pages/Settings/Setting";
import CreatePostModal from "@/pages/CreatePost/create-post";
import NotFound from "@/pages/NotFound/not-found";
import PollContent from "@/pages/Polls/PollContent";
import MarketsPage from "@/pages/Markets/markets";
import MarketContent from "@/pages/Markets/MarketContent";
import MarketsRightPanel from "@/components/sidebars/MarketsRightPanel";
import { useState, useEffect } from "react";

function RedirectHome() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return null;
}

function RouterWithLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { bowls } = useLayoutData();

  ScrollToTop();

  const [location, setLocation] = useLocation();
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<"text" | "poll" | undefined>();
  const [createPostBowlId, setCreatePostBowlId] = useState<number | undefined>();
  const [wasOnCreatePostRoute, setWasOnCreatePostRoute] = useState(false);

  const showAuthToast = (action: string) => {
    toast.error("Authentication Required", {
      description: `Please connect your wallet to ${action}.`,
    });
  };

  // Handle /create-post route with query parameters
  useEffect(() => {
    if (isLoading) return; // Wait for auth to finish loading

    if (location === "/create-post") {
      setWasOnCreatePostRoute(true);
      const searchParams = new URLSearchParams(window.location.search);
      const type = searchParams.get("type") as "text" | "poll" | null;
      const bowlId = searchParams.get("bowlId");

      if (!isAuthenticated) {
        showAuthToast("create post");
        setLocation("/");
        return;
      }

      setCreatePostType(type || undefined);
      setCreatePostBowlId(bowlId ? Number(bowlId) : undefined);
      setIsCreatePostModalOpen(true);
    } else if (location !== "/create-post" && wasOnCreatePostRoute) {
      // Only close the modal if we navigated away from /create-post route
      setWasOnCreatePostRoute(false);
      setIsCreatePostModalOpen(false);
      setCreatePostType(undefined);
      setCreatePostBowlId(undefined);
    }
  }, [location, isAuthenticated, isLoading, setLocation, wasOnCreatePostRoute]);

  // Protect profile and bookmarks routes
  useEffect(() => {
    if (isLoading) return; // Wait for auth to finish loading

    const protectedRoutes = ["/profile", "/bookmarks", "/chat"];
    const isProtectedRoute = protectedRoutes.some(route => location === route);

    if (isProtectedRoute && !isAuthenticated) {
      showAuthToast("access this page");
      setLocation("/");
    }
  }, [location, isAuthenticated, isLoading, setLocation]);

  const handleCreatePost = (type?: string, bowlId?: number) => {
    console.log("[Routes] handleCreatePost called with type:", type, "bowlId:", bowlId, "isAuthenticated:", isAuthenticated);
    if (!isAuthenticated) {
      console.log("[Routes] Not authenticated, showing toast");
      showAuthToast("create post");
      return;
    }
    console.log("[Routes] Setting modal state - type:", type, "bowlId:", bowlId);
    setCreatePostType(type as "text" | "poll" | undefined);
    setCreatePostBowlId(bowlId);
    setIsCreatePostModalOpen(true);
    console.log("[Routes] Modal state set to open");
  };

  if (isLoading) {
    return <MainLoadingScreen />;
  }

  return (
    <>
      <Switch>
        <Route path="/">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <HomePage
              onCreatePost={handleCreatePost}
              onExploreCommunities={() => setLocation("/bowls")}
              isAuthenticated={isAuthenticated}
            />
          </MainLayout>
        </Route>

        <Route path="/polls">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <PollsPage />
          </MainLayout>
        </Route>

        <Route path="/poll">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <PollContent />
          </MainLayout>
        </Route>

        <Route path="/organizations">
          <RedirectHome />
        </Route>

        <Route path="/markets">
          <MainLayout
            onCreatePost={handleCreatePost}
            bowls={bowls}
            rightSidebar={<MarketsRightPanel />}
          >
            <MarketsPage />
          </MainLayout>
        </Route>

        <Route path="/bowls">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <BowlsPage />
          </MainLayout>
        </Route>

        <Route path="/notifications">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <NotificationsPage />
          </MainLayout>
        </Route>

        <Route path="/bookmarks">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <BookmarksPage />
          </MainLayout>
        </Route>

        <Route path="/chat">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls} hideRightSidebar={true}>
            <ChatPage />
          </MainLayout>
        </Route>

        <Route path="/profile">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <ProfilePage />
          </MainLayout>
        </Route>

        <Route path="/u/:username">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <UserProfile />
          </MainLayout>
        </Route>

        <Route path="/organizations/:id">
          <RedirectHome />
        </Route>

        <Route path="/markets/:id">
          <MainLayout
            onCreatePost={handleCreatePost}
            bowls={bowls}
            rightSidebar={<MarketsRightPanel />}
          >
            <MarketContent />
          </MainLayout>
        </Route>

        <Route path="/post">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <PostContent />
          </MainLayout>
        </Route>

        <Route path="/bowls/:id">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            <BowlContent />
          </MainLayout>
        </Route>

        {/* <Route path="/post/:id">
        <MainLayout
          onCreatePost={handleCreatePost}
          bowls={bowls}
        >
          <PostContent />
        </MainLayout>
      </Route> */}

        <Route path="/settings">
          <MainLayout
            onCreatePost={handleCreatePost}
            bowls={bowls}
            hideRightSidebar={true}
          >
            <SettingsPage />
          </MainLayout>
        </Route>

        <Route path="/create-post">
          <MainLayout onCreatePost={handleCreatePost} bowls={bowls}>
            {/* Empty content - modal will be shown */}
            <div />
          </MainLayout>
        </Route>

        <Route path="/*" component={NotFound} />

        {/*   
      <Route path="/auth" component={RedirectHome} />  
        <Route path="/search" component={Search} />
        <Route path="/settings" component={Settings} /> 
        */}
      </Switch>

      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => {
          setIsCreatePostModalOpen(false);
          setCreatePostType(undefined);
          setCreatePostBowlId(undefined);
          // If we're on /create-post route, navigate away when closing
          if (location === "/create-post") {
            setLocation("/");
          }
        }}
        initialType={createPostType}
        initialBowlId={createPostBowlId}
      />
    </>
  );
}

export default RouterWithLayout;
