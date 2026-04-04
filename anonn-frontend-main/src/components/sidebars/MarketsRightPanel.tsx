import { useMemo } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";

interface TrendingMarket {
  id: string;
  title: string;
  slug: string;
  icon: string | null;
  probabilityYes: number | null;
  volume24h: number;
  liquidity: number;
  endDate: string | null;
  url: string | null;
}

type TrendingResponse = { markets: TrendingMarket[] };

// ── CSS tokens matching SignalX dashboard exactly ─────────────────────────────
const C = {
  surface:  "rgba(24,24,27,0.6)",
  surface2: "rgba(39,39,42,0.5)",
  border:   "rgba(63,63,70,0.4)",
  text:     "#f8fafc",
  muted:    "#a1a1aa",
  accent:   "#9333ea",
  green:    "#22c55e",
  red:      "#f87171",
} as const;

function compactUsd(v: number): string {
  if (!v || v <= 0) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Shimmer({ h, w }: { h: number; w?: number | string }) {
  return (
    <div style={{
      height: h, width: w ?? "100%",
      background: "linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.03) 75%)",
      backgroundSize: "200% 100%",
      animation: "sx-shimmer 2s infinite",
      borderRadius: 6,
    }} />
  );
}

// ── Stat mini card ────────────────────────────────────────────────────────────
function StatMini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: C.muted,
        marginBottom: 6, display: "flex", alignItems: "center", gap: 5,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}


type MarketCountResponse = { pagination?: { totalItems?: number } };

// ── Main component ────────────────────────────────────────────────────────────
export default function MarketsRightPanel() {
  const { data, isLoading } = useApiQuery<TrendingResponse>({
    endpoint: "markets/trending",
    queryKey: ["/api/markets/trending"],
    retry: false,
    select: (raw: any) => raw,
  });

  const { data: countData } = useApiQuery<MarketCountResponse>({
    endpoint: "markets/search",
    queryKey: ["/api/markets/count"],
    params: { status: "active", limit: 1 },
    retry: false,
    select: (raw: any) => ({ pagination: raw?.pagination || {} }),
  });

  // Use all trending markets for stats (not sliced)
  const markets = useMemo(() => data?.markets ?? [], [data]);
  // Slice for display list
  const displayMarkets = useMemo(() => markets.slice(0, 10), [markets]);

  const totalVol = useMemo(
    () => markets.reduce((s, m) => s + (m.volume24h ?? 0), 0), [markets]
  );

  const totalLiq = useMemo(
    () => markets.reduce((s, m) => s + (m.liquidity ?? 0), 0), [markets]
  );

  const totalMarketsCount = countData?.pagination?.totalItems ?? null;

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column", gap: 16,
      paddingTop: 4, paddingRight: 2, color: C.text,
    }}>

      {/* ── Stats: 24h Vol + Total Markets ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatMini
          label="24h Volume"
          value={isLoading ? "—" : compactUsd(totalVol)}
          icon={
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="1.5" y="9" width="3" height="7.5" rx="1"/>
              <rect x="7.5" y="5.5" width="3" height="11" rx="1"/>
              <rect x="13.5" y="1.5" width="3" height="15" rx="1"/>
            </svg>
          }
        />
        <StatMini
          label="Total Markets"
          value={totalMarketsCount != null ? String(totalMarketsCount) : (isLoading ? "—" : String(markets.length))}
          icon={
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="1.5" y="1.5" width="6" height="6" rx="1.5"/>
              <rect x="10.5" y="1.5" width="6" height="6" rx="1.5"/>
              <rect x="1.5" y="10.5" width="6" height="6" rx="1.5"/>
              <rect x="10.5" y="10.5" width="6" height="6" rx="1.5"/>
            </svg>
          }
        />
      </div>

      {/* ── Stat: Open Interest ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <StatMini
          label="Open Interest"
          value={isLoading ? "—" : compactUsd(totalLiq)}
          icon={
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <ellipse cx="9" cy="9" rx="7.5" ry="3.5"/>
              <path d="M1.5 9c0 2 3.36 3.5 7.5 3.5S16.5 11 16.5 9" strokeLinecap="round"/>
              <path d="M1.5 9V13c0 2 3.36 3.5 7.5 3.5S16.5 15 16.5 13V9" strokeLinecap="round"/>
            </svg>
          }
        />
      </div>

      {/* ── Latest News & Updates panel ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 18,
        boxShadow: "0 4px 24px rgba(0,0,0,.4)",
      }}>
        <div style={{
          fontSize: 12, fontWeight: 800, marginBottom: 14,
          color: C.muted, textTransform: "uppercase" as const,
          letterSpacing: "0.7px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span>Latest News & Updates</span>
          <span style={{ height: 1, flex: 1, background: C.border, marginLeft: 10, display: "block" }} />
        </div>

        {/* Top movers list */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Shimmer h={12} />
                <Shimmer h={12} w="75%" />
                <Shimmer h={10} w="45%" />
              </div>
            ))}
          </div>
        ) : displayMarkets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 12, fontStyle: "italic" }}>
            Loading @Polymarket news...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayMarkets.slice(0, 5).map((m) => {
              const pct = m.probabilityYes != null
                ? Math.round(Number(m.probabilityYes) * (Number(m.probabilityYes) > 1 ? 1 : 100))
                : null;
              return (
                <div
                  key={m.id}
                  onClick={() => m.url && window.open(m.url, "_blank", "noopener")}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    paddingBottom: 12,
                    cursor: m.url ? "pointer" : "default",
                    transition: "color .2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                >
                  <p style={{
                    fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.4,
                    marginBottom: 5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}>
                    {m.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {pct != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: pct >= 60 ? C.green : pct <= 40 ? C.red : C.muted,
                      }}>
                        {pct}% Yes
                      </span>
                    )}
                    {m.volume24h > 0 && (
                      <span style={{ fontSize: 10, color: C.muted }}>
                        {compactUsd(m.volume24h)} vol
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 8, textAlign: "center", fontSize: 10, color: "rgba(161,161,170,0.5)" }}>
          Data from Polymarket · Real-time
        </div>
      </div>
    </div>
  );
}
