(() => {
  "use strict";

  const clockIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 7v5l3 2"></path>
    </svg>`;

  const micIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3"></rect>
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"></path>
    </svg>`;

  function enhancePanel(panel) {
    if (!(panel instanceof HTMLElement) || panel.dataset.timeLayout === "done") return;

    const dateMain = panel.querySelector(".date-main");
    const timeLine = panel.querySelector(".time-line");
    const date = dateMain?.querySelector("strong")?.textContent?.trim();
    const weekday = dateMain?.querySelector("span")?.textContent?.trim();
    const timeText = timeLine?.textContent || "";
    const open = timeText.match(/開場\s*([0-9:]+)/)?.[1] || "--:--";
    const start = timeText.match(/開演\s*([0-9:]+)/)?.[1] || "--:--";

    if (!date || !weekday) return;

    panel.innerHTML = `
      <div class="event-date-layout">
        <div class="event-date-left">
          <strong>${date}</strong>
          <span>${weekday}</span>
        </div>
        <div class="event-date-divider" aria-hidden="true"></div>
        <div class="event-time-list">
          <div class="event-time-row">
            <span class="event-time-icon">${clockIcon}</span>
            <span class="event-time-label">開場</span>
            <span class="event-time-value">${open}</span>
          </div>
          <div class="event-time-row">
            <span class="event-time-icon">${micIcon}</span>
            <span class="event-time-label">開演</span>
            <span class="event-time-value">${start}</span>
          </div>
        </div>
      </div>`;

    panel.dataset.timeLayout = "done";
  }

  function enhanceAll(root = document) {
    root.querySelectorAll?.(".date-panel").forEach(enhancePanel);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("liveList");
    enhanceAll();

    if (!list) return;
    const observer = new MutationObserver(() => enhanceAll(list));
    observer.observe(list, { childList: true, subtree: true });
  });
})();
