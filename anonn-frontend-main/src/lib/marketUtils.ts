// ── SignalX-exact category detection (matches dashboard_server.ts marketCategoryOf) ──
export function getCategory(title: string, slug = ""): string {
  const q    = title.toLowerCase();
  const full = q + " " + slug.toLowerCase();

  // Crypto
  if (/\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain|defi|nft|token|altcoin|binance|coinbase|xrp|doge|dogecoin|matic|polygon|avax|avalanche|chainlink|uniswap|web3|dao|stablecoin|memecoin|pepe coin|shib|sui\b|aptos|arbitrum)\b/.test(full))
    return "Crypto";

  // Sports
  if (/\b(nfl|nba|mlb|nhl|fifa|nascar|ufc|mma|tennis|golf|soccer|football|basketball|baseball|hockey|olympic|wimbledon|super bowl|world cup|champion|league|tournament|playoff|draft|grand prix|formula 1|premier league|bundesliga|stanley cup|masters|pga)\b/.test(full))
    return "Sports";

  // Pop Culture
  if (/\b(oscar|emmy|grammy|netflix|disney|marvel|movie|film|celebrity|kardashian|taylor swift|beyonce|music|award|entertainment|box office|streaming|reality tv|actor|actress|album|song|billboard|oscars|golden globe)\b/.test(full))
    return "Pop Culture";

  // Science / Tech
  if (/\b(nasa|spacex|artificial intelligence|openai|chatgpt|gpt-4|gpt-5|climate|rocket|starship|satellite|fda|drug|vaccine|covid|disease|research|microsoft|apple inc|google|amazon|meta\b|tesla|semiconductor|quantum|nuclear fusion|cern)\b/.test(full))
    return "Science";

  // Business
  if (/\b(fed\b|federal reserve|interest rate|rate hike|rate cut|gdp|inflation|stock market|market cap|ipo|merger|earnings|recession|unemployment|economy|economic|financial|dollar index|yuan|euro|s&p 500|nasdaq|dow jones|tariff|trade war|oil price|gas price|commodities|treasury|bond yield)\b/.test(full))
    return "Business";

  // Politics
  if (/\b(trump|biden|harris|election|president|congress|senate|democrat|republican|gop|vote|ballot|primary|primaries|midterm|inauguration|white house|supreme court|legislation|governor|mayor|liberal|conservative|referendum|parliament|prime minister|campaign|netanyahu|zelensky|macron|modi|xi jinping|putin)\b/.test(full))
    return "Politics";

  // World Events
  if (/\b(war|ukraine|russia|china|israel|iran|nato|united nations|conflict|peace|treaty|sanction|nuclear|taiwan|north korea|middle east|military|attack|troops|ceasefire|coup|revolution|invasion|airstrike)\b/.test(full))
    return "World Events";

  return "Other";
}

export function fmtMoney(n: number | undefined | null): string {
  if (!n || !Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
