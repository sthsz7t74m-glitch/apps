(() => {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const rows = String(window.YOSHIMOTO_LIVE_ROWS || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const date = line.split("|", 1)[0];
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
    });

  // Keep one copy when manually curated and auto-fetched data overlap.
  window.YOSHIMOTO_LIVE_ROWS = [...new Set(rows)].join("\n");
})();
