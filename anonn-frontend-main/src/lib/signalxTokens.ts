// ─────────────────────────────────────────────────────────────────────────────
// SignalX Design Tokens
// Extracted from the SignalX Chrome extension (inject.css + popup design).
// Kept here as permanent reference so the folder can be deleted safely.
// ─────────────────────────────────────────────────────────────────────────────

// ── Surface / Layout ─────────────────────────────────────────────────────────
export const SX = {
  bg:         "#050505",
  surface:    "rgba(24,24,27,0.5)",    // glassmorphism card background
  surfaceHov: "rgba(39,39,42,0.6)",    // card hover background
  border:     "rgba(255,255,255,0.08)",
  borderHov:  "rgba(168,85,247,0.35)",
  blur:       "blur(16px)",

  // Accent colours
  accent:     "#a855f7",               // purple — primary brand
  accentSoft: "rgba(168,85,247,0.15)",
  accentGlow: "rgba(168,85,247,0.5)",
  good:       "#10b981",               // green — positive / live
  danger:     "#ef4444",               // red   — negative / risk
  muted:      "#a1a1aa",               // zinc-400

  // Typography
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

// ── Source badge styles ───────────────────────────────────────────────────────
export const SOURCE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  polymarket: { bg: "rgba(45,156,219,0.15)",  color: "#2d9cdb", border: "rgba(45,156,219,0.3)"  },
  kalshi:     { bg: "rgba(0,222,163,0.15)",   color: "#00dea3", border: "rgba(0,222,163,0.3)"   },
  manifold:   { bg: "rgba(168,85,247,0.15)",  color: "#a855f7", border: "rgba(168,85,247,0.3)"  },
  manual:     { bg: "rgba(255,255,255,0.06)", color: "#a1a1aa", border: "rgba(255,255,255,0.1)" },
};

// ── Category badge colors (exact values from inject.css) ─────────────────────
// Sports      → orange  #ff9f63
// Politics    → blue    #6396ff
// Crypto      → violet  #c863ff
// Finance     → yellow  #ffe063
// Science     → purple  #a855f7  (mapped from "tech" in inject.css)
// Geopolitics → red     #ff6363
// Other       → slate   #9999cc
export const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  SPORTS:      { color: "#ff9f63", bg: "rgba(255,159,99,0.38)"  },
  POLITICS:    { color: "#6396ff", bg: "rgba(99,150,255,0.38)"  },
  CRYPTO:      { color: "#c863ff", bg: "rgba(200,99,255,0.38)"  },
  FINANCE:     { color: "#ffe063", bg: "rgba(255,224,99,0.38)"  },
  SCIENCE:     { color: "#a855f7", bg: "rgba(168,85,247,0.38)"  },
  GEOPOLITICS: { color: "#ff6363", bg: "rgba(255,99,99,0.38)"   },
  OTHER:       { color: "#9999cc", bg: "rgba(153,153,204,0.28)" },
  ALL:         { color: "#9999cc", bg: "rgba(153,153,204,0.28)" },
};

// ── Probability bar gradient ──────────────────────────────────────────────────
export const PROB_BAR = "linear-gradient(135deg,#9333ea,#c084fc)";

// ─────────────────────────────────────────────────────────────────────────────
// GammaMarket — Polymarket Gamma API shape
// Source: platform/market_fetcher.ts (now deleted)
// API: https://gamma-api.polymarket.com/markets
// ─────────────────────────────────────────────────────────────────────────────
export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  /** JSON string, e.g. '["Yes","No"]' */
  outcomes: string;
  /** JSON string, e.g. '["0.72","0.28"]' */
  outcomePrices: string;
  /** JSON string of CLOB token IDs */
  clobTokenIds: string;
  bestBid: string;
  bestAsk: string;
  volume: string;
  volume24hr: string;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
  endDate: string;
  oneDayPriceChange: string;
  icon: string;
}

// Gamma API pagination constants (from market_fetcher.ts)
export const GAMMA_PAGE_SIZE  = 500;
export const GAMMA_CACHE_TTL  = 5 * 60 * 1000;   // 5 minutes in ms
export const GAMMA_TIMEOUT_MS = 15_000;           // 15 seconds

/** Base URL for Polymarket Gamma REST API */
export const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";

/** Markets endpoint — sorted by 24h volume descending */
export const GAMMA_MARKETS_URL = (offset = 0) =>
  `${GAMMA_BASE_URL}/events?active=true&closed=false&limit=${GAMMA_PAGE_SIZE}&offset=${offset}&order=volume24hr&ascending=false`;

// ─────────────────────────────────────────────────────────────────────────────
// Whale API endpoint catalogue
// Source: platform/whale_api.ts (now deleted)
// These are the endpoints the SignalX whale-tracking engine exposes.
// Future feature: wire these into anonn for a whale-activity feed.
// ─────────────────────────────────────────────────────────────────────────────
export const WHALE_API_ENDPOINTS = {
  // Aggregates
  summary:          "GET  /api/whales/summary",
  leaderboard:      "GET  /api/whales/leaderboard",
  activity:         "GET  /api/whales/activity",
  alerts:           "GET  /api/whales/alerts",

  // Per-market
  marketWhales:     "GET  /api/whales/market/:marketId",

  // Scanner
  scannerSignals:   "GET  /api/whales/scanner/signals",
  scannerDiscover:  "GET  /api/whales/scanner/discover",

  // Per-wallet
  positions:        "GET  /api/whales/positions/:walletAddress",
  portfolio:        "GET  /api/whales/portfolio/:walletAddress",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CSS animation names (added to index.css)
// ─────────────────────────────────────────────────────────────────────────────
// @keyframes sx-fade-up  — cards animate in (opacity 0→1, translateY 8px→0)
// @keyframes sx-shimmer  — skeleton loading shimmer (background-position sweep)
// @keyframes sx-bar-slide — probability bar fill animation
