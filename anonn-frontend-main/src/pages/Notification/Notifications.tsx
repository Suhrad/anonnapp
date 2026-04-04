import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { apiCall } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign, Bell, Check, MessageSquare, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useApiQuery<NotificationsResponse | null>({
    queryKey: ["notifications"],
    endpoint: "notifications",
    enabled: isAuthenticated,
    on401: "returnNull",
    retry: false,
  });

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;

  const filtered = filter === "unread" ? notifications.filter((entry) => !entry.isRead) : notifications;

  const markAsReadMutation = useApiMutation<void, { id: string }>({
    endpoint: "notifications/read",
    mutationFn: async ({ id }) => {
      await apiCall({ endpoint: `notifications/${id}/read`, method: "PUT" });
    },
    invalidateQueries: [["notifications"]],
  });

  const markAllAsReadMutation = useApiMutation<void, void>({
    endpoint: "notifications/read-all",
    mutationFn: async () => {
      await apiCall({ endpoint: "notifications/read-all", method: "PUT" });
    },
    invalidateQueries: [["notifications"]],
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "mention":
        return <AtSign className="h-5 w-5 text-[#E8EAE9]" />;
      case "comment_reply":
      case "post_comment":
        return <MessageSquare className="h-5 w-5 text-blue-400" />;
      case "community_invite":
        return <Users className="h-5 w-5 text-orange-400" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification._id });
    }

    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <Card className="bg-[#2a2a2a] border-gray-800 p-8 text-center">
          <h3 className="text-white text-lg mb-2">Failed to load notifications</h3>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["notifications"] })}>Retry</Button>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <Card className="bg-[#2a2a2a] border-gray-800 p-12 text-center">
          <Bell className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl md:text-2xl font-bold text-white mb-3">Authentication Required</h3>
          <p className="text-gray-400">Connect your wallet to view notifications.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Notifications</h1>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllAsReadMutation.mutate()}
            className="bg-[#1B1C20] border border-[#525252]/40 text-[#E8EAE9] hover:bg-[#25262c]"
          >
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-[#E8EAE9] text-[#0f1012]" : "bg-[#1B1C20] text-[#E8EAE9]"}
        >
          All
        </Button>
        <Button
          onClick={() => setFilter("unread")}
          className={filter === "unread" ? "bg-[#E8EAE9] text-[#0f1012]" : "bg-[#1B1C20] text-[#E8EAE9]"}
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
        </Button>
      </div>

      {isLoading ? (
        <Card className="bg-[#1B1C20] border border-[#525252]/30 p-6 text-[#8E8E93]">Loading notifications...</Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#1B1C20] border border-[#525252]/30 p-12 text-center">
          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-[#8E8E93]">No notifications</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((notification) => (
            <button
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full text-left bg-[#1B1C20] border p-4 transition-colors hover:bg-[#23242a] ${
                notification.isRead ? "border-[#525252]/20" : "border-[#E8EAE9]/45"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#E8EAE9]">{notification.title}</p>
                  {notification.message && <p className="text-sm text-[#8E8E93] mt-1">{notification.message}</p>}
                  <p className="text-[11px] text-[#7B7D83] mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
