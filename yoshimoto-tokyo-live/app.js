(() => {
  "use strict";

  const META = window.YOSHIMOTO_LIVE_META || {};
  const raw = window.YOSHIMOTO_LIVE_ROWS || "";

  const GENRE_LABELS = Object.freeze({
    yose: "寄席・ネタ",
    neta: "ネタライブ",
    "neta-corner": "ネタ＋コーナー",
    project: "企画ライブ"
  });

  const STATUS_LABELS = Object.freeze({
    available: "販売中",
    check: "公式確認"
  });

  const ORDINARY_GENRES = new Set(["yose", "neta", "neta-corner", "conte"]);

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [
        date,
        open,
        start,
        venue,
        area,
        title,
        genre,
        status,
        priceMin,
        priceText,
        performers,
        url
      ] = line.split("|");

      return Object.freeze({
        id: `${date}-${start}-${index}`,
        date,
        open,
        start,
        venue,
        area,
        title,
        genre,
        status,
        priceMin: priceMin ? Number(priceMin) : null,
        priceText,
        performers: performers.split("／").map((name) => name.trim()).filter(Boolean),
        url,
        ordinary: ORDINARY_GENRES.has(genre)
      });
    });

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    visibleCount: $("#visibleCount"),
    netaCount: $("#netaCount"),
    nextDate: $("#nextDate"),
    nextDateSub: $("#nextDateSub"),
    search: $("#searchInput"),
    venue: $("#venueFilter"),
    genre: $("#genreFilter"),
    from: $("#fromDate"),
    to: $("#toDate"),
    status: $("#statusFilter"),
    price: $("#priceFilter"),
    sort: $("#sortFilter"),
    filterToggle: $("#filterToggle"),
    filterBadge: $("#filterBadge"),
    advanced: $("#advancedFilters"),
    performerChips: $("#performerChips"),
    clearPerformer: $("#clearPerformer"),
    resultSummary: $("#resultSummary"),
    reset: $("#resetButton"),
    list: $("#liveList"),
    sourceNote: $("#sourceNote"),
    version: $("#versionLabel")
  };

  const allDates = rows.map((event) => event.date).sort();
  const earliestDate = allDates[0] || "";
  const latestDate = allDates.at(-1) || "";
  const today = toLocalDateString(new Date());
  const defaultFrom = today >= earliestDate && today <= latestDate ? today : earliestDate;

  const state = {
    mode: "neta",
    performer: "",
    defaultFrom
  };

  function toLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value) {
    const date = parseDate(value);
    return {
      monthDay: `${date.getMonth() + 1}/${date.getDate()}`,
      year: date.getFullYear(),
      weekday: "日月火水木金土"[date.getDay()]
    };
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase("ja-JP")
      .replace(/\s+/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initialize() {
    elements.version.textContent = `v${META.version || "1.1.0"}`;

    [...new Set(rows.map((event) => event.venue))]
      .sort((a, b) => a.localeCompare(b, "ja"))
      .forEach((venue) => {
        const option = document.createElement("option");
        option.value = venue;
        option.textContent = venue;
        elements.venue.append(option);
      });

    elements.from.value = defaultFrom;
    renderPerformerChips();
    bindEvents();
    render();

    elements.sourceNote.textContent =
      `更新 ${META.updatedAt || "—"}／${META.sourceName || "公式情報"}。${META.note || ""}`;
  }

  function bindEvents() {
    document.querySelectorAll(".mode-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        document.querySelectorAll(".mode-tab").forEach((tab) => {
          tab.classList.toggle("is-active", tab === button);
        });
        render();
      });
    });

    [elements.search, elements.venue, elements.genre, elements.from, elements.to,
      elements.status, elements.price, elements.sort].forEach((control) => {
      control.addEventListener("input", () => {
        if (control === elements.genre && control.value === "project") {
          setMode("all");
        }
        render();
      });
    });

    elements.filterToggle.addEventListener("click", () => {
      const open = elements.advanced.classList.toggle("is-open");
      elements.filterToggle.setAttribute("aria-expanded", String(open));
    });

    elements.reset.addEventListener("click", resetFilters);
    elements.clearPerformer.addEventListener("click", () => {
      state.performer = "";
      renderPerformerChips();
      render();
    });

    elements.performerChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-performer]");
      if (!button) return;
      const name = button.dataset.performer;
      state.performer = state.performer === name ? "" : name;
      renderPerformerChips();
      render();
    });

    elements.list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-performer]");
      if (!button) return;
      state.performer = button.dataset.performer;
      renderPerformerChips();
      render();
      window.scrollTo({ top: Math.max(0, elements.search.getBoundingClientRect().top + window.scrollY - 16), behavior: "smooth" });
    });
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.mode === mode);
    });
  }

  function resetFilters() {
    elements.search.value = "";
    elements.venue.value = "";
    elements.genre.value = "";
    elements.from.value = state.defaultFrom;
    elements.to.value = "";
    elements.status.value = "";
    elements.price.value = "";
    elements.sort.value = "date";
    state.performer = "";
    setMode("neta");
    renderPerformerChips();
    render();
  }

  function getTopPerformers() {
    const frequency = new Map();
    rows.filter((event) => event.ordinary).forEach((event) => {
      event.performers.forEach((name) => {
        frequency.set(name, (frequency.get(name) || 0) + 1);
      });
    });

    return [...frequency.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 18)
      .map(([name]) => name);
  }

  function renderPerformerChips() {
    const names = getTopPerformers();
    elements.performerChips.innerHTML = names
      .map((name) => `
        <button class="performer-chip${state.performer === name ? " is-active" : ""}"
          type="button" data-performer="${escapeHtml(name)}">${escapeHtml(name)}</button>
      `)
      .join("");

    elements.clearPerformer.hidden = !state.performer;
    elements.clearPerformer.textContent = state.performer ? `${state.performer} を解除` : "選択解除";
  }

  function matchesCommonFilters(event) {
    const query = normalize(elements.search.value);
    if (query) {
      const haystack = normalize([event.title, event.venue, event.area, ...event.performers].join(" "));
      if (!haystack.includes(query)) return false;
    }

    if (state.performer && !event.performers.includes(state.performer)) return false;
    if (elements.venue.value && event.venue !== elements.venue.value) return false;
    if (elements.genre.value && event.genre !== elements.genre.value) return false;
    if (elements.from.value && event.date < elements.from.value) return false;
    if (elements.to.value && event.date > elements.to.value) return false;
    if (elements.status.value && event.status !== elements.status.value) return false;

    const maxPrice = Number(elements.price.value || 0);
    if (maxPrice && (!event.priceMin || event.priceMin > maxPrice)) return false;

    return true;
  }

  function filteredRows({ ignoreMode = false } = {}) {
    const filtered = rows.filter((event) => {
      if (!matchesCommonFilters(event)) return false;
      if (ignoreMode) return true;
      if (state.mode === "neta" && !event.ordinary) return false;
      if (state.mode === "available" && event.status !== "available") return false;
      return true;
    });

    return filtered.sort((a, b) => {
      switch (elements.sort.value) {
        case "price":
          return (a.priceMin || Number.MAX_SAFE_INTEGER) - (b.priceMin || Number.MAX_SAFE_INTEGER)
            || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
        case "venue":
          return a.venue.localeCompare(b.venue, "ja")
            || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
        case "performers":
          return b.performers.length - a.performers.length
            || `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
        default:
          return `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
      }
    });
  }

  function render() {
    const visible = filteredRows();
    const common = filteredRows({ ignoreMode: true });
    const ordinaryCount = common.filter((event) => event.ordinary).length;

    elements.visibleCount.textContent = String(visible.length);
    elements.netaCount.textContent = String(ordinaryCount);

    if (visible[0]) {
      const next = formatDate(visible[0].date);
      elements.nextDate.textContent = next.monthDay;
      elements.nextDateSub.textContent = `${next.weekday}曜 ${visible[0].start}〜`;
    } else {
      elements.nextDate.textContent = "—";
      elements.nextDateSub.textContent = "該当なし";
    }

    const modeLabel = state.mode === "neta" ? "ネタ中心" : state.mode === "available" ? "販売中のみ" : "全公演";
    const performerText = state.performer ? `／${state.performer}` : "";
    elements.resultSummary.textContent = `${modeLabel}${performerText}：${visible.length}件表示`;
    updateFilterBadge();
    renderCards(visible);
  }

  function updateFilterBadge() {
    const count = [
      elements.venue.value,
      elements.genre.value,
      elements.to.value,
      elements.status.value,
      elements.price.value,
      elements.sort.value !== "date" ? elements.sort.value : ""
    ].filter(Boolean).length;

    elements.filterBadge.hidden = count === 0;
    elements.filterBadge.textContent = String(count);
  }

  function renderCards(events) {
    if (!events.length) {
      elements.list.innerHTML = "";
      elements.list.append($("#emptyTemplate").content.cloneNode(true));
      return;
    }

    elements.list.innerHTML = events.map(cardHtml).join("");
  }

  function performerButtons(names) {
    return names
      .map((name) => `<button class="performer-button" type="button" data-performer="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join("");
  }

  function cardHtml(event) {
    const date = formatDate(event.date);
    const visiblePerformers = event.performers.slice(0, 6);
    const hiddenPerformers = event.performers.slice(6);
    const genreClass = event.genre === "project" ? "project" : "genre";
    const statusLabel = STATUS_LABELS[event.status] || "公式確認";
    const genreLabel = GENRE_LABELS[event.genre] || "お笑いライブ";

    return `
      <article class="live-card">
        <div class="date-panel">
          <div>
            <div class="date-main">
              <strong>${date.monthDay}</strong>
              <span>(${date.weekday})</span>
            </div>
            <div class="time-line">開場 ${escapeHtml(event.open)}<br>開演 ${escapeHtml(event.start)}</div>
          </div>
        </div>

        <div class="card-body">
          <div class="card-topline">
            <span class="badge ${genreClass}">${escapeHtml(genreLabel)}</span>
            <span class="badge ${escapeHtml(event.status)}">○ ${escapeHtml(statusLabel)}</span>
          </div>

          <h2>${escapeHtml(event.title)}</h2>

          <div class="meta-line">
            <span>📍 ${escapeHtml(event.area)}・${escapeHtml(event.venue)}</span>
            <span>🎫 ${escapeHtml(event.priceText)}</span>
          </div>

          <div class="performers-preview">
            ${performerButtons(visiblePerformers)}
          </div>

          ${hiddenPerformers.length ? `
            <details class="performer-details">
              <summary>ほか ${hiddenPerformers.length}組を見る</summary>
              <div class="performers-preview">
                ${performerButtons(hiddenPerformers)}
              </div>
            </details>
          ` : ""}

          <div class="card-actions">
            <span class="availability-note">残席数と最新出演者は公式で確認</span>
            <a class="official-link" href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">空席・購入を見る →</a>
          </div>
        </div>
      </article>
    `;
  }

  initialize();
})();
