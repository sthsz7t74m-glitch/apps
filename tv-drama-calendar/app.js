(() => {
  "use strict";

  const data = window.DRAMA_CALENDAR;
  if (!data || !Array.isArray(data.dramas)) return;

  const dayNames = ["月", "火", "水", "木", "金", "土", "日"];
  const dayNamesLong = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"];
  const dayNamesEnglish = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const stationByKey = new Map(data.stations.map(station => [station.key, station]));

  const elements = {
    updateLabel: document.getElementById("updateLabel"),
    weekLabel: document.getElementById("weekLabel"),
    weekdayTabs: document.getElementById("weekdayTabs"),
    allDaysButton: document.getElementById("allDaysButton"),
    stationFilterButton: document.getElementById("stationFilterButton"),
    stationFilterLabel: document.getElementById("stationFilterLabel"),
    sortButton: document.getElementById("sortButton"),
    sortLabel: document.getElementById("sortLabel"),
    activeFilters: document.getElementById("activeFilters"),
    resultEyebrow: document.getElementById("resultEyebrow"),
    resultTitle: document.getElementById("resultTitle"),
    resultCount: document.getElementById("resultCount"),
    dramaList: document.getElementById("dramaList"),
    emptyState: document.getElementById("emptyState"),
    emptyResetButton: document.getElementById("emptyResetButton"),
    stationDialog: document.getElementById("stationDialog"),
    stationOptions: document.getElementById("stationOptions"),
    selectAllStationsButton: document.getElementById("selectAllStationsButton"),
    applyStationsButton: document.getElementById("applyStationsButton"),
    aboutButton: document.getElementById("aboutButton"),
    aboutDialog: document.getElementById("aboutDialog"),
    primarySourceLink: document.getElementById("primarySourceLink"),
    editorialSourceLink: document.getElementById("editorialSourceLink")
  };

  const todayIso = getJstIsoDate();
  const todayIndex = data.meta.weekDates.findIndex(date => date.iso === todayIso);
  const updateDayIndex = data.meta.weekDates.findIndex(date => date.iso === data.meta.updatedAt);
  const initialDay = todayIndex >= 0 ? todayIndex : updateDayIndex >= 0 ? updateDayIndex : 0;

  const state = {
    selectedDay: initialDay,
    allDays: false,
    selectedStations: new Set(data.stations.map(station => station.key)),
    sortDirection: "asc"
  };

  function getJstIsoDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(iso) {
    const [, month, day] = iso.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  function timeLabel(drama) {
    const [rawHour, minute] = drama.time.split(":").map(Number);
    if (rawHour < 24) return drama.time;
    return `深夜${rawHour - 24}:${String(minute).padStart(2, "0")}`;
  }

  function episodeMarkup(drama) {
    const weekDate = data.meta.weekDates[drama.day].iso;
    const total = drama.totalEpisodes ? `全${drama.totalEpisodes}話` : drama.episodeNote || "全話数未発表";

    if (drama.startDate > weekDate) {
      return {
        badge: `${formatDate(drama.startDate)} START`,
        detail: total,
        upcoming: true
      };
    }

    return {
      badge: drama.episode ? `今週 第${drama.episode}話` : "今週 放送",
      detail: total,
      upcoming: false
    };
  }

  function filteredDramas() {
    return data.dramas.filter(drama => {
      const dayMatches = state.allDays || drama.day === state.selectedDay;
      return dayMatches && state.selectedStations.has(drama.stationKey);
    });
  }

  function sortedDramas(dramas) {
    const direction = state.sortDirection === "asc" ? 1 : -1;
    return [...dramas].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.minutes !== b.minutes) return (a.minutes - b.minutes) * direction;
      return a.title.localeCompare(b.title, "ja");
    });
  }

  function renderWeekdayTabs() {
    elements.weekdayTabs.innerHTML = data.meta.weekDates.map((date, index) => {
      const selected = !state.allDays && state.selectedDay === index;
      const todayClass = date.iso === todayIso ? " is-today" : "";
      return `
        <button
          class="weekday-tab${todayClass}"
          type="button"
          role="tab"
          data-day="${index}"
          aria-selected="${selected}"
          aria-label="${dayNamesLong[index]} ${date.label}"
        >
          <b>${dayNames[index]}</b><small>${date.label}</small>
        </button>`;
    }).join("");
    elements.allDaysButton.setAttribute("aria-pressed", String(state.allDays));
    elements.allDaysButton.textContent = state.allDays ? "曜日を選ぶ" : "全曜日を見る";
  }

  function renderStationOptions() {
    elements.stationOptions.innerHTML = data.stations.map(station => `
      <div class="station-option" style="--station-color:${station.color}">
        <input
          id="station-${station.key}"
          type="checkbox"
          value="${station.key}"
          ${state.selectedStations.has(station.key) ? "checked" : ""}
        >
        <label for="station-${station.key}">${escapeHtml(station.label)}</label>
      </div>`).join("");
  }

  function renderActiveFilters() {
    const selectedCount = state.selectedStations.size;
    elements.stationFilterLabel.textContent = selectedCount === data.stations.length
      ? "すべて"
      : selectedCount === 0
        ? "未選択"
        : `${selectedCount}局を選択`;

    if (selectedCount === data.stations.length) {
      elements.activeFilters.innerHTML = "";
      return;
    }

    elements.activeFilters.innerHTML = [...state.selectedStations].map(key => {
      const station = stationByKey.get(key);
      return `<button class="filter-chip" type="button" data-remove-station="${key}" aria-label="${escapeHtml(station.label)}を解除">${escapeHtml(station.label)}</button>`;
    }).join("");
  }

  function cardMarkup(drama) {
    const station = stationByKey.get(drama.stationKey);
    const episode = episodeMarkup(drama);
    const isToday = data.meta.weekDates[drama.day].iso === todayIso;
    const sourceUrl = drama.officialUrl || data.meta.sourceUrl;
    const sourceLabel = drama.officialUrl ? "公式" : "作品情報";

    return `
      <article class="drama-card${episode.upcoming ? " is-upcoming" : ""}" aria-labelledby="title-${drama.id}">
        ${isToday ? '<span class="today-badge">本日</span>' : ""}
        <div
          class="cover-art"
          style="--accent:${drama.accent};--accent-2:${drama.accent2}"
          role="img"
          aria-label="${escapeHtml(drama.title)}のオリジナルカバーアート"
        >
          <span class="cover-art__genre">${escapeHtml(drama.genre)}</span>
          <strong class="cover-art__icon">${escapeHtml(drama.icon)}</strong>
          <span class="cover-art__title">${escapeHtml(drama.title)}</span>
        </div>
        <div class="drama-card__body">
          <div class="drama-card__meta" style="--station-color:${station.color}">
            <span class="time-badge">${escapeHtml(timeLabel(drama))}</span>
            <span class="station-badge" title="${escapeHtml(drama.station)}">${escapeHtml(drama.station)}</span>
            <a class="official-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" aria-label="${escapeHtml(drama.title)}の${sourceLabel}を開く">${sourceLabel}↗</a>
          </div>
          <h3 id="title-${drama.id}">${escapeHtml(drama.title)}</h3>
          <div class="episode-row">
            <span class="episode-badge${episode.upcoming ? " is-upcoming" : ""}">${escapeHtml(episode.badge)}</span>
            <span>${escapeHtml(episode.detail)}</span>
          </div>
          <p class="cast-line"><span>出演</span> ${escapeHtml(drama.cast.join("・"))}</p>
          <p class="summary">${escapeHtml(drama.summary)}</p>
        </div>
      </article>`;
  }

  function renderResults() {
    const dramas = sortedDramas(filteredDramas());
    elements.resultCount.textContent = `${dramas.length}作品`;
    elements.emptyState.hidden = dramas.length !== 0;
    elements.dramaList.hidden = dramas.length === 0;

    if (state.allDays) {
      elements.resultEyebrow.textContent = "WEEKLY LINEUP";
      elements.resultTitle.textContent = "全曜日のドラマ";
      const groups = dayNames.map((_, day) => dramas.filter(drama => drama.day === day));
      elements.dramaList.innerHTML = groups.map((group, day) => {
        if (!group.length) return "";
        return `
          <section class="day-group" aria-labelledby="group-day-${day}">
            <div class="day-group__head">
              <h3 id="group-day-${day}">${dayNamesLong[day]}</h3>
              <span>${data.meta.weekDates[day].label}・${group.length}作品</span>
            </div>
            ${group.map(cardMarkup).join("")}
          </section>`;
      }).join("");
      return;
    }

    elements.resultEyebrow.textContent = dayNamesEnglish[state.selectedDay];
    elements.resultTitle.textContent = `${dayNamesLong[state.selectedDay]}のドラマ`;
    elements.dramaList.innerHTML = dramas.map(cardMarkup).join("");
  }

  function renderSort() {
    const descending = state.sortDirection === "desc";
    elements.sortLabel.textContent = descending ? "遅い順" : "早い順";
    elements.sortButton.setAttribute("aria-pressed", String(descending));
  }

  function render() {
    renderWeekdayTabs();
    renderActiveFilters();
    renderSort();
    renderResults();
  }

  elements.weekdayTabs.addEventListener("click", event => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    state.selectedDay = Number(button.dataset.day);
    state.allDays = false;
    render();
    elements.resultTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.allDaysButton.addEventListener("click", () => {
    state.allDays = !state.allDays;
    render();
  });

  elements.sortButton.addEventListener("click", () => {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    render();
  });

  elements.stationFilterButton.addEventListener("click", () => {
    renderStationOptions();
    elements.stationDialog.showModal();
  });

  elements.selectAllStationsButton.addEventListener("click", () => {
    elements.stationOptions.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = true;
    });
  });

  elements.applyStationsButton.addEventListener("click", () => {
    const checked = elements.stationOptions.querySelectorAll('input[type="checkbox"]:checked');
    state.selectedStations = new Set([...checked].map(input => input.value));
    elements.stationDialog.close();
    render();
  });

  elements.activeFilters.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-station]");
    if (!button) return;
    state.selectedStations.delete(button.dataset.removeStation);
    render();
  });

  elements.emptyResetButton.addEventListener("click", () => {
    state.selectedStations = new Set(data.stations.map(station => station.key));
    render();
  });

  elements.aboutButton.addEventListener("click", () => elements.aboutDialog.showModal());
  document.querySelector("[data-close-about]").addEventListener("click", () => elements.aboutDialog.close());

  [elements.stationDialog, elements.aboutDialog].forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });

  elements.updateLabel.textContent = `データ更新 ${data.meta.updatedAt.replaceAll("-", ".")}`;
  elements.weekLabel.textContent = data.meta.weekLabel;
  elements.primarySourceLink.href = data.meta.sourceUrl;
  elements.editorialSourceLink.href = data.meta.editorialSourceUrl;
  renderStationOptions();
  render();
})();
