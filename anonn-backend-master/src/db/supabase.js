import { createClient } from '@supabase/supabase-js';

/** Lazy client — created on first use so dotenv.config() has already run */
let _client = undefined;

export function getSupabase() {
  if (_client !== undefined) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    _client = null;
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  console.log('[Supabase] Client initialized ✅');
  return _client;
}

/**
 * Read markets from market_snapshots, sorted by volume24h DESC.
 * Returns { markets: [], total: 0 } on any error so callers can fall back gracefully.
 */
export async function queryMarkets({ source = 'polymarket', search = '', limit = 100, offset = 0 } = {}) {
  const client = getSupabase();
  if (!client) return { markets: [], total: 0 };

  try {
    const nowIso = new Date().toISOString();

    let q = client
      .from('market_snapshots')
      .select('source, market_id, title, raw_json, volume24h')
      .eq('source', source)
      .gt('expires_at', nowIso)
      .order('volume24h', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.ilike('title', `%${search}%`);

    // Count query for real total (runs in parallel)
    let countQ = client
      .from('market_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)
      .gt('expires_at', nowIso);
    if (search) countQ = countQ.ilike('title', `%${search}%`);

    const [{ data, error }, { count }] = await Promise.all([q, countQ]);

    if (error) {
      console.error('[Supabase] queryMarkets error:', error.message);
      return { markets: [], total: 0 };
    }

    const markets = (data || []).map(parseSnapshot).filter(Boolean);
    return { markets, total: count ?? markets.length };
  } catch (err) {
    console.error('[Supabase] queryMarkets exception:', err.message);
    return { markets: [], total: 0 };
  }
}

/**
 * Get top N trending markets (pre-parsed for the right-panel API).
 */
export async function getTrending(limit = 20) {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('market_snapshots')
      .select('source, market_id, title, raw_json, volume24h')
      .eq('source', 'polymarket')
      .order('volume24h', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Supabase] getTrending error:', error.message);
      return [];
    }

    return (data || []).map((row) => {
      try {
        const m = JSON.parse(row.raw_json);
        return {
          id:             m.marketId   || row.market_id,
          title:          m.question   || row.title || '',
          slug:           m.slug       || '',
          icon:           m.icon       || null,
          probabilityYes: Array.isArray(m.outcomePrices) ? m.outcomePrices[0] : null,
          volume24h:      m.volume24h  || row.volume24h || 0,
          liquidity:      m.liquidity  || 0,
          endDate:        m.endDate    || null,
          url:            m.slug       ? `https://polymarket.com/event/${m.slug}` : null,
        };
      } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    console.error('[Supabase] getTrending exception:', err.message);
    return [];
  }
}

/**
 * Read events from market_snapshots (source = 'polymarket_events'), sorted by volume24h DESC.
 */
export async function queryEvents({ search = '', limit = 50, offset = 0 } = {}) {
  const client = getSupabase();
  if (!client) return { events: [], total: 0 };

  try {
    const nowIso = new Date().toISOString();

    let q = client
      .from('market_snapshots')
      .select('source, market_id, title, raw_json, volume24h')
      .eq('source', 'polymarket_events')
      .gt('expires_at', nowIso)
      .order('volume24h', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) q = q.ilike('title', `%${search}%`);

    let countQ = client
      .from('market_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'polymarket_events')
      .gt('expires_at', nowIso);
    if (search) countQ = countQ.ilike('title', `%${search}%`);

    const [{ data, error }, { count }] = await Promise.all([q, countQ]);

    if (error) {
      console.error('[Supabase] queryEvents error:', error.message);
      return { events: [], total: 0 };
    }

    const events = (data || []).map(parseEventSnapshot).filter(Boolean);
    return { events, total: count ?? events.length };
  } catch (err) {
    console.error('[Supabase] queryEvents exception:', err.message);
    return { events: [], total: 0 };
  }
}

/** Parse a polymarket_events row into a frontend-ready event object. */
function parseEventSnapshot(row) {
  try {
    const e = JSON.parse(row.raw_json);
    // Build top markets from outcomes + outcomePrices
    const outcomes = Array.isArray(e.outcomes) ? e.outcomes : [];
    const prices   = Array.isArray(e.outcomePrices) ? e.outcomePrices : [];
    const topMarkets = outcomes.slice(0, 5).map((label, i) => ({
      id:       `${e.marketId}_${i}`,
      question: String(label),
      yesPrice: prices[i] != null ? Number(prices[i]) : null,
      noPrice:  prices[i] != null ? Math.max(0, 1 - Number(prices[i])) : null,
      volume24h: 0,
    }));

    return {
      _id:         `event_${e.marketId || row.market_id}`,
      type:        'event',
      source:      'polymarket',
      externalId:  e.marketId || row.market_id,
      title:       e.question || row.title || '',
      slug:        e.slug     || '',
      url:         e.slug     ? `https://polymarket.com/event/${e.slug}` : null,
      icon:        e.icon     || null,
      volume24h:   e.volume24h    || row.volume24h || 0,
      totalVolume: e.volumeTotal  || 0,
      closeTime:   e.endDate      || null,
      marketCount: e.marketsCount || outcomes.length || 0,
      topMarkets,
      status:      'active',
      isActive:    true,
    };
  } catch { return null; }
}

/** Parse a market_snapshots row into the ExternalMarket shape the frontend expects. */
function parseSnapshot(row) {
  try {
    const m = JSON.parse(row.raw_json);
    return {
      _id:            m.marketId     || row.market_id,
      source:         row.source     || 'polymarket',
      externalId:     m.marketId     || row.market_id,
      slug:           m.slug         || '',
      title:          m.question     || row.title || '',
      url:            m.slug         ? `https://polymarket.com/event/${m.slug}` : null,
      probabilityYes: Array.isArray(m.outcomePrices) ? m.outcomePrices[0] : null,
      liquidity:      m.liquidity    || 0,
      volume24h:      m.volume24h    || row.volume24h || 0,
      totalVolume:    m.volumeTotal  || 0,
      closeTime:      m.endDate      || null,
      icon:           m.icon         || null,
      status:         'active',
      isActive:       true,
    };
  } catch {
    return null;
  }
}
