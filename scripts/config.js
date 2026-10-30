// Site settings. Edit here to change the start date or add benchmarks.
module.exports = {
  siteUrl: "https://goldenvalleyresearch.com",
  startDate: "2026-10-21",
  startingCapital: 850,
  // Order matters: it sets each benchmark's chart color. Add new ones at the end.
  benchmarks: [
    { symbol: "VOO", name: "S&P 500" },
    { symbol: "QQQ", name: "Nasdaq-100" },
  ],
};
