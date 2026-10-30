// Reads Fidelity "History for Account" (activity) CSV exports.
// For performance we only need cash flows (contributions); trades are
// already reflected in the daily account value.

const path = require("path");
const { parseCsv, num, readText, toIsoDate } = require("./csv");

function parseActivityFile(filePath) {
  const fileName = path.basename(filePath);
  const rows = parseCsv(readText(filePath));
  const headerIdx = rows.findIndex((r) => (r[0] || "").trim() === "Run Date");
  if (headerIdx === -1) throw new Error(`${fileName} doesn't look like a Fidelity activity file (no "Run Date" header).`);
  const header = rows[headerIdx].map((h) => h.trim());
  const col = (r, name) => (r[header.indexOf(name)] || "").trim();

  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c.trim() === "")) break;
    const date = toIsoDate(col(r, "Run Date"));
    if (!date) continue;
    out.push({
      date,
      action: col(r, "Action"),
      symbol: col(r, "Symbol"),
      quantity: num(col(r, "Quantity")),
      price: num(col(r, "Price ($)")),
      amount: num(col(r, "Amount ($)")),
      key: r.map((c) => c.trim()).join("|"),
    });
  }
  return out;
}

// Merge several activity files. Overlapping downloads repeat the same rows,
// so each identical row is kept as many times as it appears in any one file.
function loadActivity(files) {
  const best = new Map();
  for (const f of files) {
    const counts = new Map();
    for (const row of parseActivityFile(f)) {
      const c = counts.get(row.key) || { row, n: 0 };
      c.n++;
      counts.set(row.key, c);
    }
    for (const [k, c] of counts) if (!best.has(k) || best.get(k).n < c.n) best.set(k, c);
  }
  const rows = [];
  for (const { row, n } of best.values()) for (let i = 0; i < n; i++) rows.push(row);
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// Money moving in (+) or out (-) of the account. Contributions now;
// withdrawals/distributions handled if they ever appear.
function cashFlows(rows) {
  return rows
    .filter((r) => /CONTRIBUTION|DISTRIBUTION|WITHDRAWAL/i.test(r.action) && r.amount != null)
    .map((r) => ({ date: r.date, amount: r.amount, action: r.action }));
}

module.exports = { loadActivity, cashFlows };
