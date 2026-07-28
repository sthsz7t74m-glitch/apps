(() => {
  "use strict";

  function compactArtistCards(root = document) {
    root.querySelectorAll?.(".artist-favorite-card").forEach((card) => {
      const info = card.firstElementChild;
      const count = info?.querySelector("span");
      const promote = card.querySelector("[data-promote-artist]");
      const remove = card.querySelector("[data-remove-artist]");

      if (count && !count.dataset.compacted) {
        const match = count.textContent.match(/(\d+)件/);
        count.textContent = match ? `今後 ${match[1]}件` : count.textContent.replace("今後の掲載公演", "今後");
        count.dataset.compacted = "true";
      }

      if (promote) {
        promote.textContent = "最推し";
        promote.setAttribute("aria-label", "最推しにする");
      }
      if (remove) {
        remove.textContent = "解除";
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("favoriteArtistsList");
    compactArtistCards();
    if (!list) return;
    new MutationObserver(() => compactArtistCards(list)).observe(list, { childList: true, subtree: true });
  });
})();