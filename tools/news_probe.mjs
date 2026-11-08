// Throwaway probe: which free news sources answer from GitHub Actions? No data is written to the site.
const UA = 'UnofficialTMFDashboard/1.0 (vv23.ct@gmail.com)';
const ciks = {COIN:'0001679788',MSTR:'0001050446',META:'0001326801',GOOGL:'0001652044',NVDA:'0001045810',TSLA:'0001318605',RDDT:'0001713445'};
const urls = {};
for (const [t,c] of Object.entries(ciks)) urls['EDGAR '+t] = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c}&type=8-K&count=5&output=atom`;
Object.assign(urls, {
 'Fed press': 'https://www.federalreserve.gov/feeds/press_all.xml',
 'Treasury': 'https://home.treasury.gov/system/files/136/treasury-press-releases.xml',
 'CoinDesk': 'https://www.coindesk.com/arc/outboundfeeds/rss/',
 'Decrypt': 'https://decrypt.co/feed',
 'The Block': 'https://www.theblock.co/rss.xml',
 'Cointelegraph': 'https://cointelegraph.com/rss',
 'GDELT': 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22Coinbase%22&mode=artlist&maxrecords=3&format=json',
 'DexScreener': 'https://api.dexscreener.com/latest/dex/search?q=CASHCAT',
 'Invesco QQQ': 'https://www.invesco.com/qqq-etf/en/home.html',
});
for (const [k,u] of Object.entries(urls)) {
  try {
    const r = await fetch(u,{headers:{'User-Agent':UA,'Accept':'*/*'},signal:AbortSignal.timeout(20000)});
    const b = await r.text();
    const titles = [...b.matchAll(/<title[^>]*>(?:<!\[CDATA\[)?([^<\]]{3,90})/g)].slice(1,3).map(m=>m[1].trim());
    console.log(`${k}: ${r.status} ${r.headers.get('content-type')} len=${b.length} ${titles.join(' | ')}`);
  } catch(e){ console.log(`${k}: FAIL ${e.message}`); }
  await new Promise(r=>setTimeout(r,300));
}
