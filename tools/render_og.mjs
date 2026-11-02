// Re-renders og.png (the share image) from data.json + chain.json, the same way the page combines them.
import fs from 'node:fs';
import { chromium } from 'playwright';
const d = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const c = fs.existsSync('chain.json') ? JSON.parse(fs.readFileSync('chain.json', 'utf8')) : null;
const newWeek = c && c.epoch > d.week; const week = newWeek ? c.epoch : d.week;
const funds = d.funds.map(f => { const r = c?.funds?.[f.id]?.room;
  if (r && r.tmf_held != null && (newWeek || (c.epoch === d.week && (!f.asof_utc || c.asof_utc > f.asof_utc)))) return { name: f.name, tmf_held: r.tmf_held, room_weth: r.room_weth, room_tokens: r.room_tokens };
  return { name: f.name, tmf_held: f.tmf_held, room_weth: f.room_weth, room_tokens: f.room_tokens }; });
const html = fs.readFileSync('tools/og-template.html', 'utf8').replace('__FUNDS__', JSON.stringify(funds)).replace('__WEEK__', 'Week ' + week);
fs.writeFileSync('/tmp/og.html', html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file:///tmp/og.html'); await p.waitForTimeout(300); await p.screenshot({ path: 'og.png' }); await b.close();
console.log('og.png rendered', JSON.stringify(funds.map(f => [f.name, Object.keys(f.room_tokens)])));
