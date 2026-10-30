// Golden Valley Research — data build script.
// Runs on every Netlify deploy (see netlify.toml). It reads the Fidelity
// files in data/ and writes the JSON the pages display:
//   site/data/positions.json    newest positions file
//   site/data/performance.json  daily returns vs. benchmarks
// If a file can't be read, the build stops on purpose so the last good
// version of the site stays live.

const fs = require("fs");
const path = require("path");
const config = require("./config");
const { toTradingDay } = require("./lib/csv");
const { parsePositionsFile } = require("./lib/positions");
const { loadActivity, cashFlows } = require("./lib/activity");
const { loadBalances } = require("./lib/balances");
const { getBenchmarkPrices } = require("./lib/yahoo");
const { buildRothSeries, buildBenchmarkSeries } = require("./lib/performance");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const OUT = path.join(ROOT, "site", "data");

const csvFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv")).map((f) => path.join(dir, f)) : [];

function writeJson(name, obj) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify({ generatedAt: new Date().toISOString(), ...obj }, null, 2));
}

async function main() {
  // ---- Positions ----
  const snapshots = csvFiles(path.join(DATA, "positions")).map(parsePositionsFile);
  if (!snapshots.length) throw new Error("No positions CSV found in data/positions/.");
  snapshots.sort((a, b) => `${a.asOf.date} ${a.asOf.time}`.localeCompare(`${b.asOf.date} ${b.asOf.time}`));
  const latest = snapshots[snapshots.length - 1];
  writeJson("positions.json", latest);
  console.log(`Positions: ${snapshots.length} file(s); showing ${latest.sourceFile} (${latest.asOf.label}).`);

  // ---- Daily account values ----
  // Positions files give one value per day (latest download wins).
  // data/balances.csv entries override them for the same day.
  const values = new Map();
  for (const s of snapshots) values.set(toTradingDay(s.asOf.date), { value: s.summary.accountValue, source: "positions" });
  const manual = loadBalances(path.join(DATA, "balances.csv"));
  for (const [date, value] of manual) {
    const day = toTradingDay(date);
    const existing = values.get(day);
    if (existing && Math.abs(existing.value - value) > 1)
      console.log(`Note: ${day} balances.csv $${value} differs from positions file $${existing.value}; using balances.csv.`);
    values.set(day, { value, source: "balances" });
  }

  // ---- Cash flows ----
  const activity = loadActivity(csvFiles(path.join(DATA, "activity")));
  const flows = cashFlows(activity);

  const roth = buildRothSeries({ startDate: config.startDate, startingCapital: config.startingCapital, values, flows });
  const dates = roth.series.map((p) => p.date);

  // ---- Benchmarks ----
  const symbols = config.benchmarks.map((b) => b.symbol);
  const { prices, notes } = await getBenchmarkPrices(symbols, config.startDate, config.siteUrl);
  const benchmarks = config.benchmarks.map((b) => {
    const p = prices[b.symbol];
    const built = p ? buildBenchmarkSeries(p, config.startDate, dates, roth.series, config.startingCapital) : null;
    return { symbol: b.symbol, name: b.name, available: !!built, series: built ? built.series : [], prices: p || null };
  });
  notes.forEach((n) => console.log("Note: " + n));

  const last = roth.series[roth.series.length - 1] || null;
  writeJson("performance.json", {
    startDate: config.startDate,
    startingCapital: config.startingCapital,
    asOf: last ? last.date : null,
    roth: {
      name: "Roth IRA",
      cum: last ? last.cum : 0,
      simple: last ? last.simple : 0,
      value: last ? last.value : config.startingCapital,
      contributedSinceStart: roth.contributed,
      series: roth.series,
    },
    benchmarks,
    notes,
  });
  console.log(
    `Performance: ${roth.series.length} day(s) from ${config.startDate}` +
      (last ? `; Roth ${(last.cum * 100).toFixed(2)}% as of ${last.date}` : "") +
      benchmarks.map((b) => {
        const v = b.series.length ? b.series[b.series.length - 1].cum : null;
        return ` | ${b.symbol} ${v == null ? "n/a" : (v * 100).toFixed(2) + "%"}`;
      }).join("")
  );
}

main().catch((err) => {
  console.error("BUILD STOPPED: " + err.message);
  process.exit(1);
});
