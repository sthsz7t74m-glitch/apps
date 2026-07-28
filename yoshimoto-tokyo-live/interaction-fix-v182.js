(() => {
  "use strict";

  const VERSION = "1.9.0";

  function allPerformerNames() {
    const raw = window.YOSHIMOTO_LIVE_ROWS || "";
    const counts = new Map();

    raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const parts = line.split("|");
      const performers = parts[10] || "";
      performers.split("／").map((name) => name.trim()).filter(Boolean).forEach((name) => {
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([name]) => name);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function showAllPerformers() {
    const container = document.getElementById("performerChips");
    if (!container) return;

    const names = allPerformerNames();
    const currentNames = [...container.querySelectorAll("[data-filter-artist]")]
      .map((button) => button.dataset.filterArtist);

    if (currentNames.length === names.length && currentNames.every((name, index) => name === names[index])) return;

    const activeName = container.querySelector(".is-active")?.dataset.filterArtist || "";
    container.innerHTML = names.map((name) =>
      `<button class="performer-chip${name === activeName ? " is-active" : ""}" type="button" data-filter-artist="${escapeHtml(name)}">${escapeHtml(name)}</button>`
    ).join("");
  }

  function snapshotUi() {
    return {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      focusedEventId: document.activeElement?.closest?.(".live-card")?.dataset.eventId || ""
    };
  }

  function restoreUi(snapshot) {
    showAllPerformers();
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);

    if (snapshot.focusedEventId) {
      const eventId = window.CSS?.escape ? CSS.escape(snapshot.focusedEventId) : snapshot.focusedEventId.replace(/["\\]/g, "\\$&");
      const card = document.querySelector(`.live-card[data-event-id="${eventId}"]`);
      const favoriteButton = card?.querySelector(".show-favorite, .performer-button.is-favorite");
      favoriteButton?.focus({ preventScroll: true });
    }
  }

  function scheduleRestore(snapshot) {
    requestAnimationFrame(() => {
      restoreUi(snapshot);
      requestAnimationFrame(() => window.scrollTo(snapshot.scrollX, snapshot.scrollY));
    });
  }

  document.addEventListener("click", (event) => {
    const favoriteControl = event.target.closest("[data-show-id], [data-artist], [data-remove-artist]");
    if (favoriteControl) scheduleRestore(snapshotUi());
  }, true);

  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.closest(".live-card")) return;
    document.querySelectorAll(".live-card details[open]").forEach((other) => {
      if (other !== details) other.open = false;
    });
  }, true);

  window.addEventListener("DOMContentLoaded", () => {
    const version = document.querySelector(".version");
    if (version) version.textContent = `v${VERSION}`;
    showAllPerformers();
  });
})();