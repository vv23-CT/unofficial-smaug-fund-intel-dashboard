# Unofficial TMF Fund Intel Dashboard

Unofficial community research on The Mutual Fun's five funds (ARGON, BOGLE, SMAUG, MIDAS, VLADD): what each fund's room is backing this week, how each room moved during the week, and sourced facts on every token, side by side. Facts only: no recommendations, forecasts or rankings. Not affiliated with or endorsed by The Mutual Fun.

Live page: https://vv23-ct.github.io/unofficial-tmf-fund-intel-dashboard/

## How it stays current
Almost everything updates itself on GitHub, about every 30 minutes:
- **Robinhood Chain (public, read-only):** turnout, each fund's room (backed, vetoed, no cards, shares), $TMF held, fund size in WETH, token prices in WETH and USD, Fridays to fill, the bell time, this week's timeline, and each bell's final rooms.
- **U.S. Bureau of Labor Statistics and Federal Reserve (official):** jobs and CPI numbers on release days, and the release and FOMC meeting dates for "Next 14 days".
- **DexScreener and CoinMarketCap (free plans):** prices, changes and market caps for the listed crypto tokens, BTC and Fear & Greed.
- **After each bell:** a recap of the week's final rooms.

A daily Claude run adds cited facts that have no free automatic source (stock closes, ETH ETF flows, news, other events) and merges them only when each one has a date and a source link.

See [DATA.md](DATA.md) for the files and fields.
