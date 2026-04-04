import { getCategory } from "@/lib/marketUtils";

interface QuotedMarketEmbedMarket {
  _id?: string;
  id?: string;
  title: string;
  source?: string;
  url?: string | null;
  probabilityYes?: number | null;
  volume24h?: number | null;
  closeTime?: Date | string | null;
  icon?: string | null;
}

interface QuotedMarketEmbedProps {
  market: QuotedMarketEmbedMarket;
  /** "feed" = shown in PostCard/PollCard in timeline; "compose" = shown inside create modal */
  mode?: "feed" | "compose";
}

function fmtVol(n: number | null | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function fmtClose(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function QuotedMarketEmbed({ market, mode = "feed" }: QuotedMarketEmbedProps) {
  const category = getCategory(market.title || "", "");

  const rawProb = market.probabilityYes;
  // Handle both 0–1 scale (MongoDB normalized) and 0–100 scale (Supabase outcomePrices)
  const yPct =
    rawProb != null
      ? Math.round(Number(rawProb) <= 1 ? Number(rawProb) * 100 : Number(rawProb))
      : null;
  const nPct = yPct != null ? 100 - yPct : null;

  const volStr  = fmtVol(market.volume24h ?? null);
  const closeStr = fmtClose(market.closeTime ?? null);
  const source  = (market.source || "Polymarket").toUpperCase();

  const clickable = mode === "feed" && !!market.url;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (market.url) window.open(String(market.url), "_blank", "noopener");
  };

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      style={{
        border: "1px solid rgba(82,82,82,0.35)",
        borderRadius: 12,
        padding: "14px 16px 12px",
        background: "rgba(234,234,234,0.03)",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color .2s, background .2s",
        fontFamily: "'Space Mono', 'Courier New', monospace",
      }}
      onMouseEnter={clickable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(168,85,247,0.4)";
        (e.currentTarget as HTMLDivElement).style.background = "rgba(234,234,234,0.06)";
      } : undefined}
      onMouseLeave={clickable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(82,82,82,0.35)";
        (e.currentTarget as HTMLDivElement).style.background = "rgba(234,234,234,0.03)";
      } : undefined}
    >
      {/* ── Header: icon + category · source + title ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        {/* Market icon — 44×44 matching markets page style */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, overflow: "hidden",
          background: "rgba(39,39,42,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {market.icon
            ? <img src={market.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 20 }}>📊</span>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category · Source row */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#8E8E93",
            marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.4px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>{category}</span>
            <span style={{ color: "rgba(82,82,82,0.7)" }}>·</span>
            <span style={{ color: "#2d9cdb" }}>{source}</span>
            {mode === "compose" && (
              <span style={{
                marginLeft: "auto", fontSize: 9, color: "#8E8E93",
                background: "rgba(82,82,82,0.2)", padding: "2px 6px",
                borderRadius: 4,
              }}>
                QUOTED MARKET
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 13, fontWeight: 400, color: "#E8EAE9",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {market.title}
          </div>
        </div>
      </div>

      {/* ── Probability bar (same as MarketCard) ── */}
      {yPct != null && nPct != null ? (
        <div style={{ marginBottom: 10 }}>
          {/* Dual bar track */}
          <div style={{
            height: 7, borderRadius: 4,
            background: "rgba(39,39,42,0.8)",
            overflow: "hidden", display: "flex",
            marginBottom: 6,
          }}>
            <div style={{
              width: `${yPct}%`, height: "100%",
              background: "#16a34a",
              borderRadius: "4px 0 0 4px",
              transition: "width .3s",
            }} />
            <div style={{
              width: `${nPct}%`, height: "100%",
              background: "#dc2626",
              borderRadius: "0 4px 4px 0",
              transition: "width .3s",
            }} />
          </div>

          {/* YES% / NO% labels */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#22c55e" }}>
              {yPct}% YES
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#f87171" }}>
              {nPct}% NO
            </span>
          </div>
        </div>
      ) : null}

      {/* ── Footer: vol · close date · open link ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 10, borderTop: "1px solid rgba(82,82,82,0.2)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93" }}>
          {volStr ? `${volStr} Vol.` : "—"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {closeStr && (
            <span style={{ fontSize: 11, color: "#8E8E93" }}>{closeStr}</span>
          )}
          {market.url && (
            <a
              href={market.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: "#A0D9FF", textDecoration: "none" }}
            >
              Open ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
