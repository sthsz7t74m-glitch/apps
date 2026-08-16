(() => {
  "use strict";

  const D = window.YoshimotoDomain;
  const META = window.YOSHIMOTO_LIVE_META || {};
  const repo = new D.EventRepository(window.YOSHIMOTO_LIVE_ROWS || "");
  const favorites = new D.FavoriteStore();
  const time = new D.EventTimeService();
  const holidays = new D.HolidayCalendar();
  const recommendations = new D.RecommendationService(favorites, time);
  const cards = new D.EventCardRenderer(favorites, time);
  const state = { page: "list", mode: "neta", performer: "", recommendationFilter: "all" };
  const $ = (selector) => document.querySelector(selector);
  const ordinary = (event) => ["yose", "neta", "neta-corner", "conte"].includes(event.genre);
  const pad = (value) => String(Math.max(0, Number(value) || 0)).padStart(3, "0");

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function defaultFromDate() {
    const dates = repo.all().map((event) => event.date).sort();
    const first = dates[0] || "";
    const last = dates.at(-1) || "";
    const today = localDateString();
    return today >= first && today <= last ? today : first;
  }

  function formatUpdated(value) {
    if (!value) return "更新日不明";
    return String(value).replace("T", " ").replace("+09:00", "");
  }

  class DashboardRenderer {
    constructor(repository, favoriteStore, timeService, recommendationService) {
      this.repo = repository;
      this.favorites = favoriteStore;
      this.time = timeService;
      this.recommendations = recommendationService;
    }

    upcomingRecommendations() {
      return this.repo.all()
        .filter((event) => this.time.endDate(event) > new Date())
        .map((event) => this.recommendations.score(event))
        .filter(Boolean);
    }

    favoriteShows() {
      this.favorites.cleanupExpired(this.repo.all(), this.time);
      return this.repo.all()
        .filter((event) => this.favorites.isShow(event) && !this.time.isFavoriteExpired(event))
        .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    }

    render(visibleEvents) {
      const recommended = this.upcomingRecommendations();
      const favoriteShows = this.favoriteShows();
      const artistCount = this.favorites.artists.size;
      const topCount = this.favorites.topArtists.size;
      const perfectCount = recommended.filter((item) => item.score >= 100).length;

      $("#dashboardListCount").textContent = pad(visibleEvents.length);
      $("#dashboardListSub").textContent = `${visibleEvents.filter(ordinary).length}件がネタ中心`;
      $("#dashboardRecommendationCount").textContent = pad(recommended.length);
      $("#dashboardRecommendationSub").textContent = perfectCount ? `100点が${perfectCount}件` : "お気に入りから算出";
      $("#favoriteShowCount").textContent = pad(favoriteShows.length);
      $("#dashboardShowSub").textContent = favoriteShows[0] ? `次回 ${cards.formatDate(favoriteShows[0].date).md}` : "登録中の公演なし";
      $("#favoriteArtistCount").textContent = pad(artistCount);
      $("#dashboardArtistSub").textContent = `最推し ${topCount}組`;
    }
  }

  const dashboard = new DashboardRenderer(repo, favorites, time, recommendations);
  const renderList = (element, items, emptyText, mapper = (event) => cards.render(event)) => {
    if (!element) return;
    element.innerHTML = items.length
      ? items.map(mapper).join("")
      : `<div class="empty-state"><strong>${D.esc(emptyText)}</strong></div>`;
  };

  function filtered() {
    const query = String($("#searchInput")?.value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    const venue = $("#venueFilter")?.value || "";
    const genre = $("#genreFilter")?.value || "";
    const from = $("#fromDate")?.value || "";
    const to = $("#toDate")?.value || "";
    const status = $("#statusFilter")?.value || "";
    const dayType = $("#dayTypeFilter")?.value || "";
    const maxPrice = Number($("#priceFilter")?.value || 0);
    const sort = $("#sortFilter")?.value || "date";

    return repo.all().filter((event) => {
      if (state.mode === "neta" && !ordinary(event)) return false;
      if (state.mode === "available" && event.status !== "available") return false;
      if (state.performer && !event.performers.includes(state.performer)) return false;
      if (query && !`${event.title}${event.venue}${event.area}${event.performers.join("")}`.normalize("NFKC").toLowerCase().replace(/\s+/g, "").includes(query)) return false;
      if (venue && event.venue !== venue) return false;
      if (genre && event.genre !== genre) return false;
      if (from && event.date < from) return false;
      if (to && event.date > to) return false;
      if (status && event.status !== status) return false;
      if (dayType && !holidays.matches(event.date, dayType)) return false;
      if (maxPrice && (!event.priceMin || event.priceMin > maxPrice)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "price") return (a.priceMin || 999999) - (b.priceMin || 999999);
      if (sort === "venue") return a.venue.localeCompare(b.venue, "ja");
      if (sort === "performers") return b.performers.length - a.performers.length;
      return `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
    });
  }

  function renderMain() {
    const items = filtered();
    renderList($("#liveList"), items, "条件に合う公演がありません");
    $("#visibleCount").textContent = String(items.length);
    $("#netaCount").textContent = String(items.filter(ordinary).length);
    if (items[0]) {
      const date = cards.formatDate(items[0].date);
      $("#nextDate").textContent = date.md;
      $("#nextDateSub").textContent = `${date.wd}曜 ${items[0].start}〜`;
    } else {
      $("#nextDate").textContent = "—";
      $("#nextDateSub").textContent = "該当なし";
    }
    $("#resultSummary").textContent = `${state.mode === "neta" ? "ネタ中心" : state.mode === "available" ? "販売中のみ" : "全公演"}：${items.length}件表示`;
    dashboard.render(items);
  }

  function renderShows() {
    const items = dashboard.favoriteShows();
    renderList($("#favoriteShowsList"), items, "お気に入り公演はまだありません");
  }

  function renderArtists() {
    const top = [...favorites.topArtists].sort((a, b) => a.localeCompare(b, "ja"));
    const normal = [...favorites.artists].filter((name) => !favorites.topArtists.has(name)).sort((a, b) => a.localeCompare(b, "ja"));
    const element = $("#favoriteArtistsList");
    const card = (name, isTop) => `<article class="artist-favorite-card${isTop ? " is-top-favorite" : ""}"><div><strong>${isTop ? "♥" : "★"} ${D.esc(name)}</strong><span>${isTop ? "最推し・" : ""}今後の掲載公演 ${repo.all().filter((event) => event.performers.includes(name) && time.endDate(event) > new Date()).length}件</span></div><div class="artist-card-actions">${!isTop ? `<button type="button" data-promote-artist="${D.esc(name)}">最推しにする</button>` : ""}<button type="button" data-remove-artist="${D.esc(name)}">解除</button></div></article>`;
    element.innerHTML = (top.length || normal.length)
      ? `${top.length ? `<h3 class="favorite-group-title">♥ 最推し</h3>${top.map((name) => card(name, true)).join("")}` : ""}${normal.length ? `<h3 class="favorite-group-title">★ お気に入り</h3>${normal.map((name) => card(name, false)).join("")}` : ""}`
      : `<div class="empty-state"><strong>お気に入り芸人はまだありません</strong></div>`;
  }

  function renderRecommendations() {
    let items = dashboard.upcomingRecommendations();
    if (state.recommendationFilter === "week") items = items.filter((item) => item.days <= 7);
    if (state.recommendationFilter === "many") items = items.filter((item) => item.matched.length >= 2);
    if (state.recommendationFilter === "value") items = items.filter((item) => item.event.priceMin && item.event.priceMin <= 2500);
    items.sort((a, b) => b.score - a.score || (b.top?.length || 0) - (a.top?.length || 0) || b.matched.length - a.matched.length || `${a.event.date}${a.event.start}`.localeCompare(`${b.event.date}${b.event.start}`));
    renderList($("#recommendationList"), items, "おすすめ公演はまだありません", (item) => cards.render(item.event, { recommendation: item }));
  }

  function renderPerformers() {
    const element = $("#performerChips");
    element.innerHTML = repo.performers().slice(0, 80).map((name) => `<button class="performer-chip${state.performer === name ? " is-active" : ""}" type="button" data-filter-artist="${D.esc(name)}">${D.esc(name)}</button>`).join("");
    $("#clearPerformer").hidden = !state.performer;
  }

  function updatePage() {
    ["list", "recommendations", "shows", "artists"].forEach((page) => {
      const element = $(page === "list" ? "#listPage" : page === "recommendations" ? "#recommendationsPage" : page === "shows" ? "#showsPage" : "#artistsPage");
      if (element) element.hidden = state.page !== page;
    });
    document.querySelectorAll("[data-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.page === state.page));
  }

  function renderAll() {
    renderMain();
    renderShows();
    renderArtists();
    renderRecommendations();
    renderPerformers();
    updatePage();
  }

  function preservePosition(source, action) {
    const card = source?.closest?.(".live-card");
    const eventId = card?.dataset.eventId || "";
    const oldTop = card?.getBoundingClientRect().top;
    const oldScroll = window.scrollY;
    action();
    renderAll();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const replacement = eventId
        ? [...document.querySelectorAll(".page-section:not([hidden]) .live-card")].find((element) => element.dataset.eventId === eventId)
        : null;
      if (replacement && Number.isFinite(oldTop)) window.scrollBy(0, replacement.getBoundingClientRect().top - oldTop);
      else window.scrollTo(0, oldScroll);
    }));
  }

  function init() {
    $(".version").textContent = `v${META.version || "2.6.0"}`;
    favorites.migrateShows(repo.all());
    [...new Set(repo.all().map((event) => event.venue))].sort((a, b) => a.localeCompare(b, "ja")).forEach((venue) => $("#venueFilter").insertAdjacentHTML("beforeend", `<option>${D.esc(venue)}</option>`));
    if ($("#fromDate")) $("#fromDate").value = defaultFromDate();
    const dataStatus = $("#dataStatus");
    if (dataStatus) {
      const fetched = Number(META.fetchedEventCount || repo.all().length);
      const sourceCount = Array.isArray(META.sourceSummary) ? META.sourceSummary.map(item => `${item.venue}:${item.count}件`).join(" / ") : "";
      dataStatus.textContent = `更新 ${formatUpdated(META.updatedAt)} ・ 取得範囲 ${META.coverageLabel || "未設定"} ・ ${fetched}公演${sourceCount ? ` ・ ${sourceCount}` : ""}`;
    }

    document.addEventListener("click", (event) => {
      const page = event.target.closest("[data-page]");
      if (page) { state.page = page.dataset.page; updatePage(); return; }
      const mode = event.target.closest("[data-mode]");
      if (mode) { state.mode = mode.dataset.mode; document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("is-active", button === mode)); renderMain(); return; }
      const recommendationFilter = event.target.closest("[data-recommendation-filter]");
      if (recommendationFilter) { state.recommendationFilter = recommendationFilter.dataset.recommendationFilter; document.querySelectorAll("[data-recommendation-filter]").forEach((button) => button.classList.toggle("is-active", button === recommendationFilter)); renderRecommendations(); return; }
      const showFavorite = event.target.closest("[data-show-id]");
      if (showFavorite) { const show = repo.findById(showFavorite.dataset.showId); if (show) preservePosition(showFavorite, () => favorites.toggleShow(show)); return; }
      const artist = event.target.closest("[data-artist]");
      if (artist) { preservePosition(artist, () => favorites.cycleArtist(artist.dataset.artist)); return; }
      const promote = event.target.closest("[data-promote-artist]");
      if (promote) { preservePosition(promote, () => favorites.cycleArtist(promote.dataset.promoteArtist)); return; }
      const remove = event.target.closest("[data-remove-artist]");
      if (remove) { preservePosition(remove, () => favorites.removeArtist(remove.dataset.removeArtist)); return; }
      const performer = event.target.closest("[data-filter-artist]");
      if (performer) { state.performer = state.performer === performer.dataset.filterArtist ? "" : performer.dataset.filterArtist; renderAll(); }
    });

    ["#searchInput", "#venueFilter", "#genreFilter", "#fromDate", "#toDate", "#statusFilter", "#dayTypeFilter", "#priceFilter", "#sortFilter"].forEach((selector) => $(selector)?.addEventListener("input", renderMain));
    $("#filterToggle")?.addEventListener("click", () => $("#advancedFilters")?.classList.toggle("is-open"));
    $("#clearPerformer")?.addEventListener("click", () => { state.performer = ""; renderAll(); });
    $("#resetButton")?.addEventListener("click", () => {
      ["#searchInput", "#venueFilter", "#genreFilter", "#toDate", "#statusFilter", "#dayTypeFilter", "#priceFilter"].forEach((selector) => { if ($(selector)) $(selector).value = ""; });
      if ($("#sortFilter")) $("#sortFilter").value = "date";
      if ($("#fromDate")) $("#fromDate").value = defaultFromDate();
      state.mode = "neta";
      state.performer = "";
      renderAll();
    });
    renderAll();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
