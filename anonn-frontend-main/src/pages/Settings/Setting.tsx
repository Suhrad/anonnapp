import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApiMutation } from "@/hooks/useApiMutation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Lock, User, LogOut } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "privacy">("account");
  const { user, dbProfile, isAuthenticated, logout, refreshProfile } = useAuth();
  const walletAddress = dbProfile?.walletAddress || user?.walletAddress;
  
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

  if (!isAuthenticated) {
     return (
       <div className="max-w-[800px] mx-auto p-4 text-center mt-20">
         <h1 className="text-2xl text-white font-bold mb-4">Authentication Required</h1>
         <p className="text-[#8E8E93]">Please connect your wallet to view settings.</p>
       </div>
     );
  }

  return (
    <div className="max-w-[800px] mx-auto py-8 px-4 h-full flex flex-col">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>
      
      <div className="flex flex-col md:flex-row gap-8 flex-1">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-[0.2px] ${
                activeTab === tab.id
                  ? "bg-[#E8EAE9] text-[#0f1012] border-[#E8EAE9]"
                  : "bg-[rgba(234,234,234,0.02)] text-[#8E8E93] border-[#525252]/30 hover:bg-[#1B1C20] hover:text-[#E8EAE9]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl text-white font-bold mb-4">Your Identity</h2>
                <Card className="bg-[#1B1C20] border-[#525252]/30 p-6 space-y-4 rounded-sm">
                  <div>
                    <label className="text-xs text-[#8E8E93] uppercase tracking-wider block mb-1">Public Display Name</label>
                    <p className="text-[#E8EAE9] font-spacemono">{dbProfile?.username || user?.username || "Anonymous User"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#8E8E93] uppercase tracking-wider block mb-1">Connected Wallet</label>
                    <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#525252]/30 p-3">
                      <p className="text-[#E8EAE9] font-spacemono text-sm max-w-[200px] sm:max-w-md truncate">
                        {walletAddress || "Not connected"}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => walletAddress && handleCopy(walletAddress, "Wallet address")}
                        disabled={!walletAddress}
                        className="text-[#8E8E93] hover:text-white disabled:opacity-50"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              <div>
                <h2 className="text-xl text-[#D92D20] font-bold mb-4">Danger Zone</h2>
                <Card className="bg-[#1B1C20] border-[#D92D20]/20 p-6 rounded-sm">
                  <p className="text-[#8E8E93] text-sm mb-4">Disconnect your wallet and clear your current session. You will need to re-authenticate to access your profile and encrypted chats.</p>
                  <Button 
                    onClick={logout}
                    variant="ghost"
                    className="bg-[#D92D20]/10 text-[#D92D20] hover:bg-[#D92D20] hover:text-white border border-[#D92D20]/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect & Logout
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-xl text-white font-bold mb-4">Global Notifications</h2>
              <Card className="bg-[#1B1C20] border-[#525252]/30 p-0 overflow-hidden divide-y divide-[#525252]/30 rounded-sm">
                
                <div className="flex flex-wrap gap-4 items-center justify-between p-6">
                  <div>
                    <h3 className="text-[#E8EAE9] font-medium">New Chat Messages</h3>
                    <p className="text-[#8E8E93] text-sm mt-1">Receive toast alerts when someone sends a message in a group you’ve joined.</p>
                  </div>
                  <button 
                    onClick={() => handleToggle("chat", chatEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center border-[0.2px] border-[#525252]/30 transition-colors ${
                      chatEnabled ? "bg-[#ABEFC6]" : "bg-[#0a0a0a]"
                    }`}
                  >
                    <span 
                      className={`inline-block h-4 w-4 transform transition-transform ${
                        chatEnabled ? "translate-x-6 bg-[#079455]" : "translate-x-1 bg-[#525252]"
                      }`} 
                    />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-4 items-center justify-between p-6">
                  <div>
                    <h3 className="text-[#E8EAE9] font-medium">Mentions</h3>
                    <p className="text-[#8E8E93] text-sm mt-1">Get notified when someone @mentions you.</p>
                  </div>
                  <button 
                    onClick={() => handleToggle("mentions", mentionsEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center border-[0.2px] border-[#525252]/30 transition-colors ${
                      mentionsEnabled ? "bg-[#ABEFC6]" : "bg-[#0a0a0a]"
                    }`}
                  >
                    <span 
                      className={`inline-block h-4 w-4 transform transition-transform ${
                        mentionsEnabled ? "translate-x-6 bg-[#079455]" : "translate-x-1 bg-[#525252]"
                      }`} 
                    />
                  </button>
                </div>

              </Card>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-6">
              <h2 className="text-xl text-white font-bold mb-4">Privacy & Security</h2>
              <Card className="bg-[#1B1C20] border-[#525252]/30 p-6 space-y-4 rounded-sm">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ABEFC6]/10 p-2 border-[0.2px] border-[#ABEFC6]/20">
                    <Lock className="w-5 h-5 text-[#ABEFC6]" />
                  </div>
                  <div>
                    <h3 className="text-[#E8EAE9] font-medium">End-to-End Encryption</h3>
                    <p className="text-[#8E8E93] text-sm mt-1 leading-relaxed">
                      Your chat messages are encrypted locally on your device before they ever reach our servers. We cannot read your private group discussions. Encryption keys are securely bound to your wallet signature.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="bg-[#1B1C20] border-[#525252]/30 p-6 space-y-4 rounded-sm">
                <div>
                  <h3 className="text-[#E8EAE9] font-medium mb-1">Anonymous Identifier</h3>
                  <p className="text-[#8E8E93] text-sm mb-4">This internal ID maps your wallet to your anonymous persona invisibly.</p>
                  <div className="flex items-center justify-between gap-2 overflow-hidden bg-[#0a0a0a] border border-[#525252]/30 p-2 pl-3">
                    <span className="text-[#525252] font-spacemono text-xs truncate select-none blur-[4px] hover:blur-none transition-all cursor-help" title="Hover to reveal">
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
