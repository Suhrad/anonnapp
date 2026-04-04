/**
 * scripts/syncMarkets.js
 *
 * Fetches ALL active Polymarket markets from the Gamma API and upserts them
 * into the Supabase `market_snapshots` table.
 *
 * Run manually:   npm run sync:markets
 * On a schedule:  add a cron job or call this from a setInterval in server.js
 *
 * Table schema required in Supabase (run once in SQL editor if not already created):
 *
 *   CREATE TABLE IF NOT EXISTS market_snapshots (
 *     source        TEXT NOT NULL,
 *     market_id     TEXT NOT NULL,
 *     title         TEXT NOT NULL,
 *     raw_json      TEXT NOT NULL,
 *     volume24h     DOUBLE PRECISION NOT NULL DEFAULT 0,
 *     volume_total  DOUBLE PRECISION NOT NULL DEFAULT 0,
 *     fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     expires_at    TIMESTAMPTZ NOT NULL,
 *     PRIMARY KEY (source, market_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_market_snapshots_source_expiry
 *     ON market_snapshots(source, expires_at);
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const GAMMA_API    = process.env.POLYMARKET_BASE_URL || 'https://gamma-api.polymarket.com';
const PAGE_SIZE    = 500;
const TIMEOUT_MS   = 15_000;
const EXPIRES_DAYS = 7;
const BATCH_SIZE   = 200;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Fetch one page from Gamma API ─────────────────────────────────────────────
async function fetchPage(offset) {
  const url = `${GAMMA_API}/markets?active=true&closed=false&limit=${PAGE_SIZE}&offset=${offset}&order=volume24hr&ascending=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`  ⚠️  HTTP ${res.status} for offset ${offset}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn(`  ⚠️  Page fetch failed (offset ${offset}): ${err.message}`);
    return null;
  }
}

// ── Parse a raw Gamma API market into a clean object ─────────────────────────
function parseMarket(m) {
  try {
    // Skip markets not accepting orders (inactive / delisted)
    if (!m.acceptingOrders) return null;
    if (!m.clobTokenIds || m.clobTokenIds === '[]') return null;

    const outcomePrices = JSON.parse(m.outcomePrices || '[]').map(Number);
    if (!outcomePrices.length || outcomePrices.every((p) => p === 0)) return null;

    // Build a rich title: include event/group context so searches for
    // "IPL", "Punjab Kings", "Champions League" etc. match correctly.
    const eventTitle = m.eventTitle || m.groupItemTitle || '';
    const question   = m.question   || m.title          || '';
    // Append event title only if it adds new info not already in the question
    const richTitle  = (eventTitle && !question.toLowerCase().includes(eventTitle.toLowerCase()))
      ? `${question} (${eventTitle})`
      : question;

    return {
      marketId:     m.id,
      question:     richTitle,
      slug:         m.slug || m.eventSlug || '',
      outcomes:     JSON.parse(m.outcomes || '[]'),
      outcomePrices,
      volume24h:    Number(m.volume24hr) || 0,
      volumeTotal:  Number(m.volume)     || 0,
      liquidity:    Number(m.liquidityNum ?? m.liquidity) || 0,
      endDate:      m.endDate     || null,
      icon:         m.icon        || null,
      eventTitle:   eventTitle    || null,
    };
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Polymarket → Supabase sync...');
  const startTime = Date.now();

  // ── Step 1: fetch all pages ────────────────────────────────────────────────
  const allMarkets = [];
  let offset = 0;
  let pageNum = 1;

  while (true) {
    process.stdout.write(`\r📡 Fetching page ${pageNum} (${allMarkets.length} so far)…`);
    const page = await fetchPage(offset);

    if (!page || page.length === 0) break;

    const parsed = page.map(parseMarket).filter(Boolean);
    allMarkets.push(...parsed);

    if (page.length < PAGE_SIZE) break;   // last page
    offset += PAGE_SIZE;
    pageNum++;
  }

  console.log(`\n✅ Raw fetch done: ${allMarkets.length} markets`);

  // ── Step 2: deduplicate ────────────────────────────────────────────────────
  const seen = new Set();
  const unique = allMarkets.filter((m) => {
    if (seen.has(m.marketId)) return false;
    seen.add(m.marketId);
    return true;
  });
  console.log(`✅ After dedup: ${unique.length} unique markets`);

  // ── Step 3: upsert to Supabase in batches ─────────────────────────────────
  const expiry   = new Date(Date.now() + EXPIRES_DAYS * 86_400_000).toISOString();
  const syncTime = new Date().toISOString(); // used to identify rows from THIS sync run
  const now      = syncTime;
  let synced     = 0;
  let errors     = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);

    const rows = batch.map((m) => ({
      source:       'polymarket',
      market_id:    m.marketId,
      title:        m.question,
      raw_json:     JSON.stringify(m),
      volume24h:    m.volume24h,
      volume_total: m.volumeTotal,
      fetched_at:   now,
      expires_at:   expiry,
    }));

    const { error } = await supabase
      .from('market_snapshots')
      .upsert(rows, { onConflict: 'source,market_id' });

    if (error) {
      console.error(`\n❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
      errors++;
    } else {
      synced += batch.length;
    }

    process.stdout.write(`\r⏳ Synced ${synced}/${unique.length} (${errors} errors)…`);
  }

  console.log(`\n`);

  // ── Step 4: clean up stale records ────────────────────────────────────────
  // Delete polymarket rows that were NOT updated in this sync (delisted/closed markets).
  // Done in small batches to avoid Supabase statement timeout.
  let totalCleaned = 0;
  let cleanErrors  = 0;
  while (true) {
    // Fetch a batch of stale market_ids first, then delete by primary key
    const { data: stale, error: fetchErr } = await supabase
      .from('market_snapshots')
      .select('market_id')
      .eq('source', 'polymarket')
      .lt('fetched_at', syncTime)
      .limit(500);

    if (fetchErr) { console.warn(`⚠️  Cleanup fetch error: ${fetchErr.message}`); cleanErrors++; break; }
    if (!stale || stale.length === 0) break;

    const ids = stale.map((r) => r.market_id);
    const { error: delErr } = await supabase
      .from('market_snapshots')
      .delete()
      .eq('source', 'polymarket')
      .in('market_id', ids);

    if (delErr) { console.warn(`⚠️  Cleanup delete error: ${delErr.message}`); cleanErrors++; break; }
    totalCleaned += ids.length;
  }

  if (cleanErrors === 0) {
    console.log(`🧹 Removed ${totalCleaned} stale/delisted markets.`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✨ Sync complete! ${synced} markets synced in ${elapsed}s. Errors: ${errors}`);

  if (errors > 0) {
    console.log('\n⚠️  Some batches had errors. If the table does not exist, run this SQL in');
    console.log('   your Supabase SQL editor (https://supabase.com/dashboard):');
    console.log(`
CREATE TABLE IF NOT EXISTS market_snapshots (
  source        TEXT NOT NULL,
  market_id     TEXT NOT NULL,
  title         TEXT NOT NULL,
  raw_json      TEXT NOT NULL,
  volume24h     DOUBLE PRECISION NOT NULL DEFAULT 0,
  volume_total  DOUBLE PRECISION NOT NULL DEFAULT 0,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (source, market_id)
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_source_expiry
  ON market_snapshots(source, expires_at);
`);
  }
}

// ── Events sync (into market_snapshots, source = 'polymarket_events') ────────
async function fetchEventsPage(offset) {
  const url = `${GAMMA_API}/events?active=true&closed=false&limit=${PAGE_SIZE}&offset=${offset}&order=volume24hr&ascending=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) { console.warn(`  ⚠️  Events HTTP ${res.status} offset ${offset}`); return null; }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn(`  ⚠️  Events page failed (offset ${offset}): ${err.message}`);
    return null;
  }
}

function parseEventRow(e) {
  try {
    if (!e.id || !e.title) return null;
    const markets = Array.isArray(e.markets) ? e.markets : [];
    const activeMarkets = markets.filter((m) => m.active !== false && !m.closed);
    if (activeMarkets.length === 0) return null;

    const volume24h   = Number(e.volume24hr ?? e.volume24h) || 0;
    const volumeTotal = Number(e.volume) || 0;

    // Top 5 child markets for display
    const topMarkets = activeMarkets.slice(0, 5).map((m) => {
      let outcomePrices = [];
      try { outcomePrices = (typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices || []).map(Number); } catch (_) {}
      return {
        id:        String(m.id),
        question:  m.question || m.groupItemTitle || '',
        yesPrice:  outcomePrices[0] ?? null,
        noPrice:   outcomePrices[1] ?? null,
        volume24h: Number(m.volume24hr ?? m.volumeNum) || 0,
      };
    });

    return {
      marketId:    `event-${e.id}`,
      question:    e.title,
      slug:        e.slug  || '',
      icon:        e.icon  || e.image || null,
      outcomes:    topMarkets.map((m) => m.question),
      outcomePrices: topMarkets.map((m) => m.yesPrice ?? 0),
      volume24h,
      volumeTotal,
      liquidity:   Number(e.liquidity ?? e.liquidityClob) || 0,
      endDate:     e.endDate || null,
      isEvent:     true,
      marketsCount: activeMarkets.length,
      topMarkets,
    };
  } catch { return null; }
}

async function syncEvents() {
  console.log('\n🔄 Syncing Polymarket events → market_snapshots...');
  const allEvents = [];
  let offset = 0, pageNum = 1;

  while (true) {
    process.stdout.write(`\r📡 Events page ${pageNum} (${allEvents.length} so far)…`);
    const page = await fetchEventsPage(offset);
    if (!page || page.length === 0) break;
    const parsed = page.map(parseEventRow).filter(Boolean);
    allEvents.push(...parsed);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    pageNum++;
  }

  console.log(`\n✅ Events fetched: ${allEvents.length}`);

  const seen = new Set();
  const unique = allEvents.filter((e) => {
    if (seen.has(e.marketId)) return false;
    seen.add(e.marketId);
    return true;
  });

  const expiry    = new Date(Date.now() + EXPIRES_DAYS * 86_400_000).toISOString();
  const syncTime2 = new Date().toISOString();
  let synced = 0, errors = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const rows = batch.map((e) => ({
      source:       'polymarket_events',
      market_id:    e.marketId,
      title:        e.question,
      raw_json:     JSON.stringify(e),
      volume24h:    e.volume24h,
      volume_total: e.volumeTotal,
      fetched_at:   syncTime2,
      expires_at:   expiry,
    }));

    const { error } = await supabase
      .from('market_snapshots')
      .upsert(rows, { onConflict: 'source,market_id' });

    if (error) {
      console.error(`\n❌ Events batch error: ${error.message}`);
      errors++;
    } else {
      synced += batch.length;
    }
    process.stdout.write(`\r⏳ Events synced ${synced}/${unique.length}…`);
  }
  console.log(`\n✅ Events sync done: ${synced} synced, ${errors} errors.`);

  // Clean up stale event rows in batches
  let cleaned = 0;
  while (true) {
    const { data: stale, error: fe } = await supabase
      .from('market_snapshots')
      .select('market_id')
      .eq('source', 'polymarket_events')
      .lt('fetched_at', syncTime2)
      .limit(500);
    if (fe || !stale || stale.length === 0) break;
    const ids = stale.map((r) => r.market_id);
    const { error: de } = await supabase
      .from('market_snapshots').delete().eq('source', 'polymarket_events').in('market_id', ids);
    if (de) break;
    cleaned += ids.length;
  }
  if (cleaned > 0) console.log(`🧹 Removed ${cleaned} stale events.`);
}

main().then(() => syncEvents()).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
