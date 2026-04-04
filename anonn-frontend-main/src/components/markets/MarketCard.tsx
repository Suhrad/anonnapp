import type { ExternalMarket } from "@/types";
import { getCategory } from "@/lib/marketUtils";

// ── CSS variable shortcuts (matching dashboard_server.ts exact values) ─────────
const C = {
  surface:    "rgba(24,24,27,0.6)",
  surface2:   "rgba(39,39,42,0.5)",
  border:     "rgba(63,63,70,0.4)",
  borderHov:  "rgba(124,58,237,0.5)",
  text:       "#f8fafc",
  muted:      "#a1a1aa",
  green:      "#16a34a",
  greenBg:    "#0a2e1a",
  greenText:  "#22c55e",
  red:        "#dc2626",
  redBg:      "#2e0a0a",
  redText:    "#f87171",
  accent:     "#9333ea",
  borderLight:"rgba(63,63,70,0.25)",
} as const;

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function compactUsd(v: number): string {
  if (!v || v <= 0) return "";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

interface MarketCardProps {
  market: ExternalMarket;
  onNavigate?: (id: string) => void;
  onQuote?: (market: ExternalMarket) => void;
  compact?: boolean;
}

export default function MarketCard({ market, onNavigate, onQuote, compact = false }: MarketCardProps) {
  const m   = market as any;
  const id  = m._id || m.id;

  // Probability
  const rawProb = market.probabilityYes;
  const yPct = rawProb != null ? Math.round(Number(rawProb) * (Number(rawProb) > 1 ? 1 : 100)) : null;
  const nPct = yPct != null ? 100 - yPct : null;

  // Category
  const category = getCategory(market.title || "", m.slug || "");

  // Metadata
  const icon      = m.icon || null;
  const volDisplay= compactUsd(m.volume24h ?? m.volumeNum ?? m.totalVolume ?? 0);
  const closeDate = fmtDate(m.closeTime ?? m.endDate ?? null);

  const handleCard = (e: React.MouseEvent) => {
    // Don't navigate if clicking buy buttons
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "BUTTON") return;
    if (market.url) {
      window.open(String(market.url), "_blank", "noopener");
    } else if (id) {
      onNavigate ? onNavigate(id) : undefined;
    }
  };

  const handleBuy = (e: React.MouseEvent, _side: "yes" | "no") => {
    e.stopPropagation();
    if (market.url) window.open(String(market.url), "_blank", "noopener");
  };

  // Clock SVG (matches SignalX clockSvg)
  const ClockIcon = () => (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ display: "inline", verticalAlign: "-1px" }}>
      <circle cx="6" cy="6" r="4.5"/>
      <path d="M6 3.5V6l1.5 1.5"/>
    </svg>
  );

  return (
    <div
      onClick={handleCard}
      style={{
        background: C.surface,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: compact ? "14px 14px 0" : "18px 18px 0",
        position: "relative",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: "0 4px 24px rgba(0,0,0,.4)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        minHeight: compact ? 200 : 260,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = C.borderHov;
        el.style.boxShadow = "0 8px 28px rgba(0,0,0,.25)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = C.border;
        el.style.boxShadow = "0 4px 24px rgba(0,0,0,.4)";
      }}
    >
      {/* ── Card header: icon (58×58) left | category + title right ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        {/* Icon */}
        <div style={{
          width: 58, height: 58, borderRadius: 12, overflow: "hidden",
          background: C.surface2, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}>
          {icon
            ? <img src={icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 24 }}>📊</span>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.muted,
            marginBottom: 5, textTransform: "capitalize",
          }}>
            {category}
          </div>
          <div style={{
            fontSize: compact ? 14 : 16, fontWeight: 800, lineHeight: 1.35,
            color: C.text,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {market.title}
          </div>
        </div>
      </div>

      {/* ── Probability row: YES% | dual bar | NO% ── */}
      {yPct != null && nPct != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.greenText, minWidth: 32 }}>
            {yPct}%
          </span>
          <div style={{
            flex: 1, height: 7, background: C.surface2,
            borderRadius: 4, overflow: "hidden", display: "flex",
          }}>
            <div style={{
              height: "100%", width: `${yPct}%`,
              background: C.green, borderRadius: "4px 0 0 4px",
              transition: "width .3s",
            }} />
            <div style={{
              height: "100%", width: `${nPct}%`,
              background: C.red, borderRadius: "0 4px 4px 0",
              transition: "width .3s",
            }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.redText, minWidth: 32, textAlign: "right" }}>
            {nPct}%
          </span>
        </div>
      )}

      {/* ── Buy buttons ── */}
      {!compact && yPct != null && nPct != null && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <button
            onClick={(e) => handleBuy(e, "yes")}
            style={{
              padding: "11px 8px", borderRadius: 10,
              fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: C.greenBg, color: C.greenText,
              transition: "filter .15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}
          >
            Buy Yes {yPct}¢
          </button>
          <button
            onClick={(e) => handleBuy(e, "no")}
            style={{
              padding: "11px 8px", borderRadius: 10,
              fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: C.redBg, color: C.redText,
              transition: "filter .15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}
          >
            Buy No {nPct}¢
          </button>
        </div>
      )}

      {/* ── Card footer ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 0 13px", marginTop: "auto",
        borderTop: `1px solid ${C.borderLight}`,
        gap: 8,
      }}>
        {/* Left: vol */}
        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, flexShrink: 0 }}>
          {volDisplay ? `${volDisplay} Vol.` : "—"}
        </span>

        {/* Center: Quote button */}
        {onQuote && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuote(market); }}
            title="Quote this market"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.muted,
              fontSize: 11, fontWeight: 600,
              cursor: "pointer",
              transition: "all .2s",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = C.accent;
              b.style.color = "#c084fc";
              b.style.background = "rgba(147,51,234,0.1)";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = C.border;
              b.style.color = C.muted;
              b.style.background = "transparent";
            }}
          >
            {/* Quote icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h15M12 5l7 7-7 7"/>
            </svg>
            Quote
          </button>
        )}

        {/* Right: link + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, flexShrink: 0 }}>
          <span>🔗</span>
          {closeDate && (
            <>
              <span style={{ width: 1, height: 12, background: C.border, display: "inline-block", margin: "0 2px" }} />
              <ClockIcon /> <span style={{ marginLeft: 3 }}>{closeDate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
