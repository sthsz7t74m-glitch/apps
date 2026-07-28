(() => {
  "use strict";

  const VERSION = "2.4.1";
  const $ = (selector) => document.querySelector(selector);

  function resetControl(selector, value = "") {
    const control = $(selector);
    if (control) control.value = value;
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

      const firstDate = String(window.YOSHIMOTO_LIVE_ROWS || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)?.split("|")[0] || "";
      resetControl("#fromDate", firstDate);

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
    if (version) version.textContent = `v${VERSION}`;
    installSafeReset();
  });
})();
