// Bell-day morning note: on the Friday of a bell, once between 8:30 and 10:00 AM ET, writes a short
// GitHub-issue body with the bell time, that morning's official jobs/CPI numbers (if BLS released them today)
// and what each room backs right now. The workflow posts it (mentioning vv) and closes it, so GitHub pings him.
// Facts from chain.json and econ.json only. Outputs note=1 and note_title when a note is due.
import fs from 'node:fs';
const C = JSON.parse(fs.readFileSync('chain.json', 'utf8'));
const E = fs.existsSync('econ.json') ? JSON.parse(fs.readFileSync('econ.json', 'utf8')) : {};
const now = new Date(), bell = new Date(C.closes_utc);
const et = (d, o) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...o }).format(d);
const day = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
const hm = +et(now, { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
const out = s => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, s + '\n'); };
if (day(now) !== day(bell) || hm < 830 || hm >= 1000 || now >= bell) { console.log('No bell-day note due'); process.exit(0); }
const title = `Week ${C.epoch} bell day`;
const P = v => (v * 100).toFixed(v >= 0.1 ? 1 : 2).replace(/\.0$/, '') + '%';
const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
const L = [`@vv23-CT Bell today: ${et(bell, { weekday: 'short', month: 'short', day: 'numeric' })} at ${et(bell, { hour: 'numeric', minute: '2-digit' })} ET.`, ''];
const today = day(now);
if (E.jobs?.release_date === today) L.push(`Jobs report (BLS, ${E.jobs.month || E.jobs.period}): ${sg(E.jobs.payrolls_change)}K jobs, unemployment ${E.jobs.unemployment_rate}%.`);
if (E.cpi?.release_date === today) L.push(`CPI (BLS, ${E.cpi.month || E.cpi.period}): ${sg(E.cpi.cpi_mm)}% m/m, ${E.cpi.cpi_yy}% y/y.`);
if (L.length > 2) L.push('');
L.push(`Rooms right now (on-chain, as of ${et(new Date(C.asof_utc), { hour: 'numeric', minute: '2-digit' })} ET):`);
for (const [id, f] of Object.entries(C.funds)) { const r = f.room || {}, b = Object.entries(r.room_tokens || {}).sort((a, c) => c[1] - a[1]);
  L.push(`- ${id.toUpperCase()}: ${b.length ? b.map(([t, v]) => t + ' ' + P(v)).join(', ') : 'nothing backed (all WETH)'} · ${f.voted} of ${f.enrolled} seats voted`); }
L.push('', 'Live page: https://vv23-ct.github.io/unofficial-tmf-fund-intel-dashboard/');
fs.writeFileSync('/tmp/bellday.txt', L.join('\n'));
console.log(L.join('\n'));
out('note=1'); out('note_title=' + title);
