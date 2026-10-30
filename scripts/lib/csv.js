// Shared CSV helpers for Fidelity exports.

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function num(v) {
  if (v == null) return null;
  const s = String(v).replace(/[$,%+\s]/g, "");
  if (s === "" || s === "--" || s.toLowerCase() === "n/a") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readText(filePath) {
  return require("fs").readFileSync(filePath, "utf8").replace(/^﻿/, "");
}

// Accepts 10/21/2026, 2026-10-21, Oct-21-2026. Returns YYYY-MM-DD or null.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function toIsoDate(s) {
  s = String(s || "").trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  if ((m = s.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/)) && MONTHS[m[1].toLowerCase()])
    return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

// Weekend dates roll back to Friday (a Saturday download shows Friday's close).
function toTradingDay(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}

module.exports = { parseCsv, num, readText, toIsoDate, toTradingDay, MONTHS };
