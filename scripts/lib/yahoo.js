// Daily prices for benchmark ETFs from Yahoo Finance (unofficial chart endpoint).
// Runs at build time on Netlify, so the browser never talks to Yahoo.
// If Yahoo is unreachable, falls back to the prices saved in the live site's
// last performance.json.

const fs = require("fs");

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

function toEpoch(iso) { return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 1000); }

function parseChart(json) {
  const res = json && json.chart && json.chart.result && json.chart.result[0];
  if (!res || !res.timestamp) throw new Error("no data in response");
  const offset = (res.meta && res.meta.gmtoffset) || 0;
  const q = res.indicators.quote[0];
  const adj = (res.indicators.adjclose && res.indicators.adjclose[0].adjclose) || q.close;
  const prices = {};
  res.timestamp.forEach((t, i) => {
    if (q.close[i] == null) return;
    const date = new Date((t + offset) * 1000).toISOString().slice(0, 10);
    prices[date] = { open: q.open[i], close: q.close[i], adjclose: adj[i] };
  });
  return prices;
}

async function fetchYahoo(symbol, startDate) {
  const p1 = toEpoch(startDate) - 10 * 86400;
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  let lastErr;
  for (const host of HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&includeAdjustedClose=true`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (GoldenValleyResearch build)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseChart(await res.json());
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchLiveCache(siteUrl) {
  try {
    const res = await fetch(`${siteUrl}/data/performance.json`);
    if (!res.ok) return {};
    const json = await res.json();
    const out = {};
    for (const b of json.benchmarks || []) if (b.prices) out[b.symbol] = b.prices;
    return out;
  } catch { return {}; }
}

// Returns { SYMBOL: { 'YYYY-MM-DD': {open, close, adjclose} } } plus notes.
async function getBenchmarkPrices(symbols, startDate, siteUrl) {
  const notes = [];
  if (process.env.PRICE_FIXTURES) {
    // Test mode: read prices from a local JSON file instead of the internet.
    return { prices: JSON.parse(fs.readFileSync(process.env.PRICE_FIXTURES, "utf8")), notes };
  }
  const prices = {};
  let cache = null;
  for (const s of symbols) {
    try {
      prices[s] = await fetchYahoo(s, startDate);
    } catch (e) {
      cache = cache || (await fetchLiveCache(siteUrl));
      if (cache[s]) {
        prices[s] = cache[s];
        notes.push(`${s}: Yahoo unavailable (${e.message}); using prices from the last deploy.`);
      } else {
        notes.push(`${s}: Yahoo unavailable (${e.message}) and no saved prices; left off the chart.`);
      }
    }
  }
  return { prices, notes };
}

module.exports = { getBenchmarkPrices };
