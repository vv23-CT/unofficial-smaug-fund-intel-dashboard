// Official US jobs and CPI numbers from the Bureau of Labor Statistics' public data feed (free, no key).
// Writes econ.json. To stay far inside the keyless limit (about 25 requests a day) it only asks BLS
// on a release day between 8:29 and 11:30 AM ET, until that month's numbers appear, or when econ.json
// has nothing yet. The release calendar comes from BLS's own schedule pages, refreshed weekly.
import fs from 'node:fs';
const OUT = 'econ.json';
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const now = new Date();
const etDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
const etHM = d => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':'); return +p[0] * 60 + +p[1]; };
const UA = { 'user-agent': 'Mozilla/5.0 (tmf-fund-intel-dashboard; public data)' };
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
const out = { ...prev, source: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/' };
let changed = false;

// 1. release calendar (weekly)
if (!prev.schedule || !prev.schedule_utc || now - new Date(prev.schedule_utc) > 7 * 864e5) {
  const sched = {};
  for (const [k, page] of [['jobs', 'empsit'], ['cpi', 'cpi']]) {
    try { const t = await (await fetch(`https://www.bls.gov/schedule/news_release/${page}.htm`, { headers: UA })).text();
      const days = [...t.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.? (\d{1,2}), (20\d\d)\b/g)].map(m => `${m[3]}-${String(MON[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}`);
      if (days.length) sched[k] = [...new Set(days)].sort(); } catch {}
  }
  if (Object.keys(sched).length) { out.schedule = { ...(prev.schedule || {}), ...sched }; out.schedule_utc = now.toISOString().replace(/\.\d+Z$/, 'Z'); changed = true; }
}
const today = etDate(now), mins = etHM(now);
const releaseDay = k => (out.schedule?.[k] || []).includes(today);
const lastRelease = k => (out.schedule?.[k] || []).filter(d => d <= today).pop() || null;
const want = k => !out[k] || (releaseDay(k) && mins >= 8 * 60 + 29 && mins <= 11 * 60 + 30 && out[k].release_date !== today);

// 2. the numbers
if (want('jobs') || want('cpi')) {
  const S = { pay: 'CES0000000001', ur: 'LNS14000000', ahe: 'CES0500000003', cpi: 'CUSR0000SA0', cpiN: 'CUUR0000SA0', core: 'CUSR0000SA0L1E', coreN: 'CUUR0000SA0L1E' };
  const y = now.getUTCFullYear();
  const r = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', { method: 'POST', headers: { ...UA, 'content-type': 'application/json' }, body: JSON.stringify({ seriesid: Object.values(S), startyear: String(y - 1), endyear: String(y) }) });
  const j = await r.json();
  if (j.status !== 'REQUEST_SUCCEEDED') { console.log('BLS:', j.status, j.message); }
  else {
    const ser = {}; for (const s of j.Results.series) ser[Object.keys(S).find(k => S[k] === s.seriesID)] = Object.fromEntries((s.data || []).filter(x => /^M\d\d$/.test(x.period)).map(x => [x.year + '-' + x.period, { v: Number(x.value), pre: (x.footnotes || []).some(f => /prelim/i.test(f.text || '')) }]));
    const latest = k => Object.keys(ser[k] || {}).sort().pop();
    const back = (p, n) => { let [yy, mm] = [Number(p.slice(0, 4)), Number(p.slice(6))]; mm -= n; while (mm < 1) { mm += 12; yy--; } return `${yy}-M${String(mm).padStart(2, '0')}`; };
    const label = p => new Date(Date.UTC(+p.slice(0, 4), +p.slice(6) - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const r1 = x => Math.round(x * 10) / 10; // BLS publishes one decimal
    const v = (k, p) => ser[k]?.[p]?.v;
    const fetched = now.toISOString().replace(/\.\d+Z$/, 'Z');
    const pj = latest('pay');
    if (pj && v('pay', back(pj, 1)) != null) {
      const jobs = { period: pj, month: label(pj), payrolls_change: Math.round((v('pay', pj) - v('pay', back(pj, 1))) * 1000), unemployment_rate: v('ur', pj),
        hourly_earnings_mm: v('ahe', back(pj, 1)) ? r1((v('ahe', pj) / v('ahe', back(pj, 1)) - 1) * 100) : null, hourly_earnings_yy: v('ahe', back(pj, 12)) ? r1((v('ahe', pj) / v('ahe', back(pj, 12)) - 1) * 100) : null,
        preliminary: !!ser.pay[pj].pre, release_date: lastRelease('jobs'), fetched_utc: fetched, url: 'https://www.bls.gov/news.release/empsit.nr0.htm' };
      if (!out.jobs || out.jobs.period !== jobs.period || out.jobs.payrolls_change !== jobs.payrolls_change) { out.jobs = jobs; changed = true; }
    }
    const pc = latest('cpi');
    if (pc && v('cpi', back(pc, 1)) != null) {
      const cpi = { period: pc, month: label(pc), cpi_mm: r1((v('cpi', pc) / v('cpi', back(pc, 1)) - 1) * 100), cpi_yy: v('cpiN', back(pc, 12)) ? r1((v('cpiN', pc) / v('cpiN', back(pc, 12)) - 1) * 100) : null,
        core_mm: v('core', back(pc, 1)) ? r1((v('core', pc) / v('core', back(pc, 1)) - 1) * 100) : null, core_yy: v('coreN', back(pc, 12)) ? r1((v('coreN', pc) / v('coreN', back(pc, 12)) - 1) * 100) : null,
        release_date: lastRelease('cpi'), fetched_utc: fetched, url: 'https://www.bls.gov/news.release/cpi.nr0.htm' };
      if (!out.cpi || out.cpi.period !== cpi.period) { out.cpi = cpi; changed = true; }
    }
    out.asof_utc = fetched;
  }
}
if (changed) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); console.log('econ.json updated', JSON.stringify({ jobs: out.jobs, cpi: out.cpi })); }
else console.log('BLS: nothing new to fetch', today, mins);
