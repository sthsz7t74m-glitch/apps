(() => {
  "use strict";

  function formatDate(value) {
    if (!value) return "指定なし";
    const [year, month, day] = value.split("-");
    return `${year}/${month}/${day}`;
  }

  function setupDateDisplay(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return () => {};

    const sync = () => {
      display.textContent = formatDate(input.value);
      display.classList.toggle("is-empty", !input.value);
    };

    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    sync();
    return sync;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const syncFrom = setupDateDisplay("fromDate", "fromDateDisplay");
    const syncTo = setupDateDisplay("toDate", "toDateDisplay");
    const resetButton = document.getElementById("resetButton");

    resetButton?.addEventListener("click", () => {
      window.setTimeout(() => {
        syncFrom();
        syncTo();
      }, 0);
    });
  });
})();
