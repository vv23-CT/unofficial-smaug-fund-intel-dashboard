# Unofficial TMF Fund Intel Dashboard: data rules

The page (`index.html`) reads everything from `data.json`. To update the dashboard, change `data.json` only.

## Rules
- Facts only. No forecasts, calls, confidence levels or suggested allocations.
- Every item has a date and a source link. Fund facts cite that fund's ballot page and the capture time.
- If a fact can't be verified, leave it out.
- Nothing private: no wallet addresses, balances or keys, and never anyone's own card.

## Sections in data.json
- `version` (2), `week`, `bell_utc`: the week's closing bell (ISO time, UTC).
- `funds`: one per fund, in ballot order (ARGON, BOGLE, SMAUG, MIDAS, VLADD). Read from each fund's ballot page in the **Match the room** view, with every "Show 4 more rows" expanded. Each:
  - `id, name, asof` (capture time, ET), `source, url`
  - `chairs`, `floor` (25)
  - `tmf_held`: the "$TMF HELD" row, as a fraction (0.3654 = 36.54%)
  - `room_weth`: WETH in the room's split; `room_tokens`: `{TOKEN: fraction}` for every token the room backs (from the "your card" line in Match the room view)
  - `status`: `{TOKEN: "backed" | "vetoed" | "no_cards"}`. Backed: in the room's split. Vetoed: in the "Headed to WETH so far" list. No cards: in neither.
  - `fills`: `{TOKEN: {n, asof}}` for tokens with a "Slow to fill … about N Fridays" note
  - `not_in_capture`: tokens whose rows were collapsed in the capture (their fill is unknown)
- `market`: ETH and market tiles. Each row: `id, label, value, fmt, asof, source, url`.
- `news`: ETH news items. Each: `head, text, source, url`.
- `tokens`: one per listed token, shared by all funds. Each: `token, group (Stable|Stock|Meme), price, news, fee, onchain, onchain_asof, source, url`. On-chain prices are the same on every fund's ballot.
- `events`: next 14 days. Each: `id, date, when_utc, when_et, event, tokens, short, key, source, url`.
- `rules`: how the vote works. Each: `rule, text`.
- `glossary`: each `term, def`.
- `updates`: newest first. Each `date, text`.
