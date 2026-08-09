(() => {
  "use strict";

  const data = window.COMEDY_SHOW_CALENDAR;
  if (!data || !Array.isArray(data.broadcasts)) return;

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayNamesLong = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const favoriteStorageKey = "comedy-show-calendar-favorites-v1";
  const now = new Date();

  const elements = {
    nextOnAir: document.getElementById("nextOnAir"),
    weekLabel: document.getElementById("weekLabel"),
    previousWeekButton: document.getElementById("previousWeekButton"),
    nextWeekButton: document.getElementById("nextWeekButton"),
    weekdayTabs: document.getElementById("weekdayTabs"),
    searchInput: document.getElementById("searchInput"),
    clearSearchButton: document.getElementById("clearSearchButton"),
    mediumFilters: document.getElementById("mediumFilters"),
    genreSelect: document.getElementById("genreSelect"),
    favoriteFilterButton: document.getElementById("favoriteFilterButton"),
    resultsEyebrow: document.getElementById("resultsEyebrow"),
    resultsTitle: document.getElementById("resultsTitle"),
    resultCount: document.getElementById("resultCount"),
    programList: document.getElementById("programList"),
    emptyState: document.getElementById("emptyState"),
    resetFiltersButton: document.getElementById("resetFiltersButton"),
    watchlist: document.getElementById("watchlist"),
    detailDialog: document.getElementById("detailDialog"),
    detailContent: document.getElementById("detailContent"),
    aboutButton: document.getElementById("aboutButton"),
    aboutDialog: document.getElementById("aboutDialog"),
    updatedLabel: document.getElementById("updatedLabel"),
    toast: document.getElementById("toast")
  };

  const state = {
    weekStart: data.meta.defaultWeek,
    selectedDate: null,
    medium: "all",
    genre: "all",
    favoritesOnly: false,
    query: "",
    favorites: loadFavorites()
  };

  let toastTimer = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localTodayIso() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: data.meta.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function addDays(iso, amount) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function weekStartOf(iso) {
    const date = new Date(`${iso}T12:00:00Z`);
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  }

  function dateParts(iso) {
    const date = new Date(`${iso}T12:00:00Z`);
    return {
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      weekday: date.getUTCDay()
    };
  }

  function formatShortDate(iso) {
    const parts = dateParts(iso);
    return `${parts.month}/${parts.day}（${dayNames[parts.weekday]}）`;
  }

  function formatUpdatedAt(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: data.meta.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function sortMinutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  }

  function loadFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(favoriteStorageKey, JSON.stringify([...state.favorites]));
    } catch {
      // Favorites still work during the current session when storage is unavailable.
    }
  }

  function getAllWeekStarts() {
    return [...new Set(data.broadcasts.map(item => weekStartOf(item.date)))].sort();
  }

  const allWeekStarts = getAllWeekStarts();
  const firstWeek = allWeekStarts[0];
  const lastWeek = allWeekStarts.at(-1);

  function chooseInitialWeek() {
    const today = localTodayIso();
    const currentWeek = weekStartOf(today);
    if (currentWeek < firstWeek || currentWeek > lastWeek) return data.meta.defaultWeek;

    const currentWeekEnd = addDays(currentWeek, 6);
    const remaining = data.broadcasts.some(item => {
      const start = new Date(item.startsAt);
      return item.date >= today && item.date <= currentWeekEnd && start > now;
    });

    if (!remaining && addDays(currentWeek, 7) <= lastWeek) return addDays(currentWeek, 7);
    return currentWeek;
  }

  function populateGenres() {
    const genres = [...new Set(data.broadcasts.flatMap(item => item.genres))]
      .sort((a, b) => a.localeCompare(b, "ja"));
    elements.genreSelect.insertAdjacentHTML(
      "beforeend",
      genres.map(genre => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join("")
    );
  }

  function mediumMatches(item) {
    if (state.medium === "all") return true;
    if (state.medium === "tokyo-tv") {
      return item.media.some(medium => medium.kind === "tv-national" || medium.kind === "tv-tokyo");
    }
    return item.media.some(medium => medium.kind === state.medium);
  }

  function queryMatches(item) {
    const normalizedQuery = state.query.trim().toLocaleLowerCase("ja");
    if (!normalizedQuery) return true;
    const haystack = [
      item.title,
      item.episodeTitle,
      item.station,
      item.region,
      item.summary,
      ...item.genres,
      ...item.cast,
      ...item.media.flatMap(medium => [medium.label, medium.note])
    ].join(" ").toLocaleLowerCase("ja");
    return haystack.includes(normalizedQuery);
  }

  function getWeekItems() {
    const weekEnd = addDays(state.weekStart, 6);
    return data.broadcasts
      .filter(item => item.date >= state.weekStart && item.date <= weekEnd)
      .filter(item => !state.selectedDate || item.date === state.selectedDate)
      .filter(mediumMatches)
      .filter(item => state.genre === "all" || item.genres.includes(state.genre))
      .filter(item => !state.favoritesOnly || state.favorites.has(item.seriesId))
      .filter(queryMatches)
      .sort((a, b) => a.date.localeCompare(b.date) || sortMinutes(a.startTime) - sortMinutes(b.startTime));
  }

  function getUnfilteredDayCount(iso) {
    return data.broadcasts.filter(item => item.date === iso).length;
  }

  function renderNextOnAir() {
    const upcoming = data.broadcasts
      .filter(item => new Date(item.startsAt) > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

    if (!upcoming) {
      elements.nextOnAir.innerHTML = "<small>次の放送</small><strong>次回情報を更新待ち</strong><span>公式発表を確認</span>";
      return;
    }

    elements.nextOnAir.innerHTML = `
      <small>次の放送</small>
      <strong>${escapeHtml(upcoming.title)}</strong>
      <span>${escapeHtml(formatShortDate(upcoming.date))} ${escapeHtml(upcoming.startTime)}</span>
    `;
  }

  function renderWeekTabs() {
    const weekEnd = addDays(state.weekStart, 6);
    const startParts = dateParts(state.weekStart);
    const endParts = dateParts(weekEnd);
    elements.weekLabel.textContent = `${startParts.month}/${startParts.day} – ${endParts.month}/${endParts.day}`;
    elements.previousWeekButton.disabled = state.weekStart <= firstWeek;
    elements.nextWeekButton.disabled = state.weekStart >= lastWeek;

    const today = localTodayIso();
    elements.weekdayTabs.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const iso = addDays(state.weekStart, index);
      const parts = dateParts(iso);
      const count = getUnfilteredDayCount(iso);
      const selected = state.selectedDate === iso;
      return `
        <button class="weekday-tab${today === iso ? " is-today" : ""}" type="button"
          role="tab" data-date="${iso}" aria-selected="${selected}" aria-label="${parts.month}月${parts.day}日 ${dayNamesLong[parts.weekday]} ${count}本">
          <b>${dayNames[parts.weekday]}</b>
          <small>${parts.month}/${parts.day}</small>
          <em>${count}本</em>
        </button>
      `;
    }).join("");
  }

  function mediaPill(medium) {
    const styleClass = medium.kind === "free" ? " is-free" : medium.kind === "paid" ? " is-paid" : "";
    return `
      <a class="media-pill${styleClass}" href="${escapeHtml(medium.url)}" target="_blank" rel="noopener">
        ${escapeHtml(medium.label)}<small>${escapeHtml(medium.note)}</small>
      </a>
    `;
  }

  function programCard(item) {
    const favorite = state.favorites.has(item.seriesId);
    const isPast = new Date(item.endsAt) < now;
    const statusClass = item.status === "regular" ? "is-regular" : "is-confirmed";
    const castPreview = item.cast.slice(0, 4).join("・");
    const extraCast = item.cast.length > 4 ? ` ほか${item.cast.length - 4}名` : "";

    return `
      <article class="program-card" style="--accent:${escapeHtml(item.accent)}" data-program-id="${escapeHtml(item.id)}">
        <div class="time-block">
          <span>${escapeHtml(formatShortDate(item.date))}</span>
          <strong>${escapeHtml(item.startTime)}</strong>
          <small>${escapeHtml(item.endTime)}まで</small>
        </div>
        <div class="program-art" aria-hidden="true"><span>${escapeHtml(item.mark)}</span></div>
        <div class="program-card__body">
          <div class="card-topline">
            <span class="status-badge ${statusClass}">${escapeHtml(item.statusLabel)}</span>
            <span class="region-badge">${escapeHtml(item.region)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="episode-title">${escapeHtml(item.episodeTitle)}</p>
          <div class="media-row">${item.media.map(mediaPill).join("")}</div>
          <div class="cast-preview"><strong>出演</strong> ${escapeHtml(castPreview)}${escapeHtml(extraCast)}</div>
          <div class="card-actions">
            <button class="detail-button" type="button" data-action="detail">詳しく見る</button>
            ${isPast ? "" : '<button type="button" data-action="calendar">予定に追加</button>'}
            <a href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noopener">公式 ↗</a>
          </div>
        </div>
        <button class="favorite-button" type="button" data-action="favorite" aria-pressed="${favorite}" aria-label="${escapeHtml(item.title)}をお気に入り${favorite ? "から外す" : "に追加"}">${favorite ? "★" : "☆"}</button>
      </article>
    `;
  }

  function renderResults() {
    const items = getWeekItems();
    elements.resultCount.textContent = `${items.length}本`;

    if (state.selectedDate) {
      const parts = dateParts(state.selectedDate);
      elements.resultsEyebrow.textContent = "SELECTED DAY";
      elements.resultsTitle.textContent = `${parts.month}/${parts.day} ${dayNamesLong[parts.weekday]}`;
    } else {
      elements.resultsEyebrow.textContent = "THIS WEEK";
      elements.resultsTitle.textContent = state.favoritesOnly ? "お気に入りの番組" : "今週のネタ番組";
    }

    elements.programList.innerHTML = items.map(programCard).join("");
    elements.programList.hidden = items.length === 0;
    elements.emptyState.hidden = items.length !== 0;
  }

  function renderWatchlist() {
    elements.watchlist.innerHTML = data.watchlist.map(item => `
      <article class="watch-card" style="--accent:${escapeHtml(item.accent)}">
        <div class="watch-card__top">
          <span>${escapeHtml(item.mark)}</span>
          <span class="watch-status">${escapeHtml(item.status)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>前回 ${escapeHtml(item.lastAired.replaceAll("-", "."))} ・ ${escapeHtml(item.media.join(" / "))}</p>
        <p class="watch-cast"><strong>出演</strong> ${escapeHtml(item.cast.slice(0, 3).join("・"))}${item.cast.length > 3 ? " ほか" : ""}</p>
        <div class="watchlist-tags">${item.genres.map(genre => `<span>${escapeHtml(genre)}</span>`).join("")}</div>
        <a href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noopener">公式で次回を確認 ↗</a>
      </article>
    `).join("");
  }

  function renderFavoriteControls() {
    elements.favoriteFilterButton.setAttribute("aria-pressed", String(state.favoritesOnly));
  }

  function render() {
    renderWeekTabs();
    renderResults();
    renderFavoriteControls();
  }

  function openDetail(item) {
    const mediaLinks = item.media.map(mediaPill).join("");
    elements.detailContent.innerHTML = `
      <div class="detail-hero" style="--accent:${escapeHtml(item.accent)}">
        <button class="detail-close" type="button" data-close-detail aria-label="閉じる">×</button>
        <span>${escapeHtml(item.statusLabel)}</span>
        <h2 id="detailTitle">${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(formatShortDate(item.date))} ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)} ・ ${escapeHtml(item.station)}</p>
      </div>
      <div class="detail-body">
        <p><strong>${escapeHtml(item.episodeTitle)}</strong><br>${escapeHtml(item.summary)}</p>
        <div class="detail-block">
          <h3>WHERE TO WATCH</h3>
          <div class="detail-media media-row">${mediaLinks}</div>
        </div>
        <div class="detail-block">
          <h3>CAST</h3>
          <div class="detail-cast">${item.cast.map(person => `<span>${escapeHtml(person)}</span>`).join("")}</div>
        </div>
        <div class="detail-block">
          <h3>STYLE</h3>
          <div class="genre-row">${item.genres.map(genre => `<span>${escapeHtml(genre)}</span>`).join("")}</div>
        </div>
        <div class="detail-actions">
          <a href="${escapeHtml(item.officialUrl)}" target="_blank" rel="noopener">番組公式へ ↗</a>
          <button type="button" data-detail-calendar="${escapeHtml(item.id)}">予定に追加</button>
        </div>
        <a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">掲載情報の確認元 ↗</a>
      </div>
    `;
    if (typeof elements.detailDialog.showModal === "function") elements.detailDialog.showModal();
    else elements.detailDialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function toggleFavorite(item) {
    if (state.favorites.has(item.seriesId)) {
      state.favorites.delete(item.seriesId);
      showToast(`${item.title}をお気に入りから外しました`);
    } else {
      state.favorites.add(item.seriesId);
      showToast(`${item.title}をお気に入りに追加しました`);
    }
    saveFavorites();
    renderResults();
  }

  function compactLocalDate(isoDateTime) {
    return isoDateTime.slice(0, 19).replaceAll("-", "").replaceAll(":", "");
  }

  function compactUtcDate(date) {
    return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  }

  function escapeIcs(value) {
    return String(value)
      .replaceAll("\\", "\\\\")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replaceAll("\n", "\\n");
  }

  function downloadCalendar(item) {
    const description = [
      item.episodeTitle,
      `${item.station}（${item.region}）`,
      `出演: ${item.cast.join("、")}`,
      item.officialUrl
    ].join("\n");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Comedy Show Calendar//JP",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${escapeIcs(item.id)}@comedy-show-calendar`,
      `DTSTAMP:${compactUtcDate(new Date())}`,
      `DTSTART;TZID=${data.meta.timezone}:${compactLocalDate(item.startsAt)}`,
      `DTEND;TZID=${data.meta.timezone}:${compactLocalDate(item.endsAt)}`,
      `SUMMARY:${escapeIcs(item.title)}`,
      `LOCATION:${escapeIcs(item.station)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `URL:${escapeIcs(item.officialUrl)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.date}-${item.seriesId}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("カレンダー用ファイルを作成しました");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
  }

  function resetFilters() {
    state.selectedDate = null;
    state.medium = "all";
    state.genre = "all";
    state.favoritesOnly = false;
    state.query = "";
    elements.searchInput.value = "";
    elements.clearSearchButton.hidden = true;
    elements.genreSelect.value = "all";
    elements.mediumFilters.querySelectorAll("button").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.medium === "all"));
    });
    render();
  }

  function changeWeek(amount) {
    const next = addDays(state.weekStart, amount * 7);
    if (next < firstWeek || next > lastWeek) return;
    state.weekStart = next;
    state.selectedDate = null;
    render();
    document.querySelector(".week-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  elements.previousWeekButton.addEventListener("click", () => changeWeek(-1));
  elements.nextWeekButton.addEventListener("click", () => changeWeek(1));

  elements.weekdayTabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-date]");
    if (!button) return;
    state.selectedDate = state.selectedDate === button.dataset.date ? null : button.dataset.date;
    render();
  });

  elements.searchInput.addEventListener("input", event => {
    state.query = event.target.value;
    elements.clearSearchButton.hidden = state.query.length === 0;
    renderResults();
  });

  elements.clearSearchButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    state.query = "";
    elements.clearSearchButton.hidden = true;
    elements.searchInput.focus();
    renderResults();
  });

  elements.mediumFilters.addEventListener("click", event => {
    const button = event.target.closest("button[data-medium]");
    if (!button) return;
    state.medium = button.dataset.medium;
    elements.mediumFilters.querySelectorAll("button").forEach(candidate => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    renderResults();
  });

  elements.genreSelect.addEventListener("change", event => {
    state.genre = event.target.value;
    renderResults();
  });

  elements.favoriteFilterButton.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    render();
  });

  elements.programList.addEventListener("click", event => {
    const card = event.target.closest("[data-program-id]");
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!card || !action) return;
    const item = data.broadcasts.find(candidate => candidate.id === card.dataset.programId);
    if (!item) return;
    if (action === "detail") openDetail(item);
    if (action === "favorite") toggleFavorite(item);
    if (action === "calendar") downloadCalendar(item);
  });

  elements.detailContent.addEventListener("click", event => {
    if (event.target.closest("[data-close-detail]")) {
      closeDialog(elements.detailDialog);
      return;
    }
    const calendarButton = event.target.closest("[data-detail-calendar]");
    if (!calendarButton) return;
    const item = data.broadcasts.find(candidate => candidate.id === calendarButton.dataset.detailCalendar);
    if (item) downloadCalendar(item);
  });

  elements.detailDialog.addEventListener("click", event => {
    if (event.target === elements.detailDialog) closeDialog(elements.detailDialog);
  });

  elements.resetFiltersButton.addEventListener("click", resetFilters);

  elements.aboutButton.addEventListener("click", () => {
    if (typeof elements.aboutDialog.showModal === "function") elements.aboutDialog.showModal();
    else elements.aboutDialog.setAttribute("open", "");
  });

  elements.aboutDialog.addEventListener("click", event => {
    if (event.target === elements.aboutDialog || event.target.closest("[data-close-about]")) {
      closeDialog(elements.aboutDialog);
    }
  });

  state.weekStart = chooseInitialWeek();
  elements.updatedLabel.textContent = `データ更新 ${formatUpdatedAt(data.meta.updatedAt)} ・ ${data.meta.note}`;
  populateGenres();
  renderNextOnAir();
  renderWatchlist();
  render();
})();
