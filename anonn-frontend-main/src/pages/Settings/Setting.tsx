import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApiMutation } from "@/hooks/useApiMutation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Lock, User, LogOut, Copy, Shield, MessageSquare, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "privacy">("account");
  const { user, dbProfile, isAuthenticated, logout, refreshProfile } = useAuth();
  const walletAddress = dbProfile?.walletAddress || user?.walletAddress;
  const displayName = dbProfile?.username || user?.username || "Anonymous User";
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
    : "Not connected";
  
  // Local state for toggles based on dbProfile.notificationSettings safely
  const [chatEnabled, setChatEnabled] = useState((dbProfile as any)?.notificationSettings?.chat !== false);
  const [mentionsEnabled, setMentionsEnabled] = useState((dbProfile as any)?.notificationSettings?.mentions !== false);

  const updateSettingsMutation = useApiMutation<any, any>({
    endpoint: "users/me",
    method: "PUT",
    onSuccess: () => {
      toast.success("Settings updated");
      refreshProfile();
    },
    onError: (err) => {
      toast.error("Failed to update settings", { description: err.message });
    }
  });

  const handleToggle = (key: string, currentValue: boolean) => {
    const newValue = !currentValue;
    if (key === "chat") setChatEnabled(newValue);
    if (key === "mentions") setMentionsEnabled(newValue);

    updateSettingsMutation.mutate({
      notificationSettings: {
        ...(dbProfile as any)?.notificationSettings,
        [key]: newValue,
      }
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const tabs = [
    { id: "account", label: "Account", icon: <User className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy & Security", icon: <Lock className="w-4 h-4" /> },
  ];

  const ToggleRow = ({
    title,
    description,
    enabled,
    onClick,
    icon,
  }: {
    title: string;
    description: string;
    enabled: boolean;
    onClick: () => void;
    icon: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#2b2d31] bg-[#14161a] px-5 py-5">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#2f3338] bg-[#0d0f12] text-[#E8EAE9]">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[#E8EAE9]">{title}</h3>
          <p className="max-w-xl text-sm leading-6 text-[#8E8E93]">{description}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          enabled
            ? "border-[#7BE0AE] bg-[#b9f0ce]"
            : "border-[#34363b] bg-[#0c0d10]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full transition-transform ${
            enabled
              ? "translate-x-6 bg-[#079455]"
              : "translate-x-1 bg-[#5b616b]"
          }`}
        />
      </button>
    </div>
  );

  if (!isAuthenticated) {
     return (
       <div className="max-w-[800px] mx-auto p-4 text-center mt-20">
         <h1 className="text-2xl text-white font-bold mb-4">Authentication Required</h1>
         <p className="text-[#8E8E93]">Please connect your wallet to view settings.</p>
       </div>
     );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1080px] flex-col px-4 py-8">
      <div className="mb-8 flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2a2c31] bg-[#101216] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#8E8E93]">
          <Shield className="h-3.5 w-3.5" />
          Settings
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">Profile controls</h1>
        <p className="max-w-2xl text-sm leading-6 text-[#8E8E93]">
          Manage your anonymous identity, notification preferences, and account safety without exposing your wallet or private details.
        </p>
      </div>
      
      <div className="grid flex-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar Tabs */}
        <div className="space-y-4">
          <Card className="rounded-3xl border border-[#26292e] bg-[#111317] p-4">
            <div className="mb-4 rounded-2xl border border-[#272a30] bg-[radial-gradient(circle_at_top_left,_rgba(160,217,255,0.12),_transparent_55%),linear-gradient(180deg,#15181d_0%,#0f1115_100%)] p-4">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2d3138] bg-[#0b0d10] text-base font-semibold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-[#8E8E93]">Public identity</p>
                <p className="text-lg font-semibold text-white">{displayName}</p>
                <p className="text-xs text-[#6f7681]">{shortWallet}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[#d8dde4] bg-[#f2f4f7] text-[#0f1012]"
                  : "border-[#2c2f34] bg-[#14161a] text-[#8E8E93] hover:border-[#3a3e45] hover:text-[#E8EAE9]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
            </div>
          </Card>
        </div>

        {/* Content Area */}
        <div className="min-w-0">
          {activeTab === "account" && (
            <div className="space-y-6">
              <Card className="rounded-3xl border border-[#272a2f] bg-[#111317] p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Your identity</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8E8E93]">
                      These details define your anonymous public persona. Updating them changes how your past and future posts, polls, and comments appear, without revealing your wallet.
                    </p>
                  </div>
                  <div className="hidden rounded-2xl border border-[#2a2e35] bg-[#0d1014] p-3 text-[#9ad5f8] md:block">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2b2e34] bg-[#16191e] p-5">
                    <p className="mb-2 text-xs uppercase tracking-[0.22em] text-[#707784]">Public display name</p>
                    <p className="text-lg font-semibold text-[#E8EAE9]">{displayName}</p>
                    <p className="mt-3 text-sm leading-6 text-[#8E8E93]">
                      This is the name shown on your posts, polls, replies, and public profile.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#2b2e34] bg-[#16191e] p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#707784]">Connected wallet</p>
                      <button
                        onClick={() => walletAddress && handleCopy(walletAddress, "Wallet address")}
                        disabled={!walletAddress}
                        className="inline-flex items-center gap-2 rounded-full border border-[#30343b] px-3 py-1 text-xs text-[#D8DDE4] transition-colors hover:border-[#4b5563] hover:text-white disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                    <p className="break-all font-mono text-sm text-[#E8EAE9]">
                      {walletAddress || "Not connected"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#8E8E93]">
                      Your wallet stays private in content surfaces. It is used only for authentication and signing.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-3xl border border-[#5a1e24]/40 bg-[linear-gradient(180deg,rgba(85,18,25,0.18),rgba(23,11,14,0.92))] p-7">
                <div className="mb-5">
                  <h2 className="text-2xl font-semibold text-[#ffb4b8]">Danger zone</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d2a3a7]">
                    Disconnect your wallet and clear the current session. You’ll need to authenticate again before accessing your profile and encrypted chats.
                  </p>
                </div>
                <Button 
                  onClick={logout}
                  variant="ghost"
                  className="rounded-2xl border border-[#a53a46]/30 bg-[#D92D20]/10 px-5 py-6 text-[#ff7b74] hover:bg-[#D92D20] hover:text-white"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect & Logout
                </Button>
              </Card>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <Card className="rounded-3xl border border-[#272a2f] bg-[#111317] p-7">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-white">Global notifications</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8E8E93]">
                    Control the alerts that interrupt you. Keep signal high and noise low.
                  </p>
                </div>

                <div className="space-y-4">
                  <ToggleRow
                    title="New chat messages"
                    description="Receive toast alerts when someone sends a message in a group you’ve joined."
                    enabled={chatEnabled}
                    onClick={() => handleToggle("chat", chatEnabled)}
                    icon={<MessageSquare className="h-4 w-4" />}
                  />

                  <ToggleRow
                    title="Mentions"
                    description="Get notified when someone @mentions you in a post, poll, or discussion thread."
                    enabled={mentionsEnabled}
                    onClick={() => handleToggle("mentions", mentionsEnabled)}
                    icon={<Bell className="h-4 w-4" />}
                  />
                </div>
              </Card>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-6">
              <Card className="rounded-3xl border border-[#272a2f] bg-[#111317] p-7 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-[#2f3a31] bg-[#ABEFC6]/10 p-3">
                    <Lock className="w-5 h-5 text-[#ABEFC6]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Privacy & security</h2>
                    <p className="mt-2 text-sm leading-6 text-[#8E8E93]">
                      Your chat messages are encrypted locally on your device before they ever reach our servers. We cannot read your private group discussions. Encryption keys are securely bound to your wallet signature.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#2b2e34] bg-[#16191e] p-5">
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-[#D8DDE4]">Anonymous identifier</h3>
                  <p className="mb-4 text-sm leading-6 text-[#8E8E93]">
                    This internal ID maps your wallet to your anonymous persona invisibly. It powers authorship without exposing your wallet publicly.
                  </p>
                  <div className="flex items-center justify-between gap-2 overflow-hidden rounded-2xl border border-[#2b2f34] bg-[#0b0d10] p-3 pl-4">
                    <span className="truncate font-mono text-xs text-[#69707c] blur-[4px] transition-all hover:blur-none" title="Hover to reveal">
                      {(dbProfile as any)?.anonymousId || "anon_xxxxxxxxxxxxxxxxx"}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
