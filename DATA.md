# Unofficial TMF Fund Intel Dashboard: data

The page (`index.html`) loads `data.json`, then lays the automatic files over it: `chain.json`, `econ.json` and `cmc.json`. When an automatic figure is newer, the page shows it in place of the one in `data.json`. Every time on the page is shown in the viewer's own time zone from ISO UTC fields.

## Rules
- Facts only. No forecasts, calls, confidence levels, rankings or suggested allocations.
- Every item has a date and a source link. If a fact can't be verified, it is left out.
- Nothing private: no wallet addresses, seat numbers, balances or keys, and never anyone's own card. Chain data is counts and fund totals only.
- Free sources only, used within their terms.

## Who writes what
| File | Written by | How often | Edit by hand? |
|---|---|---|---|
| `chain.json` | `tools/chain_turnout.mjs` (GitHub Action `turnout.yml`) | every reading, about every 30 min | No |
| `econ.json` | `tools/bls.mjs` (same Action) | schedules weekly; numbers on release days | No |
| `cmc.json` | `tools/cmc.mjs` (same Action; key in the repo secret `CMC_API_KEY`) | every reading | No |
| `og.png` | `tools/render_og.mjs` | when a room's backed set changes | No |
| `data.json` | the daily Claude run (cited facts), `tools/bell_recap.mjs` (after each bell) | daily, and after each bell | Only cited facts |

The clock is `.github/workflows/tick.yml`: it waits 29 minutes on the `reader-timer` environment, starts a reading, then starts the next tick.

## chain.json (Robinhood Chain, chain 4663, public RPC, read-only)
- `asof_utc, block, epoch` (the week number), `closes_utc` (the bell), `source, url`, and the contracts read: `ballot`, `dividend_office`, `desk`.
- `funds.{id}`:
  - `enrolled` (DividendOffice `enrolledCount`), `voted` (Ballot `chairsVoted` this week), `enrolled_weight`.
  - `room`: `chairs, tmf_held, room_weth, room_tokens {TOKEN: fraction}, status {TOKEN: backed|vetoed|no_cards}, nav_weth` (fund size in WETH), `fills {TOKEN: Fridays}`. Rebuilt from this week's ballot cards: a token is backed when chairs with more than half the voting weight put something on it; its share is the chair-weighted average of all cards; vetoed when some but not most did; no cards when none did. $TMF held = (fund value in WETH − fund WETH) / fund value. Fridays to fill = ceil((fund value / 4) / the price desk's per-Friday limit).
  - `history`: this week's timeline (one row a day, plus a row whenever what the room backs changes).
- `prices` (WETH per token, TMF's price desk `priceInWeth`), `depth` (per-Friday limit), `market.eth_usd` (ETH valued in USDG on the price desk), `usd` (token prices in USD), `changes {TOKEN: {h24, d7}}` and `price_hist` (hourly WETH prices, last 8 days).
- `dex {TOKEN: {price_usd, change_24h, volume_24h, liquidity_usd, market_cap, fdv, pools, url}}` from DexScreener's free API, for the meme tokens.
- `archive`: at each bell, every fund's final room for the week (chairs, room_tokens, $TMF held, enrolled, fills).

## econ.json (official U.S. government data)
- `schedule.jobs`, `schedule.cpi` (BLS release dates), `schedule.fomc` (Federal Reserve meeting decision dates); `schedule_utc`.
- `jobs`: `period, payrolls_change` (thousands), `unemployment_rate, hourly_earnings_mm, hourly_earnings_yy, preliminary, release_date, url`.
- `cpi`: `period, cpi_mm, cpi_yy, core_mm, core_yy, release_date, url`.
The page shows these as market tiles and adds every jobs report, CPI release and Fed decision in the next 14 days to "Next 14 days".

## cmc.json (CoinMarketCap, free Basic plan)
- `asof_utc, source, url`.
- `quotes {SYMBOL: {price, ch24, ch7, ch30, mcap, asof_utc, url}}` for BTC, ETH, USDG, PONS, CASHCAT, VIRTUAL, AI, MANCER, STONKBROKER, APE.
- `fng {value, label, asof_utc, url}`: CoinMarketCap's Fear & Greed index.
Only the figures the page shows are saved, each with its CoinMarketCap link.

## data.json (cited facts)
- `version` (2), `week`, `bell_utc`, `updated_utc`.
- `funds`: one per fund in ballot order, with `id, name, floor` (25) and any ballot-capture fields (`asof, asof_utc, chairs, tmf_held, room_weth, room_tokens, status, fills, history, turnout`). Captures are optional now; the chain figures take over when newer.
- `market`: tiles, each `id, label, value, fmt, asof, source, url`. `eth`, `eth_1w`, `btc` and `fng` are overwritten by the automatic files.
- `news`: each `head, text, source, url`.
- `tokens`: one per listed token, each `token, group (Stable|Stock|Meme), price, news, fee` (pool fee), `onchain, onchain_asof, source, url`. For the 8 CoinMarketCap-listed tokens the `price` text comes from `cmc.json`.
- `events`: next 14 days, each `id, date, when_utc, when_et, event, tokens, short, key, source, url`.
- `rules` (`rule, text`), `glossary` (`term, def`), `updates` (newest first, `date, text`; the bell recap is added here automatically).
