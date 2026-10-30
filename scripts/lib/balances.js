// Reads data/balances.csv — daily end-of-day account balances entered by hand.
// Lines starting with # are comments. Format: date,balance

const fs = require("fs");
const { parseCsv, num, readText, toIsoDate } = require("./csv");

function loadBalances(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const map = new Map();
  const lines = readText(filePath).split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  for (const r of parseCsv(lines.join("\n"))) {
    const date = toIsoDate(r[0]);
    if (!date) continue; // header row
    const value = num(r[1]);
    if (value == null) throw new Error(`balances.csv: no balance on line for ${r[0]}`);
    map.set(date, value);
  }
  return map;
}

module.exports = { loadBalances };
