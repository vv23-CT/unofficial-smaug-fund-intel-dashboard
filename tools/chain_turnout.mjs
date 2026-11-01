// Reads per-fund turnout from public Robinhood Chain contracts and writes chain.json.
// Read-only. Counts only: no wallets, owners or balances.
import fs from 'node:fs';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const OFFICE = '0xf658b4abdafc6c8d652742d563e9d9ab8b454475'; // DividendOffice
const BALLOT = '0xa1de85247d30eb67c83d010f9240ae81a8d744fe'; // Ballot
const SEL = { enrolledCount: '0x1832e32f', totalWeight: '0x72e78e1c', chairsVoted: '0x9ab24d0d', currentEpoch: '0x76671808', closesAt: '0x28c13a1c' };
const FUNDS = ['argon', 'bogle', 'smaug', 'midas', 'vladd']; // contract fund index 0..4
const OUT = process.argv[2] || 'chain.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 1;
async function rpc(method, params) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) });
      if (r.ok) { const j = await r.json(); if (j.result !== undefined) return j.result; throw new Error(JSON.stringify(j.error)); }
    } catch (e) { if (i === 4) throw e; }
    await sleep(2000 * (i + 1));
  }
  throw new Error('RPC unavailable');
}
const pad = n => BigInt(n).toString(16).padStart(64, '0');
const num = async (to, sel, ...a) => { const h = await rpc('eth_call', [{ to, data: sel + a.map(pad).join('') }, 'latest']); if (!h || h === '0x') throw new Error('empty result ' + sel); return Number(BigInt(h.slice(0, 66))); };

const block = parseInt(await rpc('eth_blockNumber', []), 16);
const epoch = await num(BALLOT, SEL.currentEpoch);
let closes = null; try { const c = await num(BALLOT, SEL.closesAt, epoch); if (c > 1.7e9) closes = new Date(c * 1000).toISOString(); } catch {}
const funds = {};
for (const [i, f] of FUNDS.entries()) {
  funds[f] = { enrolled: await num(OFFICE, SEL.enrolledCount, i), voted: await num(BALLOT, SEL.chairsVoted, i, epoch), enrolled_weight: await num(OFFICE, SEL.totalWeight, i) };
}
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const same = prev && prev.epoch === epoch && JSON.stringify(prev.funds) === JSON.stringify(funds);
const out = {
  asof_utc: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), block, epoch, closes_utc: closes,
  source: 'Robinhood Chain (public RPC): Ballot chairsVoted(fund, week); DividendOffice enrolledCount(fund)',
  url: 'https://robinhoodchain.blockscout.com/address/' + BALLOT, ballot: BALLOT, dividend_office: OFFICE, funds,
};
// Only rewrite when a count changes, so the site isn't rebuilt every 30 minutes for nothing.
if (same) { console.log('No change since', prev.asof_utc); process.exit(0); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.funds));
