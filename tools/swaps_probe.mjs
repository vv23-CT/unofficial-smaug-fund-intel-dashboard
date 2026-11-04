// Chain reader: per-fund turnout AND each room, rebuilt from public Robinhood Chain data. Writes chain.json.
// Read-only. Saves fund totals only: never seat numbers, wallets or anyone's card.
//
// How the room is rebuilt (matched against vv's ballot captures, Oct 31 - Nov 1, 2026):
//  - chairs: Seats with a card this week (equals Ballot.chairsVoted)
//  - a token is BACKED when chairs holding more than half the voting weight put something on it;
//    VETOED (headed to WETH) when some chairs did but not a majority; NO CARDS when nobody did
//  - a backed token's share of the fund = chair-weighted average of every card's slot (zeros included)
//  - $TMF held = (fund value in WETH - fund's WETH) / fund value; WETH = whatever is left
import fs from 'node:fs';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const OFFICE = '0xf658b4abdafc6c8d652742d563e9d9ab8b454475'; // DividendOffice
const BALLOT = '0xa1de85247d30eb67c83d010f9240ae81a8d744fe'; // Ballot
const DESK = '0xca50244f9135ed70add8d3cbd50ef6f6a76ba654';   // fund desk (books and fund value)
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const SEL = { enrolledCount: '1832e32f', totalWeight: '72e78e1c', chairsVoted: '9ab24d0d', currentEpoch: '76671808', closesAt: '28c13a1c',
  returnCard: '78d8e9b8', votingWeight: null, bookOf: null, navInWeth: null, registry: null, registryCount: null };
const CARD_EVENT = '0xee92f1ed31e93694564a3ba46a65231c2672ac569af59811ad35111ce5fb39b9'; // CardReturned(uint8,uint256,uint256,uint256)
const FUNDS = ['argon', 'bogle', 'smaug', 'midas', 'vladd']; // contract fund index 0..4
const OUT = process.argv[2] || 'chain.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- tiny keccak-256 for function selectors ---
function keccak(str) {
  const RC = [1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
  const r = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14]; const M = (1n << 64n) - 1n;
  const rot = (x, n) => n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M;
  const bytes = [...Buffer.from(str)]; bytes.push(1); while (bytes.length % 136) bytes.push(0); bytes[bytes.length - 1] |= 0x80;
  const s = Array(25).fill(0n);
  for (let o = 0; o < bytes.length; o += 136) { for (let i = 0; i < 17; i++) { let v = 0n; for (let b = 7; b >= 0; b--) v = (v << 8n) | BigInt(bytes[o + i * 8 + b]); s[i] ^= v; }
    for (let rd = 0; rd < 24; rd++) { const C = [0,1,2,3,4].map(x => s[x] ^ s[x+5] ^ s[x+10] ^ s[x+15] ^ s[x+20]); for (let x = 0; x < 5; x++) { const D = C[(x+4)%5] ^ rot(C[(x+1)%5], 1); for (let y = 0; y < 25; y += 5) s[x+y] ^= D; }
      const B = Array(25); for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + ((2*x + 3*y) % 5) * 5] = rot(s[x + 5*y], r[x + 5*y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5*y] = B[x + 5*y] ^ (~B[(x+1)%5 + 5*y] & M & B[(x+2)%5 + 5*y]); s[0] ^= RC[rd]; } }
  let h = ''; for (let i = 0; i < 4; i++) { let v = s[i]; for (let b = 0; b < 8; b++) { h += (v & 0xffn).toString(16).padStart(2, '0'); v >>= 8n; } } return h;
}
const sel = sig => keccak(sig).slice(0, 8);
if (sel('currentEpoch()') !== SEL.currentEpoch) throw new Error('keccak self-test failed');
Object.assign(SEL, { totalSupply: sel('totalSupply()'), votingWeight: sel('votingWeight(uint256)'), bookOf: sel('bookOf(uint8,address)'), navInWeth: sel('navInWeth(uint8)'), registry: sel('registry(uint256)'), registryCount: sel('registryCount()'), symbol: sel('symbol()'), decimals: sel('decimals()'), priceInWeth: sel('priceInWeth((address,uint24,uint8),bool)') });
const PRICE_DESK = '0x5607336c73553edc65176f2256686b69e787ca0f'; // TMF's price desk (values tokens in WETH)

// --- RPC helpers ---
let id = 1;
async function rpc(method, params, soft = false) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) });
      if (r.ok) { const j = await r.json(); if (j.result !== undefined) return j.result; if (soft) return { error: j.error }; throw new Error(JSON.stringify(j.error)); }
    } catch (e) { if (i === 4) throw e; }
    await sleep(1500 * (i + 1));
  }
  throw new Error('RPC unavailable');
}
const pad = n => BigInt(n).toString(16).padStart(64, '0');
const raw = (to, s, ...a) => rpc('eth_call', [{ to, data: '0x' + s + a.map(pad).join('') }, 'latest']);
const big = async (to, s, ...a) => { const h = await raw(to, s, ...a); if (!h || h === '0x') throw new Error('empty result ' + s); return BigInt(h.slice(0, 66)); };
const num = async (...a) => Number(await big(...a));
async function pool(items, n, fn) { const out = new Array(items.length); let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } })); return out; }

const block = parseInt(await rpc('eth_blockNumber', []), 16);
const nSlots = await num(DESK, SEL.registryCount);
const reg = await pool([...Array(nSlots).keys()], 4, async i => { const a = '0x' + (await raw(DESK, SEL.registry, i)).slice(26, 66); const h = await raw(a, SEL.symbol);
  const off = Number(BigInt('0x' + h.slice(2, 66))) / 32, n = Number(BigInt('0x' + h.slice(2 + off * 64, 66 + off * 64)));
  return { address: a, symbol: Buffer.from(h.slice(2 + (off + 1) * 64, 2 + (off + 1) * 64 + n * 2), 'hex').toString('utf8') }; });
const MEMES = ['PONS', 'CASHCAT', 'AI', 'MANCER', 'STONKBROKER', 'APE', 'DERP', 'VIRTUAL'];
const toks = reg.filter(r => MEMES.includes(r.symbol));

// ===== probe: lifetime swaps + WETH volume per meme token, from its DexScreener-listed pools (test only; prints counts only) =====
const T0 = Date.now(), el = () => ((Date.now() - T0) / 60000).toFixed(1) + 'm';
const t = s => '0x' + keccak(s);
const T_SW3 = t('Swap(address,address,int256,int256,uint160,uint128,int24)'), T_SW4 = t('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');
const V4PM = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const ETHS = [WETH, '0x0000000000000000000000000000000000000000'];
const latest = parseInt(await rpc('eth_blockNumber', []), 16);
let n429 = 0;
async function getLogs(f) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'eth_getLogs', params: [f] }) });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
      if (r.ok && j && j.result) return j.result;
      if (r.status === 429 || (j && j.error && j.error.code === 429)) { n429++; await sleep(Math.min(60000, 3000 * (i + 1))); continue; }
      return { error: true };
    } catch (e) { if (i > 6) return { error: true }; await sleep(3000); }
  }
}
async function scan(filter, from, to, onLogs, label) {
  let b = from, st = 200_000, calls = 0, n = 0, last = Date.now();
  while (b <= to) {
    if ((Date.now() - T0) / 60000 > 320) { console.log('BUDGET', label, 'stopped at block', b); return false; }
    const e = Math.min(to, b + st - 1);
    const r = await getLogs({ ...filter, fromBlock: '0x' + b.toString(16), toBlock: '0x' + e.toString(16) }); calls++;
    if (r.error) { st = Math.max(100, Math.floor(st / 4)); continue; }
    onLogs(r); n += r.length; b = e + 1; if (r.length < 3000) st = Math.min(st * 2, 5_000_000);
    if (Date.now() - last > 300000) { last = Date.now(); console.log('PROG', label, 'block', b, 'of', latest, 'logs', n, 'step', st, '429s', n429, el()); }
  }
  console.log('SCAN', label, 'logs', n, 'calls', calls, el()); return true;
}
const s128 = h => { let v = BigInt('0x' + h); if (v >> 255n) v -= 1n << 256n; return v; };
const ORDER = ['DERP', 'AI', 'MANCER', 'APE', 'STONKBROKER', 'VIRTUAL', 'PONS', 'CASHCAT']; // smallest first
for (const sym of ORDER) {
  const tk = toks.find(x => x.symbol === sym); if (!tk) continue;
  const a = tk.address.toLowerCase();
  const pr = await (await fetch('https://api.dexscreener.com/token-pairs/v1/robinhood/' + a, { headers: { accept: 'application/json', 'user-agent': 'tmf-fund-intel-dashboard' } })).json();
  const pools = (Array.isArray(pr) ? pr : []).filter(p => p.chainId === 'robinhood');
  const weth = pools.filter(p => { const o = (p.baseToken.address.toLowerCase() === a ? p.quoteToken : p.baseToken).address.toLowerCase(); return ETHS.includes(o) || (p.quoteToken.symbol || '').toUpperCase().includes('ETH'); });
  console.log('POOLS', sym, 'listed', pools.length, 'vs ETH/WETH', weth.length, JSON.stringify(weth.map(p => ({ dex: p.dexId, labels: p.labels, len: p.pairAddress.length, created: p.pairCreatedAt }))));
  let swaps = 0, vol = 0n, ok = true;
  for (const p of weth) {
    const pid = p.pairAddress.toLowerCase();
    // token0 is the lower address; WETH/ETH amount is the other side
    const other = (p.baseToken.address.toLowerCase() === a ? p.quoteToken : p.baseToken).address.toLowerCase();
    const ethIs0 = BigInt(other) < BigInt(a);
    const fromBlock = 0;
    const take = l => { swaps++; const w = s128(l.data.slice(2 + (ethIs0 ? 0 : 64), 2 + (ethIs0 ? 64 : 128))); vol += w < 0n ? -w : w; };
    if (pid.length === 66) ok = (await scan({ address: V4PM, topics: [T_SW4, pid] }, fromBlock, latest, ls => ls.forEach(take), sym + ' v4')) && ok;
    else ok = (await scan({ address: pid, topics: [T_SW3] }, fromBlock, latest, ls => ls.forEach(take), sym + ' v3')) && ok;
  }
  console.log('LIFETIME', sym, JSON.stringify({ complete: ok, pools: weth.length, swaps, weth_volume: Number(vol / 10n ** 14n) / 1e4 }), '429s', n429, el());
}
