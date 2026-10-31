// Reads Fidelity "Portfolio Positions" CSV exports.

const path = require("path");
const { parseCsv, num, readText, MONTHS, toTradingDay } = require("./csv");

function parseDownloadedAt(text, fileName) {
  // e.g. "Date downloaded Oct-29-2026 8:49 p.m ET"
  const m = text.match(/Date downloaded\s+([A-Za-z]{3})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap])\.?m/i);
  if (m) {
    let hour = Number(m[4]) % 12;
    if (m[6].toLowerCase() === "p") hour += 12;
    return {
      date: `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      time: `${String(hour).padStart(2, "0")}:${m[5]}`,
      label: `${m[1]} ${Number(m[2])}, ${m[3]} at ${m[4]}:${m[5]} ${m[6].toLowerCase()}.m. ET`,
    };
  }
  const f = fileName.match(/([A-Za-z]{3})-(\d{1,2})-(\d{4})/);
  if (f) {
    return {
      date: `${f[3]}-${String(MONTHS[f[1].toLowerCase()]).padStart(2, "0")}-${f[2].padStart(2, "0")}`,
      time: "00:00",
      label: `${f[1]} ${Number(f[2])}, ${f[3]}`,
    };
  }
  throw new Error(`Could not find a download date in ${fileName}`);
}

// Weekend downloads show the prior Friday's close (markets are closed),
// so label them with Friday's date instead of the download date.
function withMarketDate(asOf) {
  const marketDate = toTradingDay(asOf.date);
  if (marketDate !== asOf.date) {
    const d = new Date(marketDate + "T12:00:00Z");
    const label = d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
    return { ...asOf, marketDate, label: `${label} close` };
  }
  return { ...asOf, marketDate };
}

function parseOption(symbol) {
  // OCC-style symbol, e.g. -INFQ270416C11
  const m = symbol.match(/^-?([A-Z.]+)(\d{2})(\d{2})(\d{2})([CP])([\d.]+)$/);
  if (!m) return null;
  return { underlying: m[1], expiration: `20${m[2]}-${m[3]}-${m[4]}`, type: m[5] === "C" ? "CALL" : "PUT", strike: Number(m[6]) };
}

function parsePositionsFile(filePath) {
  const fileName = path.basename(filePath);
  const text = readText(filePath);
  const rows = parseCsv(text);

  const headerIdx = rows.findIndex((r) => (r[0] || "").trim() === "Account number");
  if (headerIdx === -1) throw new Error(`${fileName} doesn't look like a Fidelity positions file (no "Account number" header).`);
  const header = rows[headerIdx].map((h) => h.trim());
  const col = (r, name) => r[header.indexOf(name)];

  const holdings = [];
  let cash = 0, pending = 0, accountName = "";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c.trim() === "")) break;
    accountName = accountName || (col(r, "Account name") || "").trim();
    const symbol = (col(r, "Symbol") || "").trim();
    const description = (col(r, "Description") || "").trim();
    const value = num(col(r, "Current value"));

    if (/pending activity/i.test(symbol) || /pending activity/i.test(description)) { pending += value || 0; continue; }
    if (symbol.endsWith("**") || /money market/i.test(description)) { cash += value || 0; continue; }

    const option = parseOption(symbol);
    holdings.push({
      symbol: option ? option.underlying : symbol,
      rawSymbol: symbol,
      description,
      option,
      quantity: num(col(r, "Quantity")),
      lastPrice: num(col(r, "Last price")),
      lastPriceChange: num(col(r, "Last price change")),
      marketValue: value,
      todayGain: num(col(r, "Today's gain/loss dollar")),
      todayGainPct: num(col(r, "Today's gain/loss percent")),
      totalGain: num(col(r, "Total gain/loss dollar")),
      totalGainPct: num(col(r, "Total gain/loss percent")),
      costBasis: num(col(r, "Cost basis total")),
      avgCost: num(col(r, "Average cost basis")),
    });
  }

  if (!holdings.length && cash === 0) throw new Error(`${fileName}: no positions found.`);
  for (const h of holdings) if (h.marketValue == null) throw new Error(`${fileName}: ${h.rawSymbol} has no current value.`);

  // Pending activity rule (to be confirmed against a real file with a pending line).
  cash = cash - pending;

  const invested = holdings.reduce((s, h) => s + h.marketValue, 0);
  const total = invested + cash;
  const todayGain = holdings.reduce((s, h) => s + (h.todayGain || 0), 0);
  const costBasis = holdings.reduce((s, h) => s + (h.costBasis || 0), 0);
  const totalGain = holdings.reduce((s, h) => s + (h.totalGain || 0), 0);

  for (const h of holdings) h.weight = total ? h.marketValue / total : 0;
  holdings.sort((a, b) => b.marketValue - a.marketValue);

  const round = (n) => Math.round(n * 100) / 100;
  return {
    sourceFile: fileName,
    asOf: withMarketDate(parseDownloadedAt(text, fileName)),
    accountName,
    summary: {
      accountValue: round(total),
      invested: round(invested),
      cash: round(cash),
      pendingActivity: round(pending),
      cashWeight: total ? cash / total : 0,
      todayGain: round(todayGain),
      todayGainPct: total - todayGain ? todayGain / (total - todayGain) : 0,
      costBasis: round(costBasis),
      unrealizedGain: round(totalGain),
      unrealizedGainPct: costBasis ? totalGain / costBasis : 0,
      positionCount: holdings.length,
    },
    holdings,
  };
}

module.exports = { parsePositionsFile };
