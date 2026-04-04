import { getCategory } from "@/lib/marketUtils";

const C = {
  surface:    "rgba(24,24,27,0.6)",
  surface2:   "rgba(39,39,42,0.5)",
  surface3:   "rgba(50,50,55,0.5)",
  border:     "rgba(63,63,70,0.4)",
  borderHov:  "rgba(124,58,237,0.5)",
  borderLight:"rgba(63,63,70,0.25)",
  text:       "#f8fafc",
  muted:      "#a1a1aa",
  green:      "#16a34a",
  greenBg:    "#0a2e1a",
  greenText:  "#22c55e",
  red:        "#dc2626",
  redBg:      "#2e0a0a",
  redText:    "#f87171",
  accent:     "#9333ea",
  accentBg:   "rgba(147,51,234,0.12)",
} as const;

function compactUsd(v: number): string {
  if (!v || v <= 0) return "";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ""; }
}

interface TopMarket {
  id: string;
  question: string;
  yesPrice: number | null;
  noPrice: number | null;
  volume24h: number;
}

interface PolymarketEvent {
  _id: string;
  type: "event";
  source: string;
  title: string;
  slug: string;
  url?: string | null;
  icon?: string | null;
  volume24h?: number | null;
  totalVolume?: number | null;
  closeTime?: string | null;
  marketCount?: number;
  topMarkets?: TopMarket[];
}

interface EventCardProps {
  event: PolymarketEvent;
  onQuote?: (event: PolymarketEvent) => void;
}

export default function EventCard({ event, onQuote }: EventCardProps) {
  const volDisplay = compactUsd(event.volume24h ?? 0);
  const closeDate  = fmtDate(event.closeTime);
  const category   = getCategory(event.title, event.slug);
  const markets    = event.topMarkets ?? [];

  const handleClick = () => {
    if (event.url) window.open(event.url, "_blank", "noopener");
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: C.surface,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 18px 0",
        position: "relative",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: "0 4px 24px rgba(0,0,0,.4)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.borderHov;
        e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,.4)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        {/* Icon */}
        <div style={{
          width: 58, height: 58, borderRadius: 12, overflow: "hidden",
          background: C.surface2, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}>
          {event.icon
            ? <img src={event.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 24 }}>🏆</span>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          {/* Category + Event badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "capitalize" }}>
              {category}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: C.accent,
              background: C.accentBg, padding: "2px 7px", borderRadius: 20,
              letterSpacing: "0.3px",
            }}>
              EVENT · {event.marketCount ?? markets.length} markets
            </span>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800, lineHeight: 1.35, color: C.text,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {event.title}
          </div>
        </div>
      </div>

      {/* Top markets list */}
      {markets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {markets.map((m, i) => {
            // Yes/No binary market
            const isYesNo = m.question.toLowerCase() !== m.question && (m.noPrice != null);
            const yPct = m.yesPrice != null ? Math.round(Number(m.yesPrice) * (Number(m.yesPrice) > 1 ? 1 : 100)) : null;
            const nPct = isYesNo && yPct != null ? 100 - yPct : null;
            // Percentage label for multi-outcome
            const pctLabel = yPct != null ? `${yPct}%` : null;
            return (
              <div key={m.id || i} style={{
                background: C.surface3,
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: C.text, flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {m.question}
                </span>
                {pctLabel && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.greenText }}>{pctLabel}</span>
                    {isYesNo && nPct != null && (
                      <>
                        <div style={{ width: 48, height: 5, background: C.surface2, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                          <div style={{ height: "100%", width: `${yPct}%`, background: C.green, borderRadius: "3px 0 0 3px" }} />
                          <div style={{ height: "100%", width: `${nPct}%`, background: C.red, borderRadius: "0 3px 3px 0" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.redText }}>{nPct}%</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 0 13px", marginTop: "auto",
        borderTop: `1px solid ${C.borderLight}`,
        gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>
          {volDisplay ? `${volDisplay} Vol.` : "—"}
        </span>

        {onQuote && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuote(event); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              border: `1px solid ${C.border}`,
              background: "transparent", color: C.muted,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              transition: "all .2s", fontFamily: "inherit", flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.color = "#c084fc";
              e.currentTarget.style.background = "rgba(147,51,234,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.muted;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h15M12 5l7 7-7 7"/>
            </svg>
            Quote
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
          <span>🔗</span>
          {closeDate && (
            <>
              <span style={{ width: 1, height: 12, background: C.border, display: "inline-block", margin: "0 2px" }} />
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ display: "inline", verticalAlign: "-1px" }}>
                <circle cx="6" cy="6" r="4.5"/><path d="M6 3.5V6l1.5 1.5"/>
              </svg>
              <span style={{ marginLeft: 3 }}>{closeDate}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
