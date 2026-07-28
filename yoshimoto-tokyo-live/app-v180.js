(() => {
  "use strict";

  const VERSION = "1.8.1";
  const SHOW_KEY = "yoshimotoFavoriteShowsV2";
  const ARTIST_KEY = "yoshimotoFavoriteArtistsV2";
  const raw = window.YOSHIMOTO_LIVE_ROWS || "";

  const genreLabels = {
    yose: "寄席・ネタ",
    neta: "ネタライブ",
    "neta-corner": "ネタ＋コーナー",
    project: "企画ライブ"
  };

  const ordinaryGenres = new Set(["yose", "neta", "neta-corner", "conte"]);

  const safeStorage = {
    get(key) {
      try {
        const value = window.localStorage.getItem(key);
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.warn("お気に入りの読み込みに失敗しました", error);
        return [];
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.warn("お気に入りの保存に失敗しました", error);
        return false;
      }
    }
  };

  const events = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|");
      const [date = "", open = "", start = "", venue = "", area = "", title = "", genre = "", status = "", priceMin = "", priceText = "", performers = "", url = ""] = parts;
      return {
        id: `${date}|${start}|${title}|${index}`,
        date,
        open,
        start,
        venue,
        area,
        title,
        genre,
        status,
        priceMin: Number(priceMin) || 0,
        priceText,
        performers: performers.split("／").map((name) => name.trim()).filter(Boolean),
        url,
        ordinary: ordinaryGenres.has(genre)
      };
    })
    .filter((event) => event.date && event.start && event.title);

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));

  let favoriteShows = new Set(safeStorage.get(SHOW_KEY));
  let favoriteArtists = new Set(safeStorage.get(ARTIST_KEY));

  const state = { page: "list", mode: "neta", performer: "" };
  let elements = null;

  function saveFavorites() {
    safeStorage.set(SHOW_KEY, [...favoriteShows]);
    safeStorage.set(ARTIST_KEY, [...favoriteArtists]);
  }

  function durationMinutes(event) {
    if (/ルミネ|特別公演|寄席/.test(`${event.title}${event.venue}`)) return 110;
    if (/マンゲキお笑いライブ|お盆SP/.test(event.title)) return 75;
    return 60;
  }

  function addMinutes(time, minutes) {
    const [hours, mins] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "--:--";
    const total = hours * 60 + mins + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function eventEndDate(event) {
    const end = addMinutes(event.start, durationMinutes(event));
    const date = new Date(`${event.date}T${end}:00+09:00`);
    return Number.isNaN(date.getTime()) ? new Date(8640000000000000) : date;
  }

  function cleanupExpiredFavorites() {
    const now = new Date();
    const validIds = new Set(events.filter((event) => eventEndDate(event) > now).map((event) => event.id));
    const cleaned = new Set([...favoriteShows].filter((id) => validIds.has(id)));
    if (cleaned.size !== favoriteShows.size) {
      favoriteShows = cleaned;
      saveFavorites();
    }
  }

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return {
      monthDay: `${month}/${day}`,
      weekday: "日月火水木金土"[date.getDay()] || "-"
    };
  }

  function normalize(value) {
    try {
      return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    } catch {
      return String(value || "").toLowerCase().replace(/\s+/g, "");
    }
  }

  function favoriteArtistNames(event) {
    return event.performers.filter((name) => favoriteArtists.has(name));
  }

  function performerButton(name) {
    const favorite = favoriteArtists.has(name);
    return `<button class="performer-button${favorite ? " is-favorite" : ""}" type="button" data-artist="${esc(name)}">${favorite ? "★" : "☆"} ${esc(name)}</button>`;
  }

  function cardHtml(event) {
    const date = formatDate(event.date);
    const end = addMinutes(event.start, durationMinutes(event));
    const favorites = favoriteArtistNames(event);
    const first = event.performers.slice(0, 6);
    const rest = event.performers.slice(6);
    const showFavorite = favoriteShows.has(event.id);

    return `
      <article class="live-card" data-event-id="${esc(event.id)}">
        <button class="show-favorite${showFavorite ? " is-favorite" : ""}" type="button" data-show-id="${esc(event.id)}" aria-label="公演のお気に入りを切り替える">${showFavorite ? "★" : "☆"}</button>
        <div class="date-panel">
          <div class="event-date-layout">
            <div class="event-date-left"><strong>${date.monthDay}</strong><span>(${date.weekday})</span></div>
            <div class="event-date-divider" aria-hidden="true"></div>
            <div class="event-time-list">
              <div class="event-time-row"><span class="event-time-icon">◷</span><span class="event-time-label">開場</span><strong>${esc(event.open)}</strong></div>
              <div class="event-time-row"><span class="event-time-icon">●</span><span class="event-time-label">開演</span><strong>${esc(event.start)}</strong></div>
              <div class="event-time-row end-row"><span class="event-time-icon">◴</span><span class="event-time-label">終演</span><strong>${end}</strong></div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-topline">
            <span class="badge genre">${esc(genreLabels[event.genre] || "お笑いライブ")}</span>
            <span class="badge available">○ ${event.status === "available" ? "販売中" : "公式確認"}</span>
            ${favorites.length ? `<span class="badge favorite-artist-mark">★ お気に入り芸人 ${favorites.length}組</span>` : ""}
          </div>
          <h2>${esc(event.title)}</h2>
          <div class="meta-line"><span>📍 ${esc(event.area)}・${esc(event.venue)}</span><span>🎫 ${esc(event.priceText)}</span></div>
          <div class="performers-preview">${first.map(performerButton).join("")}</div>
          ${rest.length ? `<details class="performer-details"><summary>ほか ${rest.length}組を見る</summary><div class="performers-preview">${rest.map(performerButton).join("")}</div></details>` : ""}
          <div class="card-actions"><span class="availability-note">終演は公演形式から算出した予定時刻</span><a class="official-link" href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">空席・購入を見る →</a></div>
        </div>
      </article>`;
  }

  function renderEventList(container, rows, emptyText) {
    if (!container) return;
    container.innerHTML = rows.length
      ? rows.map(cardHtml).join("")
      : `<div class="empty-state"><strong>${esc(emptyText)}</strong></div>`;
  }

  function getTopPerformers() {
    const count = new Map();
    events.filter((event) => event.ordinary).forEach((event) => {
      event.performers.forEach((name) => count.set(name, (count.get(name) || 0) + 1));
    });
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 18)
      .map(([name]) => name);
  }

  function getFilteredEvents() {
    const query = normalize(elements.search?.value);
    const maxPrice = Number(elements.price?.value || 0);
    return events.filter((event) => {
      if (state.mode === "neta" && !event.ordinary) return false;
      if (state.mode === "available" && event.status !== "available") return false;
      if (state.performer && !event.performers.includes(state.performer)) return false;
      if (query && !normalize([event.title, event.venue, event.area, ...event.performers].join(" ")).includes(query)) return false;
      if (elements.venue?.value && event.venue !== elements.venue.value) return false;
      if (elements.genre?.value && event.genre !== elements.genre.value) return false;
      if (elements.from?.value && event.date < elements.from.value) return false;
      if (elements.to?.value && event.date > elements.to.value) return false;
      if (elements.status?.value && event.status !== elements.status.value) return false;
      if (maxPrice && (!event.priceMin || event.priceMin > maxPrice)) return false;
      return true;
    }).sort((a, b) => {
      if (elements.sort?.value === "price") return (a.priceMin || 999999) - (b.priceMin || 999999) || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
      if (elements.sort?.value === "venue") return a.venue.localeCompare(b.venue, "ja") || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
      if (elements.sort?.value === "performers") return b.performers.length - a.performers.length || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
      return `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
    });
  }

  function renderMainList() {
    const rows = getFilteredEvents();
    renderEventList(elements.list, rows, "条件に合う公演がありません");
    if (elements.visibleCount) elements.visibleCount.textContent = String(rows.length);
    if (elements.netaCount) elements.netaCount.textContent = String(rows.filter((event) => event.ordinary).length);
    if (rows[0]) {
      const date = formatDate(rows[0].date);
      if (elements.nextDate) elements.nextDate.textContent = date.monthDay;
      if (elements.nextDateSub) elements.nextDateSub.textContent = `${date.weekday}曜 ${rows[0].start}〜`;
    } else {
      if (elements.nextDate) elements.nextDate.textContent = "—";
      if (elements.nextDateSub) elements.nextDateSub.textContent = "該当なし";
    }
    if (elements.resultSummary) {
      const label = state.mode === "neta" ? "ネタ中心" : state.mode === "available" ? "販売中のみ" : "全公演";
      elements.resultSummary.textContent = `${label}：${rows.length}件表示`;
    }
  }

  function renderFavoriteShowsPage() {
    cleanupExpiredFavorites();
    const now = new Date();
    const rows = events
      .filter((event) => favoriteShows.has(event.id) && eventEndDate(event) > now)
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    renderEventList(elements.favShowsList, rows, "お気に入り公演はまだありません");
    if (elements.showCount) elements.showCount.textContent = String(rows.length);
  }

  function renderFavoriteArtistsPage() {
    const artists = [...favoriteArtists].sort((a, b) => a.localeCompare(b, "ja"));
    if (elements.favArtistsList) {
      elements.favArtistsList.innerHTML = artists.length
        ? artists.map((name) => {
            const upcoming = events.filter((event) => event.performers.includes(name) && eventEndDate(event) > new Date()).length;
            return `<article class="artist-favorite-card"><div><strong>★ ${esc(name)}</strong><span>今後の掲載公演 ${upcoming}件</span></div><button type="button" data-remove-artist="${esc(name)}">解除</button></article>`;
          }).join("")
        : `<div class="empty-state"><strong>お気に入り芸人はまだありません</strong><p>公演カードの出演者名をタップすると登録できます。</p></div>`;
    }
    if (elements.artistCount) elements.artistCount.textContent = String(artists.length);
  }

  function renderPerformerChips() {
    if (!elements.performerChips) return;
    elements.performerChips.innerHTML = getTopPerformers().map((name) =>
      `<button class="performer-chip${state.performer === name ? " is-active" : ""}" type="button" data-filter-artist="${esc(name)}">${esc(name)}</button>`
    ).join("");
    if (elements.clearPerformer) elements.clearPerformer.hidden = !state.performer;
  }

  function updatePage() {
    if (elements.listPage) elements.listPage.hidden = state.page !== "list";
    if (elements.showsPage) elements.showsPage.hidden = state.page !== "shows";
    if (elements.artistsPage) elements.artistsPage.hidden = state.page !== "artists";
    document.querySelectorAll("[data-page]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.page === state.page);
    });
  }

  function renderAll() {
    renderMainList();
    renderFavoriteShowsPage();
    renderFavoriteArtistsPage();
    renderPerformerChips();
    updatePage();
  }

  function resetFilters() {
    if (elements.search) elements.search.value = "";
    if (elements.venue) elements.venue.value = "";
    if (elements.genre) elements.genre.value = "";
    if (elements.from) elements.from.value = events[0]?.date || "";
    if (elements.to) elements.to.value = "";
    if (elements.status) elements.status.value = "";
    if (elements.price) elements.price.value = "";
    if (elements.sort) elements.sort.value = "date";
    state.mode = "neta";
    state.performer = "";
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === "neta");
    });
    renderAll();
  }

  function initialize() {
    elements = {
      pageTabs: $("#pageTabs"), listPage: $("#listPage"), showsPage: $("#showsPage"), artistsPage: $("#artistsPage"),
      list: $("#liveList"), favShowsList: $("#favoriteShowsList"), favArtistsList: $("#favoriteArtistsList"),
      search: $("#searchInput"), venue: $("#venueFilter"), genre: $("#genreFilter"), from: $("#fromDate"), to: $("#toDate"),
      status: $("#statusFilter"), price: $("#priceFilter"), sort: $("#sortFilter"), filterToggle: $("#filterToggle"),
      advanced: $("#advancedFilters"), resultSummary: $("#resultSummary"), visibleCount: $("#visibleCount"), netaCount: $("#netaCount"),
      nextDate: $("#nextDate"), nextDateSub: $("#nextDateSub"), reset: $("#resetButton"), performerChips: $("#performerChips"),
      clearPerformer: $("#clearPerformer"), showCount: $("#favoriteShowCount"), artistCount: $("#favoriteArtistCount")
    };

    const version = document.querySelector(".version");
    if (version) version.textContent = `v${VERSION}`;

    if (!elements.list || !elements.pageTabs) {
      throw new Error("必須の画面要素が見つかりません");
    }

    [...new Set(events.map((event) => event.venue))]
      .sort((a, b) => a.localeCompare(b, "ja"))
      .forEach((venue) => {
        if (!elements.venue) return;
        const option = document.createElement("option");
        option.value = venue;
        option.textContent = venue;
        elements.venue.append(option);
      });

    if (elements.from) elements.from.value = events[0]?.date || "";

    elements.pageTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      state.page = button.dataset.page;
      updatePage();
    });

    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        renderMainList();
      });
    });

    [elements.search, elements.venue, elements.genre, elements.from, elements.to, elements.status, elements.price, elements.sort]
      .filter(Boolean)
      .forEach((control) => control.addEventListener("input", renderMainList));

    elements.filterToggle?.addEventListener("click", () => elements.advanced?.classList.toggle("is-open"));
    elements.reset?.addEventListener("click", resetFilters);
    elements.clearPerformer?.addEventListener("click", () => {
      state.performer = "";
      renderAll();
    });
    elements.performerChips?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter-artist]");
      if (!button) return;
      state.performer = state.performer === button.dataset.filterArtist ? "" : button.dataset.filterArtist;
      renderAll();
    });

    document.body.addEventListener("click", (event) => {
      const showButton = event.target.closest("[data-show-id]");
      if (showButton) {
        const id = showButton.dataset.showId;
        favoriteShows.has(id) ? favoriteShows.delete(id) : favoriteShows.add(id);
        saveFavorites();
        renderAll();
        return;
      }

      const artistButton = event.target.closest("[data-artist]");
      if (artistButton) {
        const name = artistButton.dataset.artist;
        favoriteArtists.has(name) ? favoriteArtists.delete(name) : favoriteArtists.add(name);
        saveFavorites();
        renderAll();
        return;
      }

      const removeButton = event.target.closest("[data-remove-artist]");
      if (removeButton) {
        favoriteArtists.delete(removeButton.dataset.removeArtist);
        saveFavorites();
        renderAll();
      }
    });

    cleanupExpiredFavorites();
    renderAll();
  }

  function showStartupError(error) {
    console.error(error);
    const main = document.querySelector("main") || document.body;
    const box = document.createElement("section");
    box.style.cssText = "margin:16px;padding:18px;border-radius:16px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;font-weight:700;line-height:1.6";
    box.innerHTML = `<strong>公演データの読み込みに失敗しました</strong><br><small>${esc(error?.message || "不明なエラー")}</small>`;
    main.prepend(box);
  }

  window.addEventListener("DOMContentLoaded", () => {
    try {
      initialize();
    } catch (error) {
      showStartupError(error);
    }
  });
})();
