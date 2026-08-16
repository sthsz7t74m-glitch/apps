(() => {
  "use strict";

  const VERSION = "2.6.0";
  const $ = (selector) => document.querySelector(selector);

  function resetControl(selector, value = "") {
    const control = $(selector);
    if (control) control.value = value;
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function defaultFromDate() {
    const dates = String(window.YOSHIMOTO_LIVE_ROWS || "")
      .split(/\r?\n/)
      .map((line) => line.trim().split("|")[0])
      .filter(Boolean)
      .sort();
    const first = dates[0] || "";
    const last = dates.at(-1) || "";
    const today = localDateString();
    return today >= first && today <= last ? today : first;
  }

  function syncDateDisplay(inputId, displayId) {
    const input = $(inputId);
    const display = $(displayId);
    if (!input || !display) return;
    display.textContent = input.value ? input.value.replaceAll("-", "/") : "指定なし";
    display.classList.toggle("is-empty", !input.value);
  }

  function installSafeReset() {
    const current = $("#resetButton");
    if (!current || current.dataset.safeReset === "true") return;

    const replacement = current.cloneNode(true);
    replacement.dataset.safeReset = "true";
    current.replaceWith(replacement);

    replacement.addEventListener("click", () => {
      if (replacement.disabled) return;
      replacement.disabled = true;
      replacement.textContent = "リセット中…";

      resetControl("#searchInput");
      resetControl("#venueFilter");
      resetControl("#genreFilter");
      resetControl("#toDate");
      resetControl("#statusFilter");
      resetControl("#dayTypeFilter");
      resetControl("#priceFilter");
      resetControl("#sortFilter", "date");

      resetControl("#fromDate", defaultFromDate());
      syncDateDisplay("#fromDate", "#fromDateDisplay");
      syncDateDisplay("#toDate", "#toDateDisplay");

      const clearPerformer = $("#clearPerformer");
      const netaMode = document.querySelector('[data-mode="neta"]');

      requestAnimationFrame(() => {
        if (clearPerformer && !clearPerformer.hidden) {
          clearPerformer.click();
        } else if (netaMode) {
          netaMode.click();
        } else {
          $("#searchInput")?.dispatchEvent(new Event("input", { bubbles: true }));
        }

        document.querySelectorAll("[data-mode]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.mode === "neta");
        });

        requestAnimationFrame(() => {
          replacement.disabled = false;
          replacement.textContent = "リセット";
        });
      });
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const version = document.querySelector(".version");
    if (version) version.textContent = `v${window.YOSHIMOTO_LIVE_META?.version || VERSION}`;
    installSafeReset();
  });
})();
