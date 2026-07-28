(() => {
  "use strict";

  const ARTIST_KEY = "yoshimotoFavoriteArtistsV2";
  const raw = window.YOSHIMOTO_LIVE_ROWS || "";
  let activeFilter = "all";

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));

  function loadFavoriteArtists() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ARTIST_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function addMinutes(time, minutes) {
    const [h, m] = String(time).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return "--:--";
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function duration(event) {
    if (/ルミネ|特別公演|寄席/.test(`${event.title}${event.venue}`)) return 110;
    if (/マンゲキお笑いライブ|お盆SP/.test(event.title)) return 75;
    return 60;
  }

  function parseEvents() {
    return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const [date="", open="", start="", venue="", area="", title="", genre="", status="", priceMin="", priceText="", performers="", url=""] = line.split("|");
      return {
        id: `${date}|${start}|${title}|${index}`,
        date, open, start, venue, area, title, genre, status,
        priceMin: Number(priceMin) || 0,
        priceText,
        performers: performers.split("／").map(v => v.trim()).filter(Boolean),
        url
      };
    }).filter(event => event.date && event.start && event.title);
  }

  function eventDate(event) {
    return new Date(`${event.date}T${event.start}:00+09:00`);
  }

  function scoreEvent(event, favoriteArtists) {
    const matched = event.performers.filter(name => favoriteArtists.has(name));
    if (!matched.length) return null;

    const now = new Date();
    const days = Math.max(0, Math.ceil((eventDate(event) - now) / 86400000));
    let score = Math.min(70, matched.length * 20);
    const reasons = [`お気に入り芸人${matched.length}組出演`];

    if (["yose", "neta", "neta-corner", "conte"].includes(event.genre)) {
      score += 10;
      reasons.push("ネタ中心の公演");
    }
    if (event.status === "available") {
      score += 10;
      reasons.push("販売中");
    }
    if (days <= 7) {
      score += 10;
      reasons.push("今週開催");
    }
    if (event.priceMin && event.priceMin <= 2500) {
      score += 5;
      reasons.push("2,500円以下");
    }

    return { event, matched, score: Math.min(100, score), reasons, days };
  }

  function formatDate(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${m}/${d}（${"日月火水木金土"[date.getDay()]}）`;
  }

  function recommendationHtml(item) {
    const { event, matched, score, reasons } = item;
    const end = addMinutes(event.start, duration(event));
    return `<article class="recommendation-card">
      <div class="recommendation-head">
        <div><h3>${esc(event.title)}</h3></div>
        <div class="recommendation-score"><strong>${score}</strong>点</div>
      </div>
      <div class="recommendation-meta">
        <span>📅 ${formatDate(event.date)}</span>
        <span>🕒 ${esc(event.start)}〜${esc(end)}</span>
        <span>📍 ${esc(event.area)}・${esc(event.venue)}</span>
        <span>🎫 ${esc(event.priceText)}</span>
      </div>
      <div class="recommendation-artists">${matched.map(name => `<span>★ ${esc(name)}</span>`).join("")}</div>
      <div class="recommendation-reasons">${reasons.map(reason => `<span class="recommendation-reason">${esc(reason)}</span>`).join("")}</div>
      <a class="official-link" href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">空席・購入を見る →</a>
    </article>`;
  }

  function renderRecommendations() {
    const container = document.getElementById("recommendationList");
    if (!container) return;
    const favoriteArtists = loadFavoriteArtists();
    const now = new Date();
    let items = parseEvents()
      .filter(event => eventDate(event) > now)
      .map(event => scoreEvent(event, favoriteArtists))
      .filter(Boolean);

    if (activeFilter === "week") items = items.filter(item => item.days <= 7);
    if (activeFilter === "many") items = items.filter(item => item.matched.length >= 2);
    if (activeFilter === "value") items = items.filter(item => item.event.priceMin && item.event.priceMin <= 2500);

    items.sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || `${a.event.date}${a.event.start}`.localeCompare(`${b.event.date}${b.event.start}`));
    container.innerHTML = items.length
      ? items.map(recommendationHtml).join("")
      : `<div class="recommendation-empty"><strong>おすすめ公演はまだありません</strong><p>お気に入り芸人を登録すると、出演数・販売状況・日程からおすすめを作ります。</p></div>`;
  }

  function setRecommendationPageVisible(visible) {
    const page = document.getElementById("recommendationsPage");
    if (page) page.hidden = !visible;
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      const isRecommendations = pageButton.dataset.page === "recommendations";
      setRecommendationPageVisible(isRecommendations);
      if (isRecommendations) renderRecommendations();
    }

    const filter = event.target.closest("[data-recommendation-filter]");
    if (filter) {
      activeFilter = filter.dataset.recommendationFilter;
      document.querySelectorAll("[data-recommendation-filter]").forEach(button => button.classList.toggle("is-active", button === filter));
      renderRecommendations();
    }

    if (event.target.closest("[data-artist], [data-remove-artist]")) {
      requestAnimationFrame(renderRecommendations);
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    renderRecommendations();
  });
})();