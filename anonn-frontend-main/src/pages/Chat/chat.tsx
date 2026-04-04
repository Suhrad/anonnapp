import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useAuth } from "@/hooks/useAuth";
import { apiCall } from "@/lib/api";
import {
  encryptMessage,
  decryptMessage,
  decryptGroupKey,
  cacheGroupKey,
  getCachedGroupKey,
  getSessionSecretKey,
} from "@/lib/crypto";
import { useQueryClient } from "@tanstack/react-query";
import {
  Info,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Smile,
  UserMinus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnonProfile {
  anonymousId: string;
  username: string;
  avatar?: string;
}

interface ChatGroupMember {
  anonUserId: string;
  role: "owner" | "member";
  joinedAt: string;
}

interface ChatGroup {
  _id: string;
  name: string;
  description?: string;
  inviteCode: string;
  anonCreatedBy: string;
  members: ChatGroupMember[];
  memberProfiles?: AnonProfile[];
  creator?: AnonProfile;
  lastMessageAt?: string;
  updatedAt?: string;
}

interface ChatMessage {
  _id: string;
  group: string;
  anonSenderId: string;
  sender?: AnonProfile;
  content: string;
  nonce?: string;
  isEncrypted?: boolean;
  createdAt: string;
}

interface GroupsResponse {
  groups: ChatGroup[];
}

interface MessagesResponse {
  messages: ChatMessage[];
}

interface GroupKeyResponse {
  encryptedKey: string;
  nonce: string;
  senderPublicKey: string;
}

interface CreateGroupPayload {
  name: string;
  description?: string;
}

interface JoinGroupPayload {
  inviteCode: string;
}

interface SendMessagePayload {
  content: string;
  nonce?: string;
  isEncrypted: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EMOJIS = ["😀", "😂", "😍", "🔥", "🚀", "💯", "👏", "🙌", "🎉", "🤝", "👀", "🤔"];

const formatTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatRelativeTime = (iso?: string) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const resolveWsBase = (apiUrl: string) => {
  const clean = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  const noApiSuffix = clean.endsWith("/api") ? clean.slice(0, -4) : clean;
  if (noApiSuffix.startsWith("https://")) return `wss://${noApiSuffix.slice("https://".length)}`;
  if (noApiSuffix.startsWith("http://")) return `ws://${noApiSuffix.slice("http://".length)}`;
  return "ws://localhost:8000";
};

const upsertAndSortMessages = (current: ChatMessage[], incoming: ChatMessage) => {
  if (current.some((e) => e._id === incoming._id)) return current;
  return [...current, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

const getAnonIdFromToken = (token: string): string | null => {
  try {
    return JSON.parse(atob(token.split(".")[1])).anonymousId ?? null;
  } catch {
    return null;
  }
};

/** Single-letter avatar from a group name */
const groupInitial = (name: string) => name.trim().charAt(0).toUpperCase();

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();
  const queryClient = useQueryClient();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedGroupRef = useRef<string | null>(null);
  const selectedGroupRef = useRef<string | null>(null);
  const firstGroupRef = useRef<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [currentAnonId, setCurrentAnonId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    getAccessToken().then((token) => {
      if (token) setCurrentAnonId(getAnonIdFromToken(token));
    });
  }, [isAuthenticated, getAccessToken]);

  const { data: groupsData, isLoading: groupsLoading } = useApiQuery<GroupsResponse | null>({
    endpoint: "chat/groups",
    queryKey: ["/api/chat/groups"],
    enabled: isAuthenticated,
    on401: "returnNull",
    retry: false,
    refetchInterval: 15000,
  });

  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g._id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  useEffect(() => { selectedGroupRef.current = selectedGroupId; }, [selectedGroupId]);
  useEffect(() => { firstGroupRef.current = groups[0]?._id ?? null; }, [groups]);

  const selectedGroupKey = selectedGroupId ?? undefined;

  const { data: messagesData, isLoading: messagesLoading } = useApiQuery<MessagesResponse>({
    endpoint: `chat/groups/${selectedGroupId}/messages`,
    queryKey: ["/api/chat/messages", selectedGroupKey],
    enabled: Boolean(isAuthenticated && selectedGroupId),
    retry: false,
  });

  const rawMessages = useMemo(() => messagesData?.messages ?? [], [messagesData]);

  const messages = useMemo(() => {
    if (!selectedGroupId) return rawMessages;
    const groupKey = getCachedGroupKey(selectedGroupId);
    if (!groupKey) return rawMessages;
    return rawMessages.map((msg) => {
      if (!msg.isEncrypted || !msg.nonce) return msg;
      const pt = decryptMessage(msg.content, msg.nonce, groupKey);
      return { ...msg, content: pt ?? "[decryption failed]" };
    });
  }, [rawMessages, selectedGroupId]);

  const isCurrentUserOwner = useMemo(() => {
    if (!selectedGroup || !currentAnonId) return false;
    return selectedGroup.anonCreatedBy === currentAnonId;
  }, [selectedGroup, currentAnonId]);

  const isE2EEActive = selectedGroupId ? Boolean(getCachedGroupKey(selectedGroupId)) : false;

  const loadGroupKey = useCallback(async (groupId: string) => {
    if (getCachedGroupKey(groupId)) return;
    const secretKey = getSessionSecretKey();
    if (!secretKey) return;
    try {
      const response = await apiCall<GroupKeyResponse>({
        endpoint: `chat/groups/${groupId}/key`,
        method: "GET",
      });
      const groupKey = decryptGroupKey(response.encryptedKey, response.nonce, response.senderPublicKey, secretKey);
      if (groupKey) {
        cacheGroupKey(groupId, groupKey);
        queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", groupId] });
      }
    } catch { /* key not yet available */ }
  }, [queryClient]);

  useEffect(() => {
    if (selectedGroupId) loadGroupKey(selectedGroupId);
  }, [selectedGroupId, loadGroupKey]);

  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const preferred = urlParams.get("groupId");
      if (preferred && groups.some((g) => g._id === preferred)) {
        setSelectedGroupId(preferred);
      } else {
        setSelectedGroupId(groups[0]._id);
      }
      const mid = urlParams.get("messageId");
      if (mid) setPendingMessageId(mid);
    }
    if (selectedGroupId && !groups.some((g) => g._id === selectedGroupId)) {
      setSelectedGroupId(groups[0]?._id ?? null);
    }
  }, [groups, selectedGroupId]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createGroupMutation = useApiMutation<{ group: ChatGroup }, CreateGroupPayload>({
    endpoint: "chat/groups",
    method: "POST",
    invalidateQueries: [["/api/chat/groups"]],
    onSuccess: (data) => {
      setShowCreateDialog(false);
      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedGroupId(data.group._id);
      toast.success(`Group created. Invite code: ${data.group.inviteCode}`);
    },
    onError: (error) => toast.error("Failed to create group", { description: error.message }),
  });

  const joinGroupMutation = useApiMutation<{ group: ChatGroup }, JoinGroupPayload>({
    endpoint: "chat/groups/join",
    method: "POST",
    invalidateQueries: [["/api/chat/groups"]],
    onSuccess: (data) => {
      setShowJoinDialog(false);
      setJoinCode("");
      setSelectedGroupId(data.group._id);
      toast.success(`Joined ${data.group.name}`);
    },
    onError: (error) => toast.error("Failed to join group", { description: error.message }),
  });

  const removeMemberMutation = useApiMutation<unknown, { anonUserId: string }>({
    endpoint: "chat/groups/remove",
    mutationFn: async ({ anonUserId }) =>
      apiCall({ endpoint: `chat/groups/${selectedGroupId}/members/${anonUserId}`, method: "DELETE" }),
    invalidateQueries: [["/api/chat/groups"]],
    onSuccess: () => toast.success("Member removed"),
    onError: (error) => toast.error("Failed to remove member", { description: error.message }),
  });

  const sendMutation = useApiMutation<{ message: ChatMessage }, SendMessagePayload>({
    endpoint: `chat/groups/${selectedGroupId}/messages`,
    method: "POST",
    onSuccess: (data) => {
      setMessageInput("");
      setShowEmojiPicker(false);
      if (!selectedGroupId) return;
      queryClient.setQueryData<MessagesResponse>(["/api/chat/messages", selectedGroupId], (cur) => ({
        messages: upsertAndSortMessages(cur?.messages ?? [], data.message),
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
    },
    onError: (error) => toast.error("Failed to send message", { description: error.message }),
  });

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) { reconnectTimerRef.current = setTimeout(connect, 1200); return; }

      const ws = new WebSocket(
        `${resolveWsBase(import.meta.env.VITE_API_URL as string)}/api/ws?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const target = selectedGroupRef.current || firstGroupRef.current;
        if (target) { ws.send(JSON.stringify({ type: "subscribe_group", groupId: target })); subscribedGroupRef.current = target; }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as { type: string; data?: { groupId: string; message: ChatMessage } };
          if (payload.type === "chat_message" && payload.data) {
            const { groupId, message } = payload.data;
            queryClient.setQueryData<MessagesResponse>(["/api/chat/messages", groupId], (cur) => ({
              messages: upsertAndSortMessages(cur?.messages ?? [], message),
            }));
            queryClient.invalidateQueries({ queryKey: ["/api/chat/groups"] });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => { if (!cancelled) reconnectTimerRef.current = setTimeout(connect, 1000); };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      wsRef.current?.close();
      wsRef.current = null;
      subscribedGroupRef.current = null;
    };
  }, [isAuthenticated, getAccessToken, queryClient]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedGroupId) return;
    if (subscribedGroupRef.current && subscribedGroupRef.current !== selectedGroupId) {
      ws.send(JSON.stringify({ type: "unsubscribe_group", groupId: subscribedGroupRef.current }));
    }
    ws.send(JSON.stringify({ type: "subscribe_group", groupId: selectedGroupId }));
    subscribedGroupRef.current = selectedGroupId;
  }, [selectedGroupId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!pendingMessageId || !selectedGroupId) return;
    const exists = messages.some((m) => m._id === pendingMessageId);
    if (exists) {
      document.getElementById(`chat-message-${pendingMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(pendingMessageId);
      window.setTimeout(() => setHighlightedMessageId(null), 1800);
      setPendingMessageId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall<{ message: ChatMessage }>({
          endpoint: `chat/groups/${selectedGroupId}/messages/${pendingMessageId}`,
          method: "GET",
        });
        if (!cancelled) {
          queryClient.setQueryData<MessagesResponse>(["/api/chat/messages", selectedGroupId], (cur) => ({
            messages: upsertAndSortMessages(cur?.messages ?? [], res.message),
          }));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [pendingMessageId, selectedGroupId, messages, queryClient]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) { toast.error("Group name is required"); return; }
    createGroupMutation.mutate({ name, description: newGroupDescription.trim() });
  };

  const handleJoinGroup = (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) { toast.error("Invite code must be 6 letters or numbers"); return; }
    joinGroupMutation.mutate({ inviteCode: code });
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const plaintext = messageInput.trim();
    if (!selectedGroupId || !plaintext) return;
    const groupKey = selectedGroupId ? getCachedGroupKey(selectedGroupId) : null;
    if (groupKey) {
      const { content, nonce } = encryptMessage(plaintext, groupKey);
      sendMutation.mutate({ content, nonce, isEncrypted: true });
    } else {
      sendMutation.mutate({ content: plaintext, isEncrypted: false });
    }
  };

  // ── Auth guards ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] p-12 text-center">
          <Skeleton className="h-6 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] p-16 flex flex-col items-center text-center gap-4">
          <MessageSquare className="h-12 w-12 text-[#525252]" />
          <p className="font-spacemono text-base text-white">Authentication Required</p>
          <p className="text-sm text-[#8E8E93] max-w-sm">Connect your wallet to create groups, join by code, and chat in real time.</p>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent("triggerWalletConnect"))}
            className="bg-[#E8EAE9] text-[#0f1012] hover:bg-[#d4d6d5] mt-2"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-spacemono text-base text-white uppercase tracking-wide">Chats</p>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#E8EAE9] text-[#0f1012] hover:bg-[#d4d6d5] h-9 px-4 text-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Group
          </Button>
          <Button
            onClick={() => setShowJoinDialog(true)}
            className="bg-transparent border border-[#525252]/40 text-[#E8EAE9] hover:bg-[#25262c] h-9 px-4 text-sm"
          >
            Join Group
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,30%)_minmax(0,70%)] xl:grid-cols-[minmax(260px,25%)_minmax(0,75%)] gap-4">

        {/* ── Groups list panel ── */}
        <div className="border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] flex flex-col">
          <div className="px-4 py-3 border-b border-[#525252]/20 flex items-center justify-between">
            <span className="font-spacemono text-[11px] text-[#8E8E93] uppercase tracking-widest">Groups</span>
            {!groupsLoading && (
              <span className="text-[11px] text-[#525252]">{groups.length}</span>
            )}
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-13rem)]">
            {groupsLoading ? (
              <div className="p-2 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <Skeleton className="h-9 w-9 rounded-sm flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                <Users className="h-8 w-8 text-[#525252]" />
                <p className="text-sm text-[#8E8E93]">No groups yet</p>
                <p className="text-xs text-[#525252]">Create one or join with an invite code</p>
              </div>
            ) : (
              <div className="p-1">
                {groups.map((group) => {
                  const isActive = group._id === selectedGroupId;
                  return (
                    <button
                      key={group._id}
                      onClick={() => setSelectedGroupId(group._id)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-3 transition-colors ${
                        isActive
                          ? "bg-[#2a2a2a]"
                          : "hover:bg-[#23242a]"
                      }`}
                    >
                      {/* Group initial avatar */}
                      <div className={`h-9 w-9 flex-shrink-0 flex items-center justify-center text-sm font-spacemono border-[0.2px] ${
                        isActive
                          ? "bg-[#E8EAE9]/10 border-[#E8EAE9]/30 text-[#E8EAE9]"
                          : "bg-[rgba(234,234,234,0.04)] border-[#525252]/30 text-[#8E8E93]"
                      }`}>
                        {groupInitial(group.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-spacemono truncate ${isActive ? "text-white" : "text-[#E8EAE9]"}`}>
                          {group.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[#525252]">
                            {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                          </span>
                          {(group.lastMessageAt || group.updatedAt) && (
                            <>
                              <span className="text-[#525252]/50">·</span>
                              <span className="text-[11px] text-[#525252]">
                                {formatRelativeTime(group.lastMessageAt || group.updatedAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Invite code badge */}
                      <span className="flex-shrink-0 text-[9px] font-spacemono text-[#525252] border-[0.2px] border-[#525252]/30 px-1.5 py-0.5 hidden sm:block">
                        {group.inviteCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Messages panel ── */}
        <div className="border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] flex flex-col min-h-[calc(100vh-13rem)]">
          {!selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 gap-3">
              <MessageSquare className="h-10 w-10 text-[#525252]" />
              <p className="font-spacemono text-sm text-[#8E8E93] uppercase tracking-wide">No group selected</p>
              <p className="text-xs text-[#525252]">Pick a group from the left to start chatting</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-[#525252]/20 flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowGroupDetails(true)}
                  className="min-w-0 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-spacemono text-sm text-white truncate group-hover:text-[#E8EAE9] transition-colors">
                      {selectedGroup.name}
                    </p>
                    {isE2EEActive && (
                      <span className="flex items-center gap-1 text-[9px] font-spacemono text-[#525252] border-[0.2px] border-[#525252]/30 px-1.5 py-0.5 flex-shrink-0">
                        <Lock className="h-2.5 w-2.5" />
                        E2EE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#525252] mt-0.5">
                    {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? "s" : ""}
                    {selectedGroup.description ? ` · ${selectedGroup.description}` : ""}
                  </p>
                </button>
                <button
                  onClick={() => setShowGroupDetails(true)}
                  className="flex-shrink-0 h-8 w-8 flex items-center justify-center border-[0.2px] border-[#525252]/30 text-[#525252] hover:text-[#E8EAE9] hover:border-[#525252]/60 transition-colors"
                  title="Group info"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {messagesLoading ? (
                  <div className="space-y-3">
                    {[70, 50, 85, 60, 40].map((w, i) => (
                      <div key={i} className={`flex flex-col gap-1 ${i % 2 === 0 ? "items-start" : "items-end"}`}>
                        <Skeleton className="h-2.5 w-16" />
                        <Skeleton className={`h-10`} style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                    <MessageSquare className="h-8 w-8 text-[#525252]" />
                    <p className="text-sm text-[#8E8E93]">No messages yet</p>
                    <p className="text-xs text-[#525252]">Be the first to say something</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const own = currentAnonId ? message.anonSenderId === currentAnonId : false;
                    const highlighted = highlightedMessageId === message._id;
                    const senderName = message.sender?.username ?? message.anonSenderId.slice(0, 8);

                    return (
                      <div
                        key={message._id}
                        id={`chat-message-${message._id}`}
                        className={`flex flex-col gap-0.5 ${own ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-[#525252] px-1">
                          {own ? "You" : `@${senderName}`}
                        </span>
                        <div
                          className={`max-w-[75%] px-3 py-2 border-[0.2px] transition-colors ${
                            own
                              ? "bg-[rgba(59,130,246,0.08)] border-blue-500/20"
                              : "bg-[rgba(234,234,234,0.03)] border-[#525252]/30"
                          } ${highlighted ? "ring-1 ring-[#E8EAE9]/30" : ""}`}
                        >
                          <p className="text-sm text-[#E8EAE9] whitespace-pre-wrap break-words leading-relaxed">
                            {message.content}
                          </p>
                          <p className={`text-[10px] mt-1 ${own ? "text-blue-400/40" : "text-[#525252]"}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={listEndRef} />
              </div>

              {/* Mention pills */}
              {(selectedGroup.memberProfiles ?? []).filter((p) => p.anonymousId !== currentAnonId).length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-[#525252]/10 pt-2">
                  {(selectedGroup.memberProfiles ?? [])
                    .filter((p) => p.anonymousId !== currentAnonId)
                    .slice(0, 8)
                    .map((profile) => (
                      <button
                        key={profile.anonymousId}
                        type="button"
                        onClick={() => {
                          const sep = messageInput.endsWith(" ") || !messageInput ? "" : " ";
                          setMessageInput(`${messageInput}${sep}@${profile.username} `);
                        }}
                        className="text-[10px] text-[#525252] border-[0.2px] border-[#525252]/30 px-2 py-0.5 hover:text-[#E8EAE9] hover:border-[#525252]/60 transition-colors font-spacemono"
                      >
                        @{profile.username}
                      </button>
                    ))}
                </div>
              )}

              {/* Input row */}
              <form
                onSubmit={handleSend}
                className="px-4 py-3 border-t border-[#525252]/20 flex gap-2 items-center relative"
              >
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((p) => !p)}
                  className="flex-shrink-0 h-9 w-9 flex items-center justify-center border-[0.2px] border-[#525252]/30 text-[#525252] hover:text-[#E8EAE9] hover:border-[#525252]/60 transition-colors"
                  title="Emoji"
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-4 bg-[#0a0a0a] border border-[#525252]/40 p-2 grid grid-cols-6 gap-1 z-20 shadow-xl">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setMessageInput((p) => `${p}${emoji}`)}
                        className="h-8 w-8 hover:bg-[#1B1C20] transition-colors text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Write a message…"
                  className="bg-[#0f1012] border-[#525252]/40 text-white text-sm placeholder:text-[#525252]"
                  maxLength={2000}
                />

                <Button
                  type="submit"
                  disabled={sendMutation.isPending || !messageInput.trim()}
                  className="flex-shrink-0 bg-[#E8EAE9] text-[#0f1012] hover:bg-[#d4d6d5] h-9 px-4"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* ── Create Group Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#0a0a0a] border border-[#525252]/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-spacemono text-sm uppercase tracking-wide text-white">
              New Group
            </DialogTitle>
            <DialogDescription className="text-[#8E8E93] text-xs">
              Create an anonymous encrypted chat group. Share the invite code with others.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-3 mt-1">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="bg-[#0f1012] border-[#525252]/40 text-white placeholder:text-[#525252] text-sm"
              maxLength={80}
              autoFocus
            />
            <Input
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              placeholder="Description (optional)"
              className="bg-[#0f1012] border-[#525252]/40 text-white placeholder:text-[#525252] text-sm"
              maxLength={500}
            />
            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                className="bg-transparent border border-[#525252]/40 text-[#8E8E93] hover:bg-[#1B1C20] hover:text-[#E8EAE9] text-sm h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createGroupMutation.isPending}
                className="bg-[#E8EAE9] text-[#0f1012] hover:bg-[#d4d6d5] text-sm h-9"
              >
                {createGroupMutation.isPending ? "Creating…" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Join Group Dialog ── */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-[#0a0a0a] border border-[#525252]/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-spacemono text-sm uppercase tracking-wide text-white">
              Join Group
            </DialogTitle>
            <DialogDescription className="text-[#8E8E93] text-xs">
              Enter a 6-character invite code to join an existing group.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinGroup} className="space-y-3 mt-1">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              className="bg-[#0f1012] border-[#525252]/40 text-white placeholder:text-[#525252] uppercase tracking-[0.4em] text-center font-spacemono text-base"
              maxLength={6}
              autoFocus
            />
            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                onClick={() => setShowJoinDialog(false)}
                className="bg-transparent border border-[#525252]/40 text-[#8E8E93] hover:bg-[#1B1C20] hover:text-[#E8EAE9] text-sm h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={joinGroupMutation.isPending}
                className="bg-[#E8EAE9] text-[#0f1012] hover:bg-[#d4d6d5] text-sm h-9"
              >
                {joinGroupMutation.isPending ? "Joining…" : "Join Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Group Details Dialog ── */}
      <Dialog open={showGroupDetails} onOpenChange={setShowGroupDetails}>
        {selectedGroup && (
          <DialogContent className="bg-[#0a0a0a] border border-[#525252]/30 text-white max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-spacemono text-sm uppercase tracking-wide text-white">
                {selectedGroup.name}
              </DialogTitle>
              {selectedGroup.description && (
                <DialogDescription className="text-[#8E8E93] text-xs">
                  {selectedGroup.description}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Invite code */}
            <div className="border-t border-[#525252]/20 pt-4">
              <p className="font-spacemono text-[10px] text-[#525252] uppercase tracking-widest mb-2">Invite Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-[rgba(234,234,234,0.02)] border-[0.2px] border-[#525252]/30 text-[#E8EAE9] font-spacemono tracking-[0.4em] text-sm text-center">
                  {selectedGroup.inviteCode}
                </code>
                <Button
                  onClick={() => { navigator.clipboard.writeText(selectedGroup.inviteCode); toast.success("Copied"); }}
                  className="bg-transparent border border-[#525252]/40 text-[#8E8E93] hover:bg-[#1B1C20] hover:text-[#E8EAE9] h-9 px-3 text-sm"
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Members */}
            <div className="border-t border-[#525252]/20 pt-4">
              <p className="font-spacemono text-[10px] text-[#525252] uppercase tracking-widest mb-2">
                Members ({selectedGroup.members.length})
              </p>
              <div className="space-y-1.5">
                {selectedGroup.members.map((member) => {
                  const profile = selectedGroup.memberProfiles?.find((p) => p.anonymousId === member.anonUserId);
                  const canRemove =
                    isCurrentUserOwner &&
                    member.anonUserId !== selectedGroup.anonCreatedBy &&
                    member.anonUserId !== currentAnonId;

                  return (
                    <div
                      key={member.anonUserId}
                      className="flex items-center justify-between border-[0.2px] border-[#525252]/30 bg-[rgba(234,234,234,0.02)] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 flex-shrink-0 flex items-center justify-center bg-[rgba(234,234,234,0.04)] border-[0.2px] border-[#525252]/30 font-spacemono text-xs text-[#8E8E93]">
                          {(profile?.username ?? member.anonUserId).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-[#E8EAE9] truncate">
                            @{profile?.username ?? member.anonUserId.slice(0, 8)}
                          </p>
                          <span className="text-[10px] font-spacemono text-[#525252] border-[0.2px] border-[#525252]/30 px-1.5 py-0.5 uppercase">
                            {member.role}
                          </span>
                        </div>
                      </div>
                      {canRemove && (
                        <Button
                          onClick={() => removeMemberMutation.mutate({ anonUserId: member.anonUserId })}
                          disabled={removeMemberMutation.isPending}
                          className="h-7 px-2.5 bg-[#7A271A]/20 text-[#ff6b6b] hover:bg-[#7A271A]/40 border-[0.2px] border-[#7A271A]/40 text-xs"
                        >
                          <UserMinus className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
