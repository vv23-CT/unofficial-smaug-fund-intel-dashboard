# Unofficial SMAUG Fund Intel Dashboard: data rules

The page (`index.html`) reads everything from `data.json`. To update the dashboard, change `data.json` only.

## Rules
- Facts only. No forecasts, calls, confidence levels or suggested allocations.
- Every item has a date and a source link. Ballot facts cite the SMAUG ballot page and the screenshot date.
- If a fact can't be verified, leave it out.
- Nothing private: no wallet addresses, balances or keys.

## Sections in data.json
- `bell_utc`: the week's closing bell (ISO time, UTC).
- `market`: tiles and ballot facts. Each row: `id, label, value, fmt, asof, source, url`.
  Ballot rows: `turnout`, `tmf_held`, `weth_now`, `room_backed`.
- `news`: ETH news items. Each: `head, text, source, url`.
- `tokens`: one per listed token. Each: `token, group (Stable|Stock|Meme), price, news, fee, fill, slow, backing, onchain, source, url`.
- `events`: next 14 days. Each: `id, date, when_utc, when_et, event, tokens, short, key, source, url`.
- `rules`: how the vote works. Each: `rule, text`.
- `glossary`: each `term, def`.
- `updates`: newest first. Each `date, text`.
