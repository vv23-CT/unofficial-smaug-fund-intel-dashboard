// Keeps the week number in the share-link titles (og:title, twitter:title) in step with the chain's week.
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('chain.json', 'utf8'));
const d = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const week = Math.max(c.epoch || 0, d.week || 0);
if (!week) process.exit(0);
const h = fs.readFileSync('index.html', 'utf8');
const out = h.replace(/(<meta (?:property="og:title"|name="twitter:title") content="[^"]*?· Week )\d+(")/g, `$1${week}$2`);
if (out !== h) { fs.writeFileSync('index.html', out); console.log('Share titles now say Week', week); } else console.log('Share titles already say Week', week);
