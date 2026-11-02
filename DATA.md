# Unofficial TMF Fund Intel Dashboard: data rules

The page (`index.html`) reads everything from `data.json`. To update the dashboard, change `data.json` only.

## Rules
- Facts only. No forecasts, calls, confidence levels or suggested allocations.
- Every item has a date and a source link. Fund facts cite that fund's ballot page and the capture time.
- If a fact can't be verified, leave it out.
- Nothing private: no wallet addresses, balances or keys, and never anyone's own card.

## Sections in data.json
- `version` (2), `week`, `bell_utc`: the week's closing bell (ISO time, UTC).
- `updated_utc`: when the data was last refreshed (ISO time, UTC). The page shows it, and every other time, in the viewer's own time zone.
- `funds`: one per fund, in ballot order (ARGON, BOGLE, SMAUG, MIDAS, VLADD). Read from each fund's ballot page in the **Match the room** view, with every "Show 4 more rows" expanded. Each:
  - `id, name, asof` (capture time, ET, as text), `asof_utc` (the same time as ISO UTC; the page shows this in the viewer's time zone), `source, url`
  - `chairs`, `floor` (25)
  - `tmf_held`: the "$TMF HELD" row, as a fraction (0.3654 = 36.54%)
  - `room_weth`: WETH in the room's split; `room_tokens`: `{TOKEN: fraction}` for every token the room backs (from the "your card" line in Match the room view)
  - `status`: `{TOKEN: "backed" | "vetoed" | "no_cards"}`. Backed: in the room's split. Vetoed: in the "Headed to WETH so far" list. No cards: in neither.
  - `fills`: `{TOKEN: {n, asof}}` for tokens with a "Slow to fill … about N Fridays" note
  - `not_in_capture`: tokens whose rows were collapsed in the capture (their fill is unknown)
  - `history`: this week's captures, oldest first, for the "This week so far" timeline. Each: `asof, asof_utc` (when known)`, chairs, tmf_held, backs` (`backs` = `{TOKEN: fraction}`, same as `room_tokens`). Append one entry per new capture (the last entry matches the fund's current values); start a fresh list after each bell.
- `market`: ETH and market tiles. Each row: `id, label, value, fmt, asof, source, url`.
- `news`: ETH news items. Each: `head, text, source, url`.
- `tokens`: one per listed token, shared by all funds. Each: `token, group (Stable|Stock|Meme), price, news, fee, onchain, onchain_asof, source, url`. On-chain prices are the same on every fund's ballot.
- `events`: next 14 days. Each: `id, date, when_utc, when_et, event, tokens, short, key, source, url`.
- `rules`: how the vote works. Each: `rule, text`.
- `glossary`: each `term, def`.
- `updates`: newest first. Each `date, text`.

## chain.json (automatic)
Written every 30 minutes by `.github/workflows/turnout.yml` (`tools/chain_turnout.mjs`), only when a count changes. Read-only calls to public Robinhood Chain contracts; counts only.
- `asof_utc, block, epoch` (the contract's week number), `closes_utc`, `source, url`
- `funds`: `{id: {enrolled, voted, enrolled_weight}}`. `enrolled` = DividendOffice `enrolledCount(fund)`; `voted` = Ballot `chairsVoted(fund, epoch)`.
The page uses chain.json for turnout when it is newer than the `turnout` stored in data.json. Don't edit it by hand.
- Since Nov 1, 2026 each fund in chain.json also has `room`: `chairs, tmf_held, room_weth, room_tokens, status` (same meaning as in data.json), rebuilt from this week's cards: a token is backed when chairs with more than half the voting weight put something on it; its share is the chair-weighted average of all cards; $TMF held = (fund value in WETH − fund WETH) / fund value. The page uses it in place of the last ballot capture when it is newer and in the same week. Fills still come from ballot captures.
