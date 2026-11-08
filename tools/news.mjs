// Latest news per token -> news.json. Free sources only, headline + date + link (no article text).
// Runs inside the chain-reader workflow; fetches only when a new refresh slot (7am, 12pm, 5pm, 10pm ET) has begun.
// Everything fetched is untrusted data: it is parsed as text, matched, and stored; nothing in it is ever executed.
import fs from 'node:fs';
import crypto from 'node:crypto';

const OUT = process.argv[2] || 'news.json';
const UA = 'UnofficialTMFDashboard/1.0 (vv23.ct@gmail.com)';
const SLOTS_ET = [7, 12, 17, 22];
const KEEP = 3, HISTORY = 40;

// Companies: the SEC feed must also report the expected company name, or nothing is stored (identity check).
const CO = {
  COIN:  { cik: '0001679788', name: /coinbase/i },
  MSTR:  { cik: '0001050446', name: /strategy|microstrategy/i },
  META:  { cik: '0001326801', name: /meta platforms/i },
  GOOGL: { cik: '0001652044', name: /alphabet/i },
  NVDA:  { cik: '0001045810', name: /nvidia/i },
  TSLA:  { cik: '0001318605', name: /tesla/i },
  RDDT:  { cik: '0001713445', name: /reddit/i },
};
// Outlet stories count only when the headline names the project (exact phrase, never a bare ticker).
const NAMES = {
  COIN: [/\bCoinbase\b/], MSTR: [/\bMicroStrategy\b/, /\bMSTR\b/],
  VIRTUAL: [/\bVirtuals Protocol\b/], APE: [/\bApeCoin\b/, /\bApe Coin\b/],
  USDG: [/\bGlobal Dollar\b/, /\bUSDG\b/], AI: [/\bArtificial Inu\b/],
  CASHCAT: [/\bCash Cat\b/i, /\bCASHCAT\b/], MANCER: [/\bChain Mancers\b/i],
  STONKBROKER: [/\bStonkBrokers?\b/i],
};
const MACRO = ['SGOV', 'QQQ', 'GLD'];
const FEEDS = [
  { id: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', pub: 'CoinDesk', dom: 'coindesk.com', tier: 2 },
  { id: 'Decrypt', url: 'https://decrypt.co/feed', pub: 'Decrypt', dom: 'decrypt.co', tier: 2 },
  { id: 'The Block', url: 'https://www.theblock.co/rss.xml', pub: 'The Block', dom: 'theblock.co', tier: 2 },
  { id: 'Cointelegraph', url: 'https://cointelegraph.com/rss', pub: 'Cointelegraph', dom: 'cointelegraph.com', tier: 2 },
];
const ALLOW = new Set(['sec.gov', 'federalreserve.gov', ...FEEDS.map(f => f.dom)]);

const now = new Date();
const etParts = d => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).map(p => [p.type, p.value]));
// start of the latest slot that has begun, as a UTC instant
function latestSlot() {
  const p = etParts(now), h = +p.hour;
  const slot = [...SLOTS_ET].reverse().find(s => s <= h);
  let day = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  let sh = slot;
  if (slot == null) { day = new Date(day.getTime() - 864e5); sh = 22; }
  // find the UTC instant whose ET wall clock is day @ sh:00 (try both offsets)
  for (const off of [4, 5]) {
    const t = new Date(day.getTime() + (sh + off) * 36e5);
    const q = etParts(t);
    if (+q.hour === sh && +q.day === day.getUTCDate()) return t;
  }
  return new Date(day.getTime() + (sh + 5) * 36e5);
}

let prev = {};
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
const slot = latestSlot();
if (!process.env.NEWS_FORCE && prev.asof_utc && new Date(prev.asof_utc) >= slot) { console.log('News already refreshed for this slot'); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, '’').replace(/&amp;/g, '&');
const text = s => dec(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (b, t) => { const m = b.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1] : ''; };
const safeUrl = u => { try { const x = new URL(u); if (x.protocol !== 'https:') return null; const h = x.hostname.replace(/^www\./, ''); return [...ALLOW].some(a => h === a || h.endsWith('.' + a)) ? x.href : null; } catch { return null; } };
const iso = s => { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); };
const id = u => crypto.createHash('sha1').update(u.replace(/[?#].*$/, '')).digest('hex').slice(0, 12);
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

const sources = {}, found = {}; // found[token] = items
const add = (t, it) => { (found[t] ||= []).push(it); };

// 1. SEC EDGAR: current reports (8-K) and annual/quarterly reports, per company
for (const [t, c] of Object.entries(CO)) {
  const src = 'SEC EDGAR ' + t; let ok = true, n = 0;
  for (const ty of ['8-K', '10-']) {
    try {
      const x = await get(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=${encodeURIComponent(ty)}&count=5&output=atom`);
      const feedName = text(tag(x.split('<entry>')[0], 'title')) + ' ' + text(tag(x, 'conformed-name'));
      if (!c.name.test(feedName)) { ok = false; console.log(src, 'identity check failed:', feedName.slice(0, 80)); continue; }
      for (const e of x.split('<entry>').slice(1)) {
        const link = safeUrl((e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || ''); if (!link) continue;
        const form = text(tag(e, 'category').length ? (e.match(/term="([^"]+)"/) || [])[1] : '') || text(tag(e, 'title')).split(' ')[0];
        const sum = text(tag(e, 'summary'));
        const items = [...sum.matchAll(/Items? ?(\d+\.\d+): ?([^]*?)(?= Item \d+\.\d+:|$)/g)].map(m => 'Item ' + m[1] + ': ' + m[2].replace(/Filed:.*$/, '').trim()).filter(s => s.length > 8);
        const pub = iso(tag(e, 'updated')); if (!pub) continue;
        add(t, { id: id(link), headline: (form || ty) + ' · ' + (text(tag(e, 'title')).replace(/^[\w-]+\s*-\s*/, '') || 'filing') + (items.length ? ': ' + items.slice(0, 2).join('; ') : ''), url: link, publisher: 'SEC EDGAR', domain: 'sec.gov', published_utc: pub, tier: 1, kind: 'filing', verification: 'PRIMARY SOURCE CONFIRMED' });
        n++;
      }
    } catch (e) { ok = false; console.log(src, ty, e.message); }
    await sleep(350);
  }
  sources[src] = { ok, items: n, at: now.toISOString() };
}

// 2. Federal Reserve: monetary-policy releases, labelled as macro context for the rate- and market-sensitive funds
try {
  const x = await get('https://www.federalreserve.gov/feeds/press_all.xml'); let n = 0;
  for (const b of x.split(/<item[ >]/).slice(1)) {
    const head = text(tag(b, 'title')), link = safeUrl(text(tag(b, 'link'))), pub = iso(text(tag(b, 'pubDate')));
    if (!link || !pub || !/federal open market committee|fomc|monetary policy|federal funds rate|interest on reserve/i.test(head + ' ' + text(tag(b, 'description')))) continue;
    for (const t of MACRO) add(t, { id: id(link), headline: head, url: link, publisher: 'Federal Reserve', domain: 'federalreserve.gov', published_utc: pub, tier: 1, kind: 'macro', verification: 'PRIMARY SOURCE CONFIRMED' });
    n++;
  }
  sources['Federal Reserve'] = { ok: true, items: n, at: now.toISOString() };
} catch (e) { sources['Federal Reserve'] = { ok: false, error: e.message, at: now.toISOString() }; console.log('Fed', e.message); }

// 3. Crypto outlets, matched on the exact project name
for (const f of FEEDS) {
  try {
    const x = await get(f.url); let n = 0;
    for (const b of x.split(/<item[ >]/).slice(1)) {
      const head = text(tag(b, 'title')), blurb = text(tag(b, 'description')), link = safeUrl(text(tag(b, 'link'))), pub = iso(text(tag(b, 'pubDate')));
      if (!head || !link || !pub) continue;
      for (const [t, res] of Object.entries(NAMES)) {
        if (res.some(r => r.test(head))) { add(t, { id: id(link), headline: head, url: link, publisher: f.pub, domain: f.dom, published_utc: pub, tier: 2, kind: 'news', verification: 'SINGLE CREDIBLE SOURCE' }); n++; }
      }
    }
    sources[f.id] = { ok: true, items: n, at: now.toISOString() };
  } catch (e) { sources[f.id] = { ok: false, error: e.message, at: now.toISOString() }; console.log(f.id, e.message); }
  await sleep(300);
}

// Merge with what we already hold (a failed source keeps its earlier items), newest first
const tokens = {};
const names = new Set([...Object.keys(CO), ...Object.keys(NAMES), ...MACRO, ...Object.keys(prev.tokens || {})]);
for (const t of names) {
  const map = new Map();
  for (const it of [...((prev.tokens || {})[t]?.history || []), ...(found[t] || [])]) {
    const old = map.get(it.id);
    map.set(it.id, { ...(old || {}), ...it, retrieved_utc: old?.retrieved_utc || now.toISOString(), last_seen_utc: found[t]?.some(x => x.id === it.id) ? now.toISOString() : old?.last_seen_utc || it.retrieved_utc });
  }
  const history = [...map.values()].sort((a, b) => b.published_utc.localeCompare(a.published_utc)).slice(0, HISTORY);
  tokens[t] = { items: history.slice(0, KEEP), history };
}
const out = { asof_utc: now.toISOString(), slot_utc: slot.toISOString(), note: 'Headlines and links only; each item is dated by its publisher and links to the original. Outlet stories are matched on the exact project name in the headline, never a ticker alone.', sources, tokens };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('News written:', Object.entries(tokens).map(([t, v]) => t + ':' + v.items.length).join(' '));
for (const [k, v] of Object.entries(sources)) if (!v.ok) console.log('Source problem:', k, v.error || '');
