import { useState } from "react";

export function useMetaMask() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // Connect to MetaMask and get the address
  async function connect() {
    setIsLoading(true);
    setError(null);
    try {
      if (!(window as any).ethereum) {
        setError("MetaMask is not installed");
        setIsLoading(false);
        return null;
      }
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts[0]) {
        setError("No accounts found");
        setIsLoading(false);
        return null;
      }
      setAddress(accounts[0]);
      setIsLoading(false);
      return accounts[0];
    } catch (err: any) {
      setError(err.message || "MetaMask connection failed");
      setIsLoading(false);
      return null;
    }
  }

  // Sign a message with MetaMask
  async function signMessage(message: string) {
    setIsLoading(true);
    setError(null);
    try {
      if (!(window as any).ethereum || !address) {
        setError("MetaMask not connected");
        setIsLoading(false);
        return null;
      }
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      setIsLoading(false);
      return signature;
    } catch (err: any) {
      setError(err.message || "Signing failed");
      setIsLoading(false);
      return null;
    }
  }

  return { connect, signMessage, address, isLoading, error };
}
