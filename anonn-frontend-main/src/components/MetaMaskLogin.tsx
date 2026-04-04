import { useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL;

// Placeholder hook - implement or import your MetaMask hook
function useMetaMask() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (): Promise<string | null> => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setIsLoading(false);
        return accounts[0] || null;
      }
      setError("MetaMask not installed");
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const signMessage = async (message: string): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        const signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
        return signature;
      }
      return null;
    } catch {
      return null;
    }
  };

  const address = typeof window !== 'undefined' && (window as any).ethereum?.selectedAddress || null;

  return { connect, signMessage, address, isLoading, error };
}

export function MetaMaskLogin({ onSuccess }: { onSuccess?: (jwt: string) => void }) {
  const { connect, signMessage, isLoading, error } = useMetaMask();
  const [step, setStep] = useState<"idle" | "nonce" | "sign" | "verifying" | "done">("idle");
  const [_jwt, setJwt] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function handleLogin() {
    setStatus("");
    setStep("idle");
    const addr = await connect();
    if (!addr) {
      setStatus("MetaMask connection failed");
      return;
    }
    setStep("nonce");
    setStatus("Requesting nonce from server...");
    // 1. Get nonce from backend
    const nonceRes = await fetch(`${BASE_URL}auth/eth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr }),
    });
    if (!nonceRes.ok) {
      setStatus("Failed to get nonce from server");
      return;
    }
    const { data } = await nonceRes.json();
    setStep("sign");
    setStatus("Sign the message in MetaMask...");
    // 2. Sign message
    const signature = await signMessage(data.message);
    if (!signature) {
      setStatus("Signature failed");
      return;
    }
    setStep("verifying");
    setStatus("Verifying signature...");
    // 3. Verify signature with backend
    const verifyRes = await fetch(`${BASE_URL}auth/eth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, signature }),
    });
    if (!verifyRes.ok) {
      setStatus("Signature verification failed");
      return;
    }
    const { token } = await verifyRes.json();
    setJwt(token);
    setStep("done");
    setStatus("Login successful!");
    localStorage.setItem("metamask_auth_token", token);
    if (onSuccess) onSuccess(token);
  }

  return (
    <div>
      <button onClick={handleLogin} disabled={isLoading || step !== "idle" && step !== "done"}>
        {isLoading ? "Connecting..." : "Login with MetaMask"}
      </button>
      {status && <div>{status}</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}
