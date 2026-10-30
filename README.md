# Golden Valley Research

Personal Roth IRA tracking site, live at goldenvalleyresearch.com.
Tracking starts Oct 21, 2026 with $850 of starting capital.

## Daily update (every day, activity or not)

1. In VS Code, click **Sync Changes** first.
2. Download the **Positions** CSV from Fidelity **after 4 p.m. ET** and drop it into `data/positions` (keep Fidelity's file name).
3. On days with buys, sells, or contributions, also drop the **Activity/History** CSV into `data/activity`.
4. Commit and push. Netlify rebuilds the site in a minute or two.

Keep the old positions files: each one is that day's account value for the performance chart.

## Missing a day?

If you skip a day's positions download, add that day's closing balance to `data/balances.csv`:

```
10/30/2026,1550.25
```

A line in `balances.csv` also overrides the positions file for the same day.

## Pages

- `/performance/` — cumulative return vs. benchmarks (VOO, QQQ)
- `/positions/` — open positions from the newest positions file
- `/` — homepage (live return vs. VOO, snapshot, sections; Strategy, CFA Notebook, and About are placeholders for now)

## How performance is calculated

The Performance page has a switch between two methods. Contributions are never counted as gains in either.

**Time-weighted** (how funds report)
- Daily return = (today's balance − money added today) ÷ yesterday's balance − 1
- Cumulative return = daily returns chained together
- Benchmarks: the ETF's own return

**Simple**
- Return = (balance − total money put in) ÷ total money put in
- Benchmarks: what the same money would have done in the ETF (starting capital bought at the open on the start date, each contribution bought at that day's close)

Other details:
- Contributions come from the activity files. Ones dated before the start date are part of the $850 starting capital.
- Benchmarks: daily prices from Yahoo Finance, fetched during each Netlify build, measured from the open on the start date, dividends included. If Yahoo is down, the last deploy's prices are reused.

## Settings

`scripts/config.js` holds the start date, starting capital, and benchmark list. To add an ETF, add a line like
`{ symbol: "SMH", name: "Semiconductors" },` to the end of `benchmarks`.

## If something goes wrong

If a file can't be read, the Netlify build stops on purpose and the last good version stays live.
Check the deploy log in Netlify for a line starting with `BUILD STOPPED:`.

## Files

- `netlify.toml` — tells Netlify to run `node scripts/build.js` and publish the `site` folder
- `scripts/build.js` — reads `data/`, writes `site/data/positions.json` and `site/data/performance.json`
- `scripts/lib/` — CSV readers, Yahoo fetch, and the return math
- `site/` — the website pages
