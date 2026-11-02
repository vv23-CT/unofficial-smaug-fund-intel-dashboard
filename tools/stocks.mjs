// Daily closes for the stock tokens' underlying stocks/ETFs and the Nasdaq Composite. Writes stocks.json.
// Source for now: Nasdaq.com's quote data (free, no key; it's the data behind nasdaq.com, not a documented API).
// Plan: switch to a documented free API once vv adds its key as a repo secret.
// Asks only on weekdays from 4:30 PM to 10 PM ET until that day's close is in, plus once if stocks.json is empty.
import fs from 'node:fs';
const OUT = 'stocks.json';
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const now = new Date();
const etParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now).map(p => [p.type, p.value]));
const todayUS = `${etParts.month}/${etParts.day}/${etParts.year}`, mins = (+etParts.hour % 24) * 60 + +etParts.minute, weekday = !['Sat', 'Sun'].includes(etParts.weekday);
const due = !prev || (weekday && mins >= 16 * 60 + 30 && mins <= 22 * 60 && prev.last_date !== todayUS);
if (!due) { console.log('Stocks: nothing to fetch', todayUS, mins); process.exit(0); }
const T = { COIN: 'stocks', MSTR: 'stocks', META: 'stocks', GOOGL: 'stocks', QQQ: 'etf', NVDA: 'stocks', TSLA: 'stocks', RDDT: 'stocks', GLD: 'etf', SGOV: 'etf', COMP: 'index' };
const H = { 'user-agent': 'Mozilla/5.0 (tmf-fund-intel-dashboard; public data)', accept: 'application/json', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' };
const num = s => Number(String(s).replace(/[$,]/g, ''));
const from = new Date(now - 14 * 864e5).toISOString().slice(0, 10);
const closes = {};
for (const [t, cls] of Object.entries(T)) {
  try {
    const r = await fetch(`https://api.nasdaq.com/api/quote/${t}/historical?assetclass=${cls}&fromdate=${from}&limit=5`, { headers: H, signal: AbortSignal.timeout(15000) });
    const rows = (await r.json()).data.tradesTable.rows;
    const [a, b] = rows; if (!a || !b) continue;
    const close = num(a.close), prior = num(b.close);
    closes[t] = { date: a.date, close, prev_close: prior, change: +(close / prior - 1).toFixed(4),
      url: `https://www.nasdaq.com/market-activity/${cls === 'etf' ? 'etf' : cls === 'index' ? 'index' : 'stocks'}/${t.toLowerCase()}/historical` };
  } catch (e) { console.log('Stocks:', t, String(e).slice(0, 80)); }
  await new Promise(r => setTimeout(r, 300));
}
if (Object.keys(closes).length < 8) { console.log('Stocks: too few closes, keeping the last file', Object.keys(closes)); process.exit(0); }
const dates = Object.values(closes).map(c => c.date);
const last_date = dates.sort((x, y) => new Date(y) - new Date(x))[0];
const out = { asof_utc: now.toISOString().replace(/\.\d+Z$/, 'Z'), source: 'Nasdaq.com', last_date, closes };
if (prev && JSON.stringify(prev.closes) === JSON.stringify(out.closes)) { console.log('Stocks: no new close yet'); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('stocks.json updated', last_date, JSON.stringify(Object.fromEntries(Object.entries(closes).map(([k, v]) => [k, v.close]))));
