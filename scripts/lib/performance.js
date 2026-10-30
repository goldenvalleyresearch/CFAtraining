// Time-weighted return for the Roth IRA and the benchmark comparison.
//
// Daily return  = (value today - money added today) / value yesterday - 1
// Cumulative    = (1 + r1) x (1 + r2) x ... - 1   (daily compounding chain)
// Contributions never count as gains.

const { toTradingDay } = require("./csv");

function buildRothSeries({ startDate, startingCapital, values, flows }) {
  const dates = [...values.keys()].filter((d) => d >= startDate).sort();

  // Attach each flow to the first valued day on or after it.
  const flowByDate = new Map();
  for (const f of flows) {
    if (f.date < startDate) continue; // pre-start money is part of starting capital
    const day = dates.find((d) => d >= toTradingDay(f.date)) || null;
    if (!day) continue; // not valued yet; picked up once that day has a balance
    flowByDate.set(day, (flowByDate.get(day) || 0) + f.amount);
  }

  const series = [];
  let prev = startingCapital, growth = 1, contributed = 0;
  for (const date of dates) {
    const { value, source } = values.get(date);
    const flow = flowByDate.get(date) || 0;
    const daily = prev ? (value - flow) / prev - 1 : 0;
    growth *= 1 + daily;
    contributed += flow;
    const invested = startingCapital + contributed;
    series.push({
      date,
      value: round2(value),
      flow: round2(flow),
      dollarChange: round2(value - prev - flow),
      daily,
      cum: growth - 1, // time-weighted
      invested: round2(invested),
      simple: (value - invested) / invested, // total gain ÷ money put in
      source,
    });
    prev = value;
  }
  return { series, contributed: round2(contributed) };
}

// Benchmark returns from the open on the start date, dividends included.
//   cum:    time-weighted (the ETF's own return)
//   simple: "what if" — starting capital bought the ETF at the open on the
//           start date, and each contribution bought it at that day's close.
//           Return = (what-if value − money put in) ÷ money put in.
function buildBenchmarkSeries(prices, startDate, dates, rothSeries, startingCapital) {
  const days = Object.keys(prices).filter((d) => d >= startDate).sort();
  if (!days.length) return null;
  const first = prices[days[0]];
  const firstDayReturn = first.close / first.open;
  // Total-return index: 1.00 at the open on the start date.
  const index = new Map(days.map((d) => [d, firstDayReturn * (prices[d].adjclose / first.adjclose)]));
  const indexOn = (date) => { const d = days.find((x) => x >= date); return d ? index.get(d) : null; };

  let units = startingCapital, invested = startingCapital;
  const series = dates.map((date, i) => {
    const flow = rothSeries[i].flow;
    const idx = index.has(date) ? index.get(date) : null;
    if (flow) {
      const buyAt = idx != null ? idx : indexOn(date);
      if (buyAt) { units += flow / buyAt; invested += flow; }
    }
    if (idx == null) return { date, cum: null, simple: null };
    return { date, cum: idx - 1, simple: (units * idx - invested) / invested };
  });
  return { firstDate: days[0], lastDate: days[days.length - 1], series };
}

const round2 = (n) => Math.round(n * 100) / 100;

module.exports = { buildRothSeries, buildBenchmarkSeries };
