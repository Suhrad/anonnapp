import { useEffect, useMemo, useRef, useState } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ExternalMarket } from "@/types";
import MarketCard from "@/components/markets/MarketCard";
import EventCard from "@/components/markets/EventCard";
import { getCategory } from "@/lib/marketUtils";
import CreatePostModal from "@/pages/CreatePost/create-post";

// ── Types ──────────────────────────────────────────────────────────────────────
type MarketSearchResponse = {
  posts?: ExternalMarket[];
  pagination?: { totalItems?: number };
};

type EventSearchResponse = {
  posts?: any[];
  pagination?: { totalItems?: number };
};

type Category =
  | "All" | "Politics" | "Crypto" | "Sports" | "Pop Culture"
  | "Science" | "Business" | "World Events" | "Other";

type SortKey = "volume" | "liquidity" | "probability" | "endDate";

const PAGE_LIMIT = 100;

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  "All", "Politics", "Crypto", "Sports", "Pop Culture",
  "Science", "Business", "World Events", "Other",
];

// SVG icons matching SignalX MK_CAT_ICONS
const CAT_ICON: Record<Category, React.ReactNode> = {
  All:           <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="4" height="4" rx=".8"/><rect x="7" y="1" width="4" height="4" rx=".8"/><rect x="1" y="7" width="4" height="4" rx=".8"/><rect x="7" y="7" width="4" height="4" rx=".8"/></svg>,
  Politics:      <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 10V5l4-3 4 3v5" strokeLinecap="round" strokeLinejoin="round"/><rect x="4.5" y="7" width="3" height="3"/></svg>,
  Crypto:        <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.5"/><path d="M4.5 4c.5-.3 1-.5 1.7-.5 1.2 0 2 .7 2 1.5 0 .7-.5 1.2-1.2 1.5.8.2 1.4.8 1.4 1.6 0 1-.9 1.7-2.2 1.7-.7 0-1.3-.2-1.7-.5M6 3v1M6 8v1" strokeLinecap="round"/></svg>,
  Sports:        <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 5.5L5 2l2 2.5-1 2.5H3.5L1.5 5.5z"/><path d="M7 4.5l3-1.5M4.5 7l1 3.5M6 6l2 2" strokeLinecap="round"/></svg>,
  "Pop Culture": <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="2.5" width="10" height="7" rx="1"/><path d="M4.5 2.5V2M7.5 2.5V2M4.5 5l1.5 1 1.5-1" strokeLinecap="round"/></svg>,
  Science:       <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 1v4.5L1.5 9.5c-.3.5 0 1.5 1 1.5h7c1 0 1.3-1 1-1.5L8 5.5V1" strokeLinecap="round" strokeLinejoin="round"/><line x1="3.5" y1="3" x2="8.5" y2="3" strokeLinecap="round"/></svg>,
  Business:      <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="4" width="10" height="7" rx="1"/><path d="M4 4V3c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v1M6 7v1.5" strokeLinecap="round"/></svg>,
  "World Events":<svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="6" r="4.5"/><path d="M1.5 6h9M6 1.5C4.5 3 3.5 4.3 3.5 6c0 1.7 1 3 2.5 4.5M6 1.5C7.5 3 8.5 4.3 8.5 6c0 1.7-1 3-2.5 4.5" strokeLinecap="round"/></svg>,
  Other:         <svg style={{ width:12,height:12,marginRight:5,verticalAlign:-2,opacity:.8,flexShrink:0 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="2.5" cy="6" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="9.5" cy="6" r="1"/></svg>,
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const sh: React.CSSProperties = {
    background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)",
    backgroundSize: "200% 100%",
    animation: "sx-shimmer 2s infinite",
    borderRadius: 6,
  };
  return (
    <div style={{
      background: "rgba(24,24,27,0.6)",
      border: "1px solid rgba(63,63,70,0.4)",
      borderRadius: 14, padding: "18px 18px 14px",
      display: "flex", flexDirection: "column", gap: 12,
      minHeight: 220,
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ ...sh, width: 58, height: 58, borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
          <div style={{ ...sh, height: 11, width: 70 }} />
          <div style={{ ...sh, height: 16, width: "90%" }} />
          <div style={{ ...sh, height: 16, width: "65%" }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...sh, width: 32, height: 13 }} />
        <div style={{ ...sh, flex: 1, height: 7, borderRadius: 4 }} />
        <div style={{ ...sh, width: 32, height: 13 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ ...sh, height: 38, borderRadius: 10 }} />
        <div style={{ ...sh, height: 38, borderRadius: 10 }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const [searchInput,    setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setCategory]   = useState<Category>("All");
  const sortKey: SortKey = "volume";
  const [minVol,         setMinVol]      = useState(0);
  const [quoteTarget,    setQuoteTarget] = useState<ExternalMarket | null>(null);

  // Pagination state (markets)
  const [page,        setPage]        = useState(1);
  const [allMarkets,  setAllMarkets]  = useState<ExternalMarket[]>([]);
  const [totalCount,  setTotalCount]  = useState(0);
  // Events (single page, top 50 by volume)
  const [allEvents,   setAllEvents]   = useState<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // CSS vars
  const surface  = "rgba(24,24,27,0.6)";
  const surface2 = "rgba(39,39,42,0.5)";
  const border   = "rgba(63,63,70,0.4)";
  const muted    = "#a1a1aa";
  const text     = "#f8fafc";
  const accent   = "#9333ea";

  // Debounce search input 400 ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset pagination whenever search query changes
  useEffect(() => {
    setPage(1);
    setAllMarkets([]);
    setTotalCount(0);
    setAllEvents([]);
  }, [debouncedQuery]);

  const { data, isLoading, isFetching, refetch } = useApiQuery<MarketSearchResponse>({
    endpoint: "markets/search",
    queryKey: ["/api/markets/search", debouncedQuery, page],
    params: {
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
      status: "active",
      page,
      limit: PAGE_LIMIT,
    },
    retry: false,
    select: (raw: any) => ({ posts: raw?.posts || [], pagination: raw?.pagination || {} }),
  });

  const { data: eventsData } = useApiQuery<EventSearchResponse>({
    endpoint: "markets/events/search",
    queryKey: ["/api/markets/events/search", debouncedQuery],
    params: {
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
      limit: 50,
    },
    retry: false,
    select: (raw: any) => ({ posts: raw?.posts || [], pagination: raw?.pagination || {} }),
  });

  // Accumulate markets across pages
  useEffect(() => {
    if (!data) return;
    const incoming = data.posts ?? [];
    const newTotal = data.pagination?.totalItems ?? 0;
    setTotalCount(newTotal);
    if (page === 1) {
      setAllMarkets(incoming);
    } else {
      setAllMarkets(prev => {
        const ids = new Set(prev.map((m: any) => m._id || m.id));
        return [...prev, ...incoming.filter((m: any) => !ids.has(m._id || m.id))];
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load events (reset on query change)
  useEffect(() => {
    if (!eventsData) return;
    setAllEvents(eventsData.posts ?? []);
  }, [eventsData]);

  const hasMore = allMarkets.length < totalCount && totalCount > 0;

  // Infinite scroll — trigger next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetching && hasMore) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFetching, hasMore]);

  const filtered = useMemo(() => {
    // Merge events + markets into one unified list
    let events: any[] = allEvents;
    let markets: ExternalMarket[] = allMarkets;

    if (activeCategory !== "All") {
      events  = events.filter((e) => getCategory(e.title || "", e.slug || "") === activeCategory);
      markets = markets.filter((m) => getCategory(m.title || "", (m as any).slug || "") === activeCategory);
    }

    if (minVol > 0) {
      events  = events.filter((e) => (e.volume24h ?? 0) >= minVol);
      markets = markets.filter((m) => ((m as any).volume24h ?? 0) >= minVol);
    }

    // Combine and sort everything by volume24h descending
    const combined: any[] = [...events, ...markets];
    return combined.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  }, [allMarkets, allEvents, activeCategory, sortKey, minVol]);

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: text,
    }}>

      {/* ── Section title ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>
            Markets Explorer
          </h2>
          {/* Live dot + refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" }}>Live</span>
            </div>
            <button
              onClick={() => { setPage(1); setAllMarkets([]); setTimeout(() => refetch(), 0); }}
              title="Refresh"
              style={{
                width: 28, height: 28, borderRadius: 8,
                border: `1px solid ${border}`,
                background: surface, color: muted,
                cursor: "pointer", display: "grid", placeItems: "center",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget;
                b.style.borderColor = accent;
                b.style.color = text;
                b.style.background = "rgba(147,51,234,0.15)";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget;
                b.style.borderColor = border;
                b.style.color = muted;
                b.style.background = surface;
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, marginBottom: 20, flexWrap: "nowrap" as const,
      }}>
        {/* Left: category pills */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          overflowX: "auto" as const, scrollbarWidth: "none" as const,
          minWidth: 0, flexShrink: 1,
        }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                background: activeCategory === cat ? accent : "transparent",
                border: "none",
                color: activeCategory === cat ? "#fff" : muted,
                padding: "7px 14px",
                borderRadius: 20,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                transition: "all .2s",
                whiteSpace: "nowrap" as const,
                display: "flex", alignItems: "center",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== cat) {
                  (e.currentTarget as HTMLButtonElement).style.color = text;
                  (e.currentTarget as HTMLButtonElement).style.background = surface2;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== cat) {
                  (e.currentTarget as HTMLButtonElement).style.color = muted;
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              {CAT_ICON[cat]}{cat}
            </button>
          ))}
        </div>

        {/* Right: search + volume filter */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search markets..."
              style={{
                width: 170, padding: "8px 12px 8px 36px",
                background: surface, border: `1px solid ${border}`,
                borderRadius: 10, color: text, fontSize: 13, outline: "none",
                fontFamily: "inherit", transition: "border-color .2s",
                boxSizing: "border-box" as const,
              }}
              onFocus={(e)  => (e.target.style.borderColor = accent)}
              onBlur={(e)   => (e.target.style.borderColor = border)}
            />
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <select
            value={minVol}
            onChange={(e) => setMinVol(Number(e.target.value))}
            style={{
              background: surface, border: `1px solid ${border}`,
              borderRadius: 10, padding: "8px 12px",
              fontSize: 13, color: text, outline: "none",
              fontFamily: "inherit", cursor: "pointer",
              transition: "border-color .2s",
            }}
            onFocus={(e)  => (e.target.style.borderColor = accent)}
            onBlur={(e)   => (e.target.style.borderColor = border)}
          >
            <option value={0}>All Volume</option>
            <option value={100000}>&gt; $100K</option>
            <option value={500000}>&gt; $500K</option>
            <option value={1000000}>&gt; $1M</option>
            <option value={5000000}>&gt; $5M</option>
          </select>
        </div>
      </div>

      {/* ── Market grid ── */}
      {isLoading && page === 1 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          background: "linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%)",
          border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 20,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px",
            background: "rgba(147,51,234,0.1)", border: "1px solid rgba(147,51,234,0.2)",
            display: "grid", placeItems: "center", fontSize: 28,
          }}>✨</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {debouncedQuery ? `No results for "${debouncedQuery}"` : "Nothing here yet"}
          </div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
            {debouncedQuery ? "Try a different search term." : "Try a different category or check back soon."}
          </div>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}>
            {filtered.map((item: any, i) => (
              <div key={item._id || item.id} style={{ animationDelay: `${i * 20}ms` }}>
                {item.type === "event" ? (
                  <EventCard
                    event={item}
                    onQuote={(e) => setQuoteTarget({ ...e, probabilityYes: null, source: e.source } as any)}
                  />
                ) : (
                  <MarketCard
                    market={item}
                    onNavigate={(_id) => {
                      if (item.url) window.open(String(item.url), "_blank", "noopener");
                    }}
                    onQuote={(m) => setQuoteTarget(m)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Loading more skeletons */}
          {isFetching && page > 1 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14, marginTop: 14,
            }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {/* End of results */}
          {!hasMore && filtered.length > 0 && !isFetching && (
            <div style={{
              textAlign: "center", padding: "24px 0",
              color: muted, fontSize: 12,
            }}>
              Showing {allEvents.length > 0 ? `${allEvents.length} events + ` : ""}{allMarkets.length} markets
            </div>
          )}
        </>
      )}

      {/* ── Quote Market → Create Post/Poll modal ── */}
      <CreatePostModal
        isOpen={quoteTarget !== null}
        onClose={() => setQuoteTarget(null)}
        initialMarket={quoteTarget ? {
          _id: (quoteTarget as any)._id,
          id: (quoteTarget as any).id,
          title: quoteTarget.title,
          source: quoteTarget.source || "polymarket",
          url: quoteTarget.url ?? undefined,
          probabilityYes: quoteTarget.probabilityYes ?? undefined,
          liquidity: quoteTarget.liquidity ?? undefined,
          volume24h: (quoteTarget as any).volume24h ?? undefined,
          status: quoteTarget.status,
          closeTime: quoteTarget.closeTime ? String(quoteTarget.closeTime) : undefined,
          icon: (quoteTarget as any).icon ?? undefined,
        } : undefined}
      />
    </div>
  );
}
