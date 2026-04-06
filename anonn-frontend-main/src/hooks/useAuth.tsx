import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import type { User } from "../types/index";
import { sanitizeUserData, validateAnonymizedData } from "../lib/anonymity";
import bs58 from "bs58";
import { encodeBase64 } from "tweetnacl-util";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  deriveIdentityKey,
  aesEncrypt,
  generateEncryptionKeyPair,
  restoreSecretKey,
  cacheSecretKey,
  STORAGE_KEYS as E2EE_KEYS,
} from "../lib/crypto";

const BASE_URL = import.meta.env.VITE_API_URL;

// Constants
const STORAGE_KEYS = {
  PHANTOM_TOKEN: "phantom_auth_token",
  METAMASK_TOKEN: "metamask_auth_token",
} as const;

// Types
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  selectedAddress?: string;
  on: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    __getDynamicToken?: () => Promise<string | null>;
    __getPrivyToken?: () => Promise<string | null>;
  }
}

const isMetaMaskAvailable =
  typeof window !== "undefined" && window.ethereum !== undefined;

type WalletType = "phantom" | "metamask" | null;

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoredSession: boolean;
  getAccessToken: () => Promise<string | null>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setDbProfile: (p: Partial<User>) => void;
  dbProfile: User | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, connect, disconnect, signMessage, wallet } =
    useWallet();
  const { connection: _connection } = useConnection();
  const queryClient = useQueryClient();

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [dbProfile, setDbProfile] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRestoredSession, setIsRestoredSession] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Refs for tracking state without causing re-renders
  const authTokenRef = useRef(authToken);
  const lastAuthWalletRef = useRef<string | null>(null);
  const authInProgressRef = useRef(false);
  const sessionRestoredRef = useRef(false);
  const profileFetchedRef = useRef(false);

  // Keep authTokenRef in sync
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // Helper to detect wallet type
  const getWalletType = useCallback((): WalletType => {
    if (connected && publicKey && signMessage) {
      return "phantom";
    }
    if (isMetaMaskAvailable && window.ethereum?.selectedAddress) {
      return "metamask";
    }
    return null;
  }, [connected, publicKey, signMessage]);

  // Helper to get wallet address
  const getWalletAddress = useCallback((): string | null => {
    const walletType = getWalletType();
    if (walletType === "phantom") {
      return publicKey?.toString() || null;
    }
    if (walletType === "metamask") {
      return window.ethereum?.selectedAddress || null;
    }
    return null;
  }, [getWalletType, publicKey]);

  // Helper to get stored token for wallet type
  const getStoredToken = useCallback((walletType: WalletType): string | null => {
    if (walletType === "phantom") {
      return localStorage.getItem(STORAGE_KEYS.PHANTOM_TOKEN);
    }
    if (walletType === "metamask") {
      return localStorage.getItem(STORAGE_KEYS.METAMASK_TOKEN);
    }
    return null;
  }, []);

  // Helper to store token for wallet type
  const storeToken = useCallback(
    (walletType: WalletType, token: string) => {
      if (walletType === "phantom") {
        localStorage.setItem(STORAGE_KEYS.PHANTOM_TOKEN, token);
      } else if (walletType === "metamask") {
        localStorage.setItem(STORAGE_KEYS.METAMASK_TOKEN, token);
      }
    },
    []
  );

  // Helper to clear tokens
  const clearTokens = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.PHANTOM_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.METAMASK_TOKEN);
  }, []);

  // Authenticate with Phantom wallet
  const authenticatePhantom = useCallback(
    async (publicKey: string): Promise<string> => {
      if (!signMessage) {
        throw new Error("Phantom wallet not connected");
      }

      const nonceRes = await fetch(`${BASE_URL}auth/wallet/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, chain: "solana" }),
      });

      if (!nonceRes.ok) {
        let msg = `Server error ${nonceRes.status}`;
        try { msg = (await nonceRes.json()).message || msg; }
        catch { const t = await nonceRes.text().catch(() => ''); if (t.includes('ECONNREFUSED') || t.includes('502') || t.includes('503')) msg = 'Backend server is not reachable — make sure it is running on port 8000'; }
        throw new Error(msg);
      }

      const nonceData = (await nonceRes.json()).data;
      const messageBytes = new TextEncoder().encode(nonceData.message);
      const signature = await signMessage(messageBytes);

      const verifyPayload = {
        publicKey,
        signature: bs58.encode(signature),
        chain: "solana",
        ...(dbProfile?.username && { username: dbProfile.username }),
      };

      const verifyRes = await fetch(`${BASE_URL}auth/wallet/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });

      if (!verifyRes.ok) {
        let msg = `Server error ${verifyRes.status}`;
        try { msg = (await verifyRes.json()).message || msg; }
        catch { const t = await verifyRes.text().catch(() => ''); if (t.includes('ECONNREFUSED') || t.includes('502') || t.includes('503')) msg = 'Backend server is not reachable — make sure it is running on port 8000'; }
        throw new Error(msg);
      }

      const verifyData = (await verifyRes.json()).data;
      return verifyData.accessToken;
    },
    [signMessage, dbProfile]
  );

  // Authenticate with MetaMask wallet
  const authenticateMetaMask = useCallback(
    async (address: string): Promise<string> => {
      if (!window.ethereum) {
        throw new Error("MetaMask not available");
      }

      const nonceRes = await fetch(`${BASE_URL}auth/wallet/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain: "ethereum" }),
      });

      if (!nonceRes.ok) {
        let msg = `Server error ${nonceRes.status}`;
        try { msg = (await nonceRes.json()).message || msg; }
        catch { const t = await nonceRes.text().catch(() => ''); if (t.includes('ECONNREFUSED') || t.includes('502') || t.includes('503')) msg = 'Backend server is not reachable — make sure it is running on port 8000'; }
        throw new Error(msg);
      }

      const nonceData = (await nonceRes.json()).data;

      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [nonceData.message, address],
      })) as string;

      const verifyPayload = {
        address,
        signature,
        chain: "ethereum",
        ...(dbProfile?.username && { username: dbProfile.username }),
      };

      const verifyRes = await fetch(`${BASE_URL}auth/wallet/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });

      if (!verifyRes.ok) {
        let msg = `Server error ${verifyRes.status}`;
        try { msg = (await verifyRes.json()).message || msg; }
        catch { const t = await verifyRes.text().catch(() => ''); if (t.includes('ECONNREFUSED') || t.includes('502') || t.includes('503')) msg = 'Backend server is not reachable — make sure it is running on port 8000'; }
        throw new Error(msg);
      }

      const verifyData = (await verifyRes.json()).data;
      return verifyData.accessToken;
    },
    [dbProfile]
  );

  // ── E2EE setup ────────────────────────────────────────────────────────────
  // Called after successful login. Non-blocking — failures are silently logged.
  const setupE2EE = useCallback(
    async (token: string, signFn: (msg: Uint8Array) => Promise<Uint8Array>) => {
      try {
        // Decode JWT to extract anonymousId (no secret needed for payload)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const anonymousId: string | undefined = payload.anonymousId;
        if (!anonymousId) return;

        // Sign the identity message with the wallet
        const identityMsg = new TextEncoder().encode("ANONN_IDENTITY_V1");
        const signature = await signFn(identityMsg);
        const signatureBase64 = encodeBase64(signature);

        // ── Case 1: Keypair already exists in localStorage ─────────────────
        const encryptedSecretKey = localStorage.getItem(E2EE_KEYS.ENCRYPTED_SECRET_KEY);
        const secretKeyIv = localStorage.getItem(E2EE_KEYS.SECRET_KEY_IV);
        const publicKeyBase64 = localStorage.getItem(E2EE_KEYS.PUBLIC_KEY);

        if (encryptedSecretKey && secretKeyIv && publicKeyBase64) {
          // Fetch salt from server to re-derive the identity key
          const mapRes = await fetch(`${BASE_URL}anon/identity-mapping`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (mapRes.ok) {
            const { data } = await mapRes.json();
            const salt = data?.mapping?.salt;
            if (salt) {
              const identityKey = await deriveIdentityKey(signatureBase64, salt);
              try {
                // Restore and cache in sessionStorage for use by chat
                const secretKey = await restoreSecretKey(identityKey, encryptedSecretKey, secretKeyIv);
                cacheSecretKey(secretKey);
              } catch {
                // Key mismatch — device likely wiped or salt changed; regenerate below
                localStorage.removeItem(E2EE_KEYS.ENCRYPTED_SECRET_KEY);
                localStorage.removeItem(E2EE_KEYS.SECRET_KEY_IV);
                localStorage.removeItem(E2EE_KEYS.PUBLIC_KEY);
                await generateAndRegisterKeypair(token, signatureBase64, anonymousId);
                return;
              }

              // Re-register public key with server (idempotent)
              await fetch(`${BASE_URL}anon/encryption-key`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ publicKey: publicKeyBase64 }),
              });
              return;
            }
          }
        }

        // ── Case 2: First login or lost keypair ────────────────────────────
        await generateAndRegisterKeypair(token, signatureBase64, anonymousId);
      } catch (err) {
        // E2EE setup is best-effort; don't block the user
        console.error("[E2EE] setup failed:", err);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Helper: generate keypair, store encrypted, register with server, store identity mapping
  const generateAndRegisterKeypair = async (
    token: string,
    signatureBase64: string,
    anonymousId: string
  ) => {
    // Generate a fresh 16-byte salt
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = encodeBase64(saltBytes);

    const identityKey = await deriveIdentityKey(signatureBase64, saltBase64);

    // Generate keypair and encrypt secret key with identity key
    const { publicKeyBase64, encryptedSecretKey, secretKeyIv, secretKey } =
      await generateEncryptionKeyPair(identityKey);

    // Persist encrypted keypair to localStorage
    localStorage.setItem(E2EE_KEYS.PUBLIC_KEY, publicKeyBase64);
    localStorage.setItem(E2EE_KEYS.ENCRYPTED_SECRET_KEY, encryptedSecretKey);
    localStorage.setItem(E2EE_KEYS.SECRET_KEY_IV, secretKeyIv);

    // Cache decrypted key in sessionStorage (cleared on tab close)
    cacheSecretKey(secretKey);

    // Encrypt anonymousId for identity mapping (for key recovery)
    const { ciphertext: encryptedData, iv } = await aesEncrypt(
      identityKey,
      new TextEncoder().encode(anonymousId)
    );

    // POST identity mapping (encrypted, server-opaque)
    await fetch(`${BASE_URL}anon/identity-mapping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ encryptedData, iv, salt: saltBase64 }),
    });

    // POST X25519 public key
    await fetch(`${BASE_URL}anon/encryption-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicKey: publicKeyBase64 }),
    });
  };

  // Main authentication flow
  const authenticateWithBackend = useCallback(async () => {
    // Skip if we already have a token or auth is in progress
    if (authTokenRef.current || isAuthenticating || authInProgressRef.current) {
      return;
    }

    const walletType = getWalletType();
    if (!walletType) {
      return;
    }

    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      return;
    }

    // Check if we already authenticated this wallet in this session
    if (lastAuthWalletRef.current === walletAddress) {
      return;
    }

    // If we have a stored token, don't trigger a new signing flow
    const storedToken = getStoredToken(walletType);
    if (storedToken) {
      return;
    }

    authInProgressRef.current = true;
    setIsAuthenticating(true);

    try {
      let token: string;

      if (walletType === "phantom" && publicKey) {
        token = await authenticatePhantom(publicKey.toString());
      } else if (walletType === "metamask" && window.ethereum?.selectedAddress) {
        token = await authenticateMetaMask(window.ethereum.selectedAddress);
      } else {
        throw new Error("No supported wallet connected");
      }

      setAuthToken(token);
      setIsRestoredSession(false);
      lastAuthWalletRef.current = walletAddress;
      storeToken(walletType, token);

      // Initialize E2EE in the background (non-blocking)
      if (walletType === "phantom" && signMessage) {
        setupE2EE(token, async (msg) => await signMessage(msg)).catch(() => {});
      } else if (walletType === "metamask" && window.ethereum?.selectedAddress) {
        const address = window.ethereum.selectedAddress;
        setupE2EE(token, async (msg) => {
          const msgHex = "0x" + Array.from(msg).map((b) => b.toString(16).padStart(2, "0")).join("");
          const sig = (await window.ethereum!.request({
            method: "personal_sign",
            params: [msgHex, address],
          })) as string;
          // Convert hex sig to Uint8Array
          const hex = sig.startsWith("0x") ? sig.slice(2) : sig;
          return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Authentication error:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? (error.code as number)
          : undefined;

      // Handle user rejection (don't show error)
      if (
        errorCode === 4001 ||
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected")
      ) {
        return;
      }

      // Handle disconnection
      if (
        errorMessage.includes("Disconnected") ||
        errorMessage.includes("Lost connection") ||
        errorCode === -32603
      ) {
        toast.error("MetaMask connection lost", {
          description: "Please reload the page and try again.",
        });
        return;
      }

      // Generic error
      toast.error("Wallet authentication failed", {
        description: errorMessage,
      });

      if (walletType === "phantom") {
        await disconnect();
      }
    } finally {
      setIsAuthenticating(false);
      authInProgressRef.current = false;
    }
  }, [
    isAuthenticating,
    getWalletType,
    getWalletAddress,
    getStoredToken,
    storeToken,
    authenticatePhantom,
    authenticateMetaMask,
    publicKey,
    disconnect,
  ]);

  // Restore auth token from storage
  useEffect(() => {
    if (authToken) {
      return;
    }

    const walletType = getWalletType();
    let restoredToken: string | null = null;

    // Prefer token matching the connected wallet
    if (walletType) {
      restoredToken = getStoredToken(walletType);
    }

    // Fallback: restore any available token
    if (!restoredToken) {
      const phantomToken = localStorage.getItem(STORAGE_KEYS.PHANTOM_TOKEN);
      const metamaskToken = localStorage.getItem(STORAGE_KEYS.METAMASK_TOKEN);
      restoredToken = phantomToken || metamaskToken;
    }

    if (restoredToken) {
      setAuthToken(restoredToken);
      if (!sessionRestoredRef.current) {
        setIsRestoredSession(true);
        sessionRestoredRef.current = true;
      }
    }
  }, [authToken, getWalletType, getStoredToken]);

  // Trigger authentication when wallet connects
  useEffect(() => {
    authenticateWithBackend();
  }, [authenticateWithBackend]);

  // MetaMask event listeners
  useEffect(() => {
    if (!isMetaMaskAvailable || !window.ethereum) {
      return;
    }

    const handleDisconnect = (error: unknown) => {
      const err = error as { code?: number; message?: string };
      console.warn("MetaMask disconnected:", err?.message);
      localStorage.removeItem(STORAGE_KEYS.METAMASK_TOKEN);

      const metamaskToken = localStorage.getItem(STORAGE_KEYS.METAMASK_TOKEN);
      if (!metamaskToken && !localStorage.getItem(STORAGE_KEYS.PHANTOM_TOKEN)) {
        setAuthToken(null);
        setDbProfile(null);
      }

      toast.error("MetaMask disconnected", {
        description: "Please reload the page and reconnect your wallet.",
      });
    };

    const handleAccountsChanged = (accounts: unknown) => {
      const accountList = accounts as string[];
      if (accountList.length === 0) {
        console.warn("MetaMask accounts disconnected");
        localStorage.removeItem(STORAGE_KEYS.METAMASK_TOKEN);
        if (!localStorage.getItem(STORAGE_KEYS.PHANTOM_TOKEN)) {
          setAuthToken(null);
          setDbProfile(null);
        }
      } else {
        const newAddress = accountList[0];
        if (
          lastAuthWalletRef.current &&
          lastAuthWalletRef.current.toLowerCase() !== newAddress.toLowerCase()
        ) {
          localStorage.removeItem(STORAGE_KEYS.METAMASK_TOKEN);
          lastAuthWalletRef.current = null;
          setAuthToken(null);
          setDbProfile(null);
        }
      }
    };

    window.ethereum.on("disconnect", handleDisconnect);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener("disconnect", handleDisconnect);
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const authenticated = !!(connected && publicKey && authToken);

  const login = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      if (!connected || !wallet) {
        await connect();
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [connect, connected, wallet]);

  const logout = useCallback(async () => {
    try {
      await disconnect();
      setAuthToken(null);
      setDbProfile(null);
      profileFetchedRef.current = false;
      clearTokens();
      // Clear E2EE keys from localStorage (keep them for key recovery on next login)
      // We intentionally do NOT remove the encrypted keypair — the user may want to
      // restore it on next login. If they want a fresh key they can clear site data.
      sessionStorage.clear(); // clears cached group keys
      window.location.replace("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [disconnect, clearTokens]);

  const getAccessToken = useCallback(async () => {
    return authTokenRef.current;
  }, []);

  // Expose token getter on window for legacy code (properly typed)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__getDynamicToken = async () => {
        return authTokenRef.current;
      };
      window.__getPrivyToken = window.__getDynamicToken;
    }
  }, [authToken]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    const token = authTokenRef.current;
    if (!token) {
      return;
    }

    // Invalidate React Query cache first
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

    setIsLoadingProfile(true);
    try {
      const res = await fetch(`${BASE_URL}auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        const responseData = await res.json();
        const profile =
          responseData.data?.user || responseData.data || responseData;

        if (!validateAnonymizedData(profile)) {
          console.error("Received non-anonymized user data!");
        }

        const sanitizedProfile = sanitizeUserData(profile);
        setDbProfile(sanitizedProfile);
      } else if (res.status === 401) {
        setAuthToken(null);
        clearTokens();
        setDbProfile(null);
      } else {
        console.error(
          "Failed to refresh profile:",
          res.status,
          res.statusText
        );
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [clearTokens, queryClient]);

  // Fetch DB-backed profile once authenticated
  useEffect(() => {
    if (!authenticated || profileFetchedRef.current) {
      return;
    }

    profileFetchedRef.current = true;
    refreshProfile();
  }, [authenticated, refreshProfile]);

  // Handle 401 errors - token expiration is already handled in refreshProfile

  const shapedUser: User | null = useMemo(() => {
    if (!publicKey) {
      return null;
    }

    if (dbProfile) {
      const userData = {
        id: dbProfile.id || publicKey.toString(),
        username: dbProfile.username,
        avatar: dbProfile.avatar,
        bannerUrl: dbProfile.bannerUrl,
        bio: dbProfile.bio,
        location: dbProfile.location,
        website: dbProfile.website,
        allowlisted: dbProfile.allowlisted ?? true,
        karma: dbProfile.karma || 0,
        postKarma: dbProfile.postKarma || 0,
        commentKarma: dbProfile.commentKarma || 0,
        awardeeKarma: dbProfile.awardeeKarma || 0,
        followerCount: dbProfile.followerCount || 0,
        followingCount: dbProfile.followingCount || 0,
        isVerified: dbProfile.isVerified || false,
        isPremium: dbProfile.isPremium || false,
        premiumExpiresAt: dbProfile.premiumExpiresAt,
        isOnline: dbProfile.isOnline ?? true,
        lastActiveAt: dbProfile.lastActiveAt,
        createdAt: dbProfile.createdAt,
        updatedAt: dbProfile.updatedAt,
        walletAddress: dbProfile.walletAddress || publicKey.toString(),
        isCompanyVerified: dbProfile.isCompanyVerified || false,
      } as User;

      return sanitizeUserData(userData);
    }

    const now = new Date();
    const minimalUser = {
      id: publicKey.toString(),
      username: undefined,
      avatar: undefined,
      bannerUrl: undefined,
      bio: undefined,
      location: undefined,
      website: undefined,
      allowlisted: true,
      karma: 0,
      postKarma: 0,
      commentKarma: 0,
      awardeeKarma: 0,
      followerCount: 0,
      followingCount: 0,
      isVerified: false,
      isPremium: false,
      premiumExpiresAt: undefined,
      isOnline: true,
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
      walletAddress: publicKey.toString(),
      isCompanyVerified: false,
    } as User;

    return sanitizeUserData(minimalUser);
  }, [publicKey, dbProfile]);

  const handleSetDbProfile = useCallback((p: Partial<User>) => {
    setDbProfile((prev: User | null) => {
      if (!prev) {
        return p as User;
      }
      return { ...prev, ...p } as User;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      user: shapedUser,
      isAuthenticated: authenticated,
      isLoading: isLoadingProfile || isAuthenticating,
      isRestoredSession,
      dbProfile,
      refreshProfile,
      getAccessToken,
      login,
      logout,
      setDbProfile: handleSetDbProfile,
    }),
    [
      shapedUser,
      authenticated,
      isLoadingProfile,
      isAuthenticating,
      isRestoredSession,
      dbProfile,
      refreshProfile,
      getAccessToken,
      login,
      logout,
      handleSetDbProfile,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Fast refresh works fine with hooks - this warning is a false positive
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.error(
      "Context not found. Make sure AuthProvider is wrapping your component tree."
    );
    throw new Error(
      "useAuth must be used within an AuthProvider. Check that AuthProvider is properly set up in your app."
    );
  }
  return context;
}