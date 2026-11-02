// CoinMarketCap figures for the page, on the free Basic plan (key in the repo secret CMC_API_KEY).
// Two calls a reading (quotes for 10 coins + Fear & Greed) = about 3,000 of the 15,000 monthly credits.
// Saves only the few numbers the page shows, each with its CoinMarketCap link (no bulk data).
// Writes cmc.json. Without a key, or if CoinMarketCap fails, it leaves the last cmc.json as it is.
import fs from 'node:fs';
const K = process.env.CMC_API_KEY;
if (!K) { console.log('No CMC_API_KEY; skipped'); process.exit(0); }
const H = { 'X-CMC_PRO_API_KEY': K, Accept: 'application/json' };
const B = 'https://pro-api.coinmarketcap.com';
const IDS = { 1: 'BTC', 1027: 'ETH', 33793: 'USDG', 40938: 'PONS', 40809: 'CASHCAT', 29420: 'VIRTUAL', 40925: 'AI', 41990: 'MANCER', 40978: 'STONKBROKER', 18876: 'APE' };
const iso = d => new Date(d).toISOString().replace(/\.\d+Z$/, 'Z');
const r2 = (x, n = 2) => x == null ? null : +x.toFixed(n);
try {
  const q = await (await fetch(`${B}/v2/cryptocurrency/quotes/latest?id=${Object.keys(IDS).join(',')}`, { headers: H })).json();
  if (!q.data) throw new Error('quotes: ' + (q.status?.error_message || 'no data'));
  const quotes = {};
  for (const [id, v] of Object.entries(q.data)) {
    const c = Array.isArray(v) ? v[0] : v, u = c.quote.USD, sym = IDS[id];
    if (!sym || u.price == null) continue;
    quotes[sym] = { price: +u.price.toPrecision(6), ch24: r2(u.percent_change_24h), ch7: r2(u.percent_change_7d), ch30: r2(u.percent_change_30d),
      mcap: u.market_cap ? Math.round(u.market_cap) : null, asof_utc: iso(u.last_updated), url: `https://coinmarketcap.com/currencies/${c.slug}/` };
  }
  let fng = null;
  try { const f = await (await fetch(`${B}/v3/fear-and-greed/latest`, { headers: H })).json();
    if (f.data) fng = { value: f.data.value, label: f.data.value_classification, asof_utc: iso(f.data.update_time), url: 'https://coinmarketcap.com/charts/fear-and-greed-index/' };
  } catch (e) { console.log('fear & greed failed', e.message); }
  const prev = fs.existsSync('cmc.json') ? JSON.parse(fs.readFileSync('cmc.json', 'utf8')) : {};
  const out = { asof_utc: iso(Date.now()), source: 'CoinMarketCap', url: 'https://coinmarketcap.com/', quotes, fng: fng || prev.fng || null };
  fs.writeFileSync('cmc.json', JSON.stringify(out, null, 1));
  console.log('cmc.json:', Object.keys(quotes).join(' '), fng ? `F&G ${fng.value}` : '(F&G kept)', 'credits', q.status?.credit_count);
} catch (e) { console.log('CoinMarketCap step skipped:', e.message); }
