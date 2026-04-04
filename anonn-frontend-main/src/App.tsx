import OfflineIndicator from "@/components/OfflineIndicator";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient } from "./lib/queryClient";
import "@solana/wallet-adapter-react-ui/styles.css";
import RouterWithLayout from "./routes";
import { LayoutDataProvider } from "./context/LayoutDataContext";




function App() {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);

  // No Phantom wallet adapter needed (Phantom is now standard)
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>

                <Toaster />
                <OfflineIndicator />
                <LayoutDataProvider>
                  <RouterWithLayout />
                </LayoutDataProvider>
              </TooltipProvider>
            </AuthProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
