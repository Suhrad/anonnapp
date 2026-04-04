import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApiQuery } from "@/hooks/useApiQuery";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

interface ChatGroup {
  _id: string;
  name: string;
}

interface GroupsResponse {
  groups: ChatGroup[];
}

interface ChatMessage {
  _id: string;
  group: string;
  anonSenderId: string;
  content: string;
  isEncrypted?: boolean;
  sender?: {
    username: string;
  };
}

const resolveWsBase = (apiUrl: string) => {
  const clean = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  const noApiSuffix = clean.endsWith("/api") ? clean.slice(0, -4) : clean;
  if (noApiSuffix.startsWith("https://"))
    return `wss://${noApiSuffix.slice("https://".length)}`;
  if (noApiSuffix.startsWith("http://"))
    return `ws://${noApiSuffix.slice("http://".length)}`;
  return "ws://localhost:8000";
};

const getAnonIdFromToken = (token: string): string | null => {
  try {
    return JSON.parse(atob(token.split(".")[1])).anonymousId ?? null;
  } catch {
    return null;
  }
};

export default function GlobalChatListener() {
  const { isAuthenticated, getAccessToken, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setLocation] = useLocation();

  // Ensure these settings exist and fallback to true if undefined
  const chatNotificationsEnabled =
    (user as any)?.notificationSettings?.chat !== false;

  // Fetch groups to subscribe to
  const { data: groupsData } = useApiQuery<GroupsResponse | null>({
    endpoint: "chat/groups",
    queryKey: ["/api/chat/groups"],
    enabled: isAuthenticated && chatNotificationsEnabled,
    on401: "returnNull",
    retry: false,
    refetchInterval: 30000,
  });

  const groups = groupsData?.groups ?? [];

  useEffect(() => {
    if (!isAuthenticated || !chatNotificationsEnabled) return;
    let cancelled = false;
    let anonId: string | null = null;

    const connect = async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        reconnectTimerRef.current = setTimeout(connect, 1200);
        return;
      }
      
      anonId = getAnonIdFromToken(token);

      const ws = new WebSocket(
        `${resolveWsBase(import.meta.env.VITE_API_URL as string)}/api/ws?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe to all groups user is part of
        groups.forEach((g) => {
          ws.send(JSON.stringify({ type: "subscribe_group", groupId: g._id }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type: string;
            data?: { groupId: string; message: ChatMessage };
          };
          if (payload.type === "chat_message" && payload.data) {
            const { groupId, message } = payload.data;
            const groupName =
              groups.find((g) => g._id === groupId)?.name || "a group";

            // If user sent it, don't notify
            if (message.anonSenderId === anonId) return;

            // If user is actively searching on this chat page, maybe skip?
            // Actually, if they are on `/chat`, we could check if they are viewing this specific group
            // but location just says `/chat`. The URL might have ?groupId=...
            const searchParams = new URLSearchParams(window.location.search);
            const activeGroupId = searchParams.get("groupId");
            
            // If the user's focus is on the current chat room, don't show toast
            if (window.location.pathname === "/chat" && (activeGroupId === groupId || (!activeGroupId && groups.length > 0 && groups[0]._id === groupId))) {
               return;
            }

            toast.custom(
              (t) => (
                <div
                  className="bg-[#0f1012] border border-[#525252]/40 rounded-lg p-4 shadow-xl flex gap-3 items-start cursor-pointer hover:bg-[#1B1C20] transition-colors"
                  onClick={() => {
                    toast.dismiss(t);
                    setLocation(`/chat?groupId=${groupId}&messageId=${message._id}`);
                  }}
                >
                  <MessageSquare className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#E8EAE9] text-sm">
                      New message in {groupName}
                    </p>
                    <p className="text-[#8E8E93] text-sm truncate mt-0.5">
                      {message.isEncrypted ? "🔒 Encrypted message" : message.content}
                    </p>
                  </div>
                </div>
              ),
              { duration: 5000, position: "bottom-right" }
            );
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 1000);
        }
      };
    };

    if (groups.length > 0) {
      connect();
    }

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        // Optional: send unsubscribe for all groups? 
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, chatNotificationsEnabled, getAccessToken, groups, setLocation]);

  return null;
}
