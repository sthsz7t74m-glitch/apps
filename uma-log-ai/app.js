(function startUmaLogApp() {
  'use strict';

  const Engine = window.UmaLogEngine;
  const JraImporter = window.UmaLogJraImporter;
  const STORAGE_KEYS = {
    weights: 'umaLogWeightsV1',
    budget: 'umaLogBudgetV1',
    changes: 'umaLogWeightChangesV1',
    selected: 'umaLogSelectionV1',
    lastAutoLearn: 'umaLogLastAutoLearnV1'
  };
  const DB_NAME = 'uma-log-ai';
  const DB_STORE = 'datasets';
  const PREDICTION_KEY_PREFIX = 'prediction:';
  const TICKET_PLAN_KEY_PREFIX = 'ticket-plan:';
  const DATA_URL = './data/races.json';
  const EMPTY_DATASET = {
    schemaVersion: 1,
    generatedAt: null,
    source: {
      mode: 'unavailable',
      datasetId: 'uma-log-ai-public-feed-v1',
      name: '実データ未取込',
      detail: 'PCで保存したJRA公式HTMLを設定画面から読み込んでください',
      redistributable: false,
      automated: false,
      asOfFieldsGuaranteed: false
    },
    venues: ['東京', '中山', '京都'],
    races: []
  };
  const FRAME_COLORS = ['#f8fafc', '#23272f', '#e5484d', '#3b82f6', '#f0c841', '#22a45d', '#ee7d36', '#e994b9'];
  const SURFACE_LABELS = { turf: '芝', dirt: 'ダート' };
  const GOING_LABELS = { firm: '良', good: '良', standard: '良', yielding: '稍重', soft: '重', heavy: '不良', muddy: '不良' };
  const WEATHER_LABELS = { sunny: '晴', cloudy: '曇', rain: '雨', snow: '雪' };
  const PACE_LABELS = { fast: '速め', middle: '平均', slow: '遅め' };
  const DIRECTION_LABELS = { left: '左', right: '右', straight: '直線' };
  const MARK_CLASSES = { '◎': 'mark-main', '○': 'mark-second', '▲': 'mark-third', '☆': 'mark-star', '消': 'mark-cut' };
  const snapshotWriteChains = new Map();
  const state = {
    dataset: null,
    datasetOrigin: 'bundled',
    date: '',
    venue: '東京',
    raceNumber: 11,
    edition: 'final',
    view: 'race',
    budget: normalizeBudget(readJson(STORAGE_KEYS.budget, 3000)),
    weights: Engine.normalizeWeights(readJson(STORAGE_KEYS.weights, Engine.DEFAULT_WEIGHTS)),
    predictions: {},
    pendingPredictions: {},
    failedSnapshotSaves: {},
    ticketPlans: {},
    pendingTicketPlans: {},
    recordCache: new Map(),
    changes: readJson(STORAGE_KEYS.changes, []),
    loading: true,
    autoLearning: false
  };

  const nodes = Object.fromEntries([
    'sourceSummary', 'refreshButton', 'sourceBanner', 'sourceMode', 'sourceDetail', 'dateSelect', 'venueTabs', 'raceStrip',
    'raceView', 'ticketView', 'resultView', 'settingsView', 'raceEyebrow', 'raceViewTitle', 'raceMeta', 'confidenceGauge',
    'predictionPodium', 'openBreakdownButton', 'runnerCount', 'runnerList', 'ticketConfidence', 'budgetInput', 'budgetOutput',
    'ticketSummary', 'ticketGroups', 'resultStatus', 'resultContent', 'recordRaceCount', 'editionComparison', 'recordDashboard', 'recordTableBody', 'ticketRecordBody',
    'weightList', 'weightTotal', 'resetWeightsButton', 'learningStatus', 'learningDescription', 'runLearningButton',
    'weightChangeLog', 'dataGeneratedAt', 'dataStatusPill', 'dataSourceCopy', 'jraSnapshotMode', 'jraHtmlImportButton', 'jraHtmlImportInput',
    'dataImportButton', 'dataImportInput', 'restoreBundledButton',
    'mainContent', 'breakdownBackdrop', 'breakdownContent', 'closeBreakdownButton', 'runnerBackdrop', 'runnerSheetEyebrow',
    'runnerSheetTitle', 'runnerSheetContent', 'closeRunnerButton', 'toast'
  ].map(id => [id, document.getElementById(id)]));

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeBudget(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(500, Math.min(20000, Math.floor(number / 100) * 100)) : 3000;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function formatNumber(value, digits = 0) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  }

  function formatDate(value, includeYear = false) {
    const date = new Date(`${value}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return String(value || '日付不明');
    return date.toLocaleDateString('ja-JP', { ...(includeYear ? { year: 'numeric' } : {}), month: 'numeric', day: 'numeric', weekday: 'short' });
  }

  function formatTimestamp(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '更新時刻不明';
    return date.toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function bodyWeightText(runner) {
    const bodyWeight = Number(runner?.bodyWeight);
    if (runner?.bodyWeight === null || runner?.bodyWeight === undefined || !Number.isFinite(bodyWeight)) return '馬体重未発表';
    const change = Number(runner?.bodyWeightChange);
    const changeText = runner?.bodyWeightChange === null || runner?.bodyWeightChange === undefined || !Number.isFinite(change)
      ? ''
      : `（${change >= 0 ? '+' : ''}${formatNumber(change)}）`;
    return `馬体重 ${formatNumber(bodyWeight)}kg${changeText}`;
  }

  function hashWeights(weights) {
    return Engine.CATEGORY_META.map(category => `${category.key}:${Number(weights[category.key]).toFixed(2)}`).join('|');
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbGet(key) {
    try {
      const database = await openDatabase();
      if (!database) return null;
      return await new Promise((resolve, reject) => {
        const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async function idbSet(key, value) {
    const database = await openDatabase();
    if (!database) throw new Error('このブラウザでは端末保存を利用できません');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function idbImportJraHtml(htmlEntries, importedAt, snapshotMode, allowReplace = false) {
    const database = await openDatabase();
    if (!database) throw new Error('このブラウザでは端末保存を利用できません');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      const store = transaction.objectStore(DB_STORE);
      const request = store.get('active-import');
      let output = null;
      let failure = null;
      request.onsuccess = () => {
        try {
          const current = request.result;
          if (current?.source?.mode !== 'local-jra' && current?.races?.length && !allowReplace) {
            const conflict = new Error('端末内に別形式のJSONデータがあります');
            conflict.code = 'NON_JRA_DATASET';
            throw conflict;
          }
          let dataset = current?.source?.mode === 'local-jra' ? current : null;
          const summaries = [];
          htmlEntries.forEach(entry => {
            const imported = JraImporter.importHtml(entry.html, dataset, new Date(importedAt), snapshotMode, new Date(entry.lastModified));
            dataset = imported.dataset;
            summaries.push({ kind: imported.kind, race: imported.race, fileName: entry.fileName });
          });
          Engine.validateDataset(dataset);
          output = { dataset, summaries };
          store.put(dataset, 'active-import');
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      request.onerror = () => {
        failure = request.error;
      };
      transaction.oncomplete = () => resolve(output);
      transaction.onabort = () => reject(failure || transaction.error || new Error('JRA HTMLを保存できませんでした'));
      transaction.onerror = () => {
        failure ||= transaction.error;
      };
    });
  }

  async function idbDelete(key) {
    const database = await openDatabase();
    if (!database) throw new Error('このブラウザでは端末保存を利用できません');
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function idbGetPredictionSnapshots() {
    try {
      const database = await openDatabase();
      if (!database) return {};
      return await new Promise((resolve, reject) => {
        const snapshots = {};
        const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(snapshots); return; }
          const key = String(cursor.key || '');
          if (key.startsWith(PREDICTION_KEY_PREFIX)) snapshots[key.slice(PREDICTION_KEY_PREFIX.length)] = cursor.value;
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return {};
    }
  }

  async function idbGetTicketPlanRevisions() {
    try {
      const database = await openDatabase();
      if (!database) return {};
      return await new Promise((resolve, reject) => {
        const revisions = {};
        const request = database.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(revisions); return; }
          const key = String(cursor.key || '');
          const revision = cursor.value;
          if (key.startsWith(TICKET_PLAN_KEY_PREFIX) && revision?.snapshotKey) {
            const current = revisions[revision.snapshotKey];
            if (!current || Date.parse(revision.savedAt || '') > Date.parse(current.savedAt || '')) revisions[revision.snapshotKey] = revision;
          }
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return {};
    }
  }

  async function idbSetPredictionSnapshot(key, value) {
    const database = await openDatabase();
    if (!database) throw new Error('このブラウザでは予想履歴を端末保存できません');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      let inserted = true;
      const request = transaction.objectStore(DB_STORE).add(value, `${PREDICTION_KEY_PREFIX}${key}`);
      request.onerror = event => {
        if (request.error?.name !== 'ConstraintError') return;
        inserted = false;
        event.preventDefault();
        event.stopPropagation();
      };
      transaction.oncomplete = () => resolve(inserted);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('予想履歴を保存できませんでした'));
    });
  }

  async function idbAddTicketPlanRevision(key, value) {
    const database = await openDatabase();
    if (!database) throw new Error('このブラウザでは買い目履歴を端末保存できません');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      transaction.objectStore(DB_STORE).add(value, `${TICKET_PLAN_KEY_PREFIX}${key}:${suffix}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('買い目履歴を保存できませんでした'));
    });
  }

  function queuePredictionSnapshot(key, value) {
    const previous = snapshotWriteChains.get(key) || Promise.resolve();
    const next = previous.catch(() => null).then(() => idbSetPredictionSnapshot(key, value));
    snapshotWriteChains.set(key, next);
    const cleanup = () => { if (snapshotWriteChains.get(key) === next) snapshotWriteChains.delete(key); };
    next.then(cleanup, cleanup);
    return next;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }

  function datasetFingerprint() {
    const source = state.dataset?.source || {};
    return hashString(source.datasetId || source.id || `${source.mode || 'unknown'}:${source.name || 'unnamed'}`);
  }

  function predictionInputFingerprint(race, edition, weights) {
    const currentRaceData = Engine.mergeRaceEdition(race, edition);
    const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]));
    const horses = race.horses.map(horse => {
      const current = Engine.mergeHorseEdition(horse, edition);
      return {
        ...pick(current, ['id', 'number', 'gate', 'scratched', 'carriedWeight', 'burdenChange', 'bodyWeight', 'bodyWeightChange', 'restDays', 'runningStyle', 'distanceFit', 'courseFit', 'goingFit', 'paceFit', 'drawFit', 'classFit', 'conditionScore']),
        jockeyStats: pick(current.jockeyStats, ['winRate', 'placeRate', 'coursePlaceRate', 'pairPlaceRate', 'pairStarts']),
        trainerStats: pick(current.trainerStats, ['winRate', 'placeRate', 'coursePlaceRate']),
        pedigree: pick(current.pedigree, ['turfScore', 'dirtScore', 'distanceScore']),
        workout: pick(current.workout, ['score']),
        recentRuns: (current.recentRuns || []).map(run => pick(run, ['id', 'date', 'venue', 'surface', 'raceType', 'distance', 'direction', 'going', 'finish', 'fieldSize', 'margin', 'last3FRank', 'speedRating', 'classLevel', 'opponentRating']))
      };
    }).sort((a, b) => Number(a.number) - Number(b.number));
    const input = {
      modelVersion: 2,
      date: currentRaceData.date,
      venue: currentRaceData.venue,
      raceNumber: currentRaceData.raceNumber,
      surface: currentRaceData.surface,
      raceType: currentRaceData.raceType || 'flat',
      distance: currentRaceData.distance,
      direction: currentRaceData.direction,
      going: currentRaceData.going,
      pace: currentRaceData.pace,
      drawBias: currentRaceData.drawBias,
      classLevel: currentRaceData.classLevel,
      bettingFieldSize: currentRaceData.bettingFieldSize,
      horses,
      weights,
      engineVersion: Engine.ENGINE_VERSION
    };
    return hashString(JSON.stringify(canonicalize(input)));
  }

  function compactPrediction(prediction, race, budget, ticketPlan, inputFingerprint) {
    return {
      raceId: prediction.raceId,
      edition: prediction.edition,
      engineVersion: prediction.engineVersion || Engine.ENGINE_VERSION,
      fieldSize: prediction.fieldSize,
      generatedAt: prediction.generatedAt,
      capturedAt: new Date().toISOString(),
      datasetFingerprint: datasetFingerprint(),
      inputFingerprint,
      weightSignature: hashWeights(prediction.weights),
      weights: prediction.weights,
      confidence: prediction.confidence,
      budget,
      ticketPlan,
      sourceMode: state.dataset?.source?.mode || 'unknown',
      captureStatus: 'pre-race',
      runners: prediction.runners.map(runner => ({
        number: runner.number,
        gate: runner.gate,
        name: runner.name,
        sexAge: runner.sexAge,
        jockey: runner.jockey,
        trainer: runner.trainer,
        carriedWeight: runner.carriedWeight,
        bodyWeight: runner.bodyWeight,
        bodyWeightChange: runner.bodyWeightChange,
        runningStyle: runner.runningStyle,
        odds: runner.odds,
        popularity: runner.popularity,
        capturedOdds: runner.odds,
        capturedPopularity: runner.popularity,
        rank: runner.rank,
        mark: runner.mark,
        score: runner.score,
        scoreRaw: runner.scoreRaw,
        coverage: runner.coverage,
        reason: runner.reason,
        breakdown: runner.breakdown,
        recentRuns: runner.recentRuns?.slice(0, 5) || []
      }))
    };
  }

  function snapshotKey(race, edition) {
    return `${datasetFingerprint()}:${race.id}:${edition}`;
  }

  function savePrediction(race, prediction, budget = state.budget) {
    const key = snapshotKey(race, prediction.edition);
    const existing = state.predictions[key];
    if (existing) return existing;
    if (state.pendingPredictions[key]) return state.pendingPredictions[key];
    const inputFingerprint = predictionInputFingerprint(race, prediction.edition, prediction.weights);
    const normalizedBudget = normalizeBudget(budget);
    const ticketPlan = Engine.createTickets(prediction, normalizedBudget);
    const persisted = compactPrediction(prediction, race, normalizedBudget, ticketPlan, inputFingerprint);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pending = { ...persisted, captureStatus: 'pending-save', saveToken: token };
    state.pendingPredictions[key] = pending;
    queuePredictionSnapshot(key, persisted).then(async inserted => {
      if (state.pendingPredictions[key]?.saveToken !== token) return;
      const committed = inserted ? persisted : await idbGet(`${PREDICTION_KEY_PREFIX}${key}`);
      if (!committed) throw new Error('保存済み予想を読み出せませんでした');
      state.predictions[key] = committed;
      delete state.pendingPredictions[key];
      delete state.failedSnapshotSaves[key];
      if (currentRace()?.id === race.id && state.edition === prediction.edition) {
        renderRaceView();
        renderTickets();
      }
    }).catch(error => {
      console.error(error);
      if (state.pendingPredictions[key]?.saveToken !== token) return;
      delete state.pendingPredictions[key];
      state.failedSnapshotSaves[key] = `${inputFingerprint}:${normalizedBudget}`;
      showToast('予想を端末保存できませんでした。空き容量やプライベートモードを確認してください');
      if (currentRace()?.id === race.id && state.edition === prediction.edition) {
        renderRaceView();
        renderTickets();
      }
    });
    return pending;
  }

  function savedTicketPlanRevision(race, edition, prediction) {
    const key = snapshotKey(race, edition);
    const revision = state.pendingTicketPlans[key] || state.ticketPlans[key];
    if (!revision || revision.raceId !== race.id || revision.edition !== edition
      || revision.datasetFingerprint !== datasetFingerprint() || revision.predictionCapturedAt !== prediction.capturedAt) return null;
    const savedAt = Date.parse(revision.savedAt || '');
    const deadline = Engine.predictionDeadline(race, edition);
    if (!Number.isFinite(savedAt) || deadline === null || savedAt >= deadline) return null;
    return revision;
  }

  function withSavedTicketPlan(prediction, race, edition) {
    const revision = savedTicketPlanRevision(race, edition, prediction);
    if (!revision) return prediction;
    return {
      ...prediction,
      budget: revision.budget,
      ticketPlan: revision.ticketPlan,
      ticketPlanSavedAt: revision.savedAt,
      ticketPlanStatus: revision.saveToken ? 'pending-save' : 'saved'
    };
  }

  function saveTicketPlanRevision(race, prediction, budget) {
    const deadline = Engine.predictionDeadline(race, prediction.edition);
    if (deadline === null || Date.now() >= deadline) return prediction;
    const key = snapshotKey(race, prediction.edition);
    const normalizedBudget = normalizeBudget(budget);
    const revision = {
      snapshotKey: key,
      raceId: race.id,
      edition: prediction.edition,
      datasetFingerprint: datasetFingerprint(),
      predictionCapturedAt: prediction.capturedAt,
      savedAt: new Date().toISOString(),
      budget: normalizedBudget,
      ticketPlan: Engine.createTickets(prediction, normalizedBudget)
    };
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.pendingTicketPlans[key] = { ...revision, saveToken: token };
    idbAddTicketPlanRevision(key, revision).then(() => {
      if (state.pendingTicketPlans[key]?.saveToken !== token) return;
      state.ticketPlans[key] = revision;
      delete state.pendingTicketPlans[key];
      if (currentRace()?.id === race.id && state.edition === prediction.edition) renderTickets();
    }).catch(error => {
      console.error(error);
      if (state.pendingTicketPlans[key]?.saveToken !== token) return;
      delete state.pendingTicketPlans[key];
      showToast('買い目予算を端末保存できませんでした');
      if (currentRace()?.id === race.id && state.edition === prediction.edition) renderTickets();
    });
    return state.pendingTicketPlans[key];
  }

  function currentRace() {
    return state.dataset?.races?.find(race => race.date === state.date && race.venue === state.venue && Number(race.raceNumber) === Number(state.raceNumber)) || null;
  }

  function isFinalized(race) {
    return race?.status === 'final' || race?.status === 'cancelled' || race?.result?.status === 'final' || (Array.isArray(race?.result?.order) && race.result.order.length > 0);
  }

  function isCaptureWindowOpen(race, edition = state.edition) {
    if (!race || isFinalized(race)) return false;
    if (state.dataset?.source?.mode === 'demo') return true;
    const deadline = Engine.predictionDeadline(race, edition);
    return deadline !== null && Date.now() < deadline;
  }

  function isEditionAvailable(race, edition) {
    if (state.dataset?.source?.mode === 'demo') return true;
    const snapshot = race?.snapshots?.[edition];
    if (state.dataset?.source?.mode === 'local-jra') {
      const asOf = Date.parse(snapshot?.asOf || '');
      return snapshot?.ready === true && Number.isFinite(asOf) && asOf <= Date.now();
    }
    if (!snapshot) return state.datasetOrigin === 'imported' && state.dataset?.source?.automated !== true;
    const asOf = Date.parse(snapshot.asOf || '');
    return snapshot.ready === true && Number.isFinite(asOf) && asOf <= Date.now();
  }

  function storedPredictionFor(race, edition) {
    const stored = state.predictions[snapshotKey(race, edition)];
    if (stored?.captureStatus !== 'pre-race' || !Array.isArray(stored.runners) || !stored.weights || stored.raceId !== race.id || stored.edition !== edition || stored.datasetFingerprint !== datasetFingerprint()) return null;
    const capturedAt = Date.parse(stored.capturedAt || '');
    const deadline = Engine.predictionDeadline(race, edition);
    if (!Number.isFinite(capturedAt) || deadline === null || capturedAt >= deadline) return null;
    return stored;
  }

  function hydrateStoredPrediction(snapshot, race, edition) {
    const currentPrediction = Engine.scoreRace(race, edition, snapshot.weights || state.weights);
    const currentByNumber = new Map(currentPrediction.runners.map(runner => [Number(runner.number), runner]));
    const currentFingerprint = predictionInputFingerprint(race, edition, snapshot.weights || state.weights);
    return withSavedTicketPlan({
      ...snapshot,
      inputChanged: Boolean(snapshot.inputFingerprint && snapshot.inputFingerprint !== currentFingerprint),
      runners: snapshot.runners.map(saved => {
        const current = currentByNumber.get(Number(saved.number)) || {};
        return {
          ...current,
          ...saved,
          breakdown: saved.breakdown || current.breakdown || {},
          recentRuns: saved.recentRuns || current.recentRuns || [],
          currentOdds: current.odds,
          currentPopularity: current.popularity
        };
      })
    }, race, edition);
  }

  function racesForSelection(date = state.date, venue = state.venue) {
    return (state.dataset?.races || []).filter(race => race.date === date && race.venue === venue).sort((a, b) => a.raceNumber - b.raceNumber);
  }

  function getPrediction(race = currentRace()) {
    if (!race) return null;
    if (!isEditionAvailable(race, state.edition)) return null;
    const key = snapshotKey(race, state.edition);
    const stored = storedPredictionFor(race, state.edition);
    if (stored) return hydrateStoredPrediction(stored, race, state.edition);
    if (isFinalized(race)) {
      return { ...Engine.scoreRace(race, state.edition, state.weights), captureStatus: 'retrospective', retrospective: true };
    }
    const prediction = Engine.scoreRace(race, state.edition, state.weights);
    if (state.dataset?.source?.mode === 'demo') return { ...prediction, captureStatus: 'demo-live' };
    const fingerprint = predictionInputFingerprint(race, state.edition, prediction.weights);
    const pending = state.pendingPredictions[key];
    if (pending) return hydrateStoredPrediction(pending, race, state.edition);
    if (!isCaptureWindowOpen(race, state.edition)) {
      return { ...prediction, captureStatus: 'post-time', retrospective: true };
    }
    const saveSignature = `${fingerprint}:${state.budget}`;
    if (state.failedSnapshotSaves[key] === saveSignature) return { ...prediction, captureStatus: 'save-failed' };
    const saved = savePrediction(race, prediction, state.budget);
    return hydrateStoredPrediction(saved, race, state.edition);
  }

  function getFrozenPrediction(race, edition) {
    const stored = storedPredictionFor(race, edition);
    if (stored) return withSavedTicketPlan(stored, race, edition);
    const demo = state.dataset?.source?.mode === 'demo';
    const providerSnapshot = state.dataset?.source?.asOfFieldsGuaranteed === true && Engine.isHistoricalRaceEligible(race, edition);
    if (!demo && !providerSnapshot) return null;
    const prediction = Engine.scoreRace(race, edition, state.weights);
    const budget = 3000;
    const replay = compactPrediction(prediction, race, budget, Engine.createTickets(prediction, budget), predictionInputFingerprint(race, edition, prediction.weights));
    replay.capturedAt = race.snapshots?.[edition]?.asOf || replay.capturedAt;
    replay.captureStatus = demo ? 'demo-replay' : 'provider-snapshot';
    replay.retrospective = true;
    return replay;
  }

  function captureEligiblePredictions() {
    if (state.dataset?.source?.mode === 'demo') return;
    (state.dataset?.races || []).forEach(race => {
      ['dayBefore', 'final'].forEach(edition => {
        if (!isEditionAvailable(race, edition) || !isCaptureWindowOpen(race, edition)) return;
        const deadline = Engine.predictionDeadline(race, edition);
        const providerMarkedReady = race.snapshots?.[edition]?.ready === true;
        if (deadline === null || (!providerMarkedReady && deadline - Date.now() > 36 * 60 * 60 * 1000)) return;
        const key = snapshotKey(race, edition);
        if (state.predictions[key] || state.pendingPredictions[key]) return;
        const prediction = Engine.scoreRace(race, edition, state.weights);
        savePrediction(race, prediction, state.budget);
      });
    });
  }

  function normalizeSelection() {
    const dates = [...new Set((state.dataset?.races || []).map(race => race.date))].sort().reverse();
    if (!dates.includes(state.date)) state.date = dates[0] || '';
    const venues = ['東京', '中山', '京都'].filter(venue => racesForSelection(state.date, venue).length);
    if (!venues.includes(state.venue)) state.venue = venues[0] || '東京';
    const races = racesForSelection();
    if (!races.some(race => Number(race.raceNumber) === Number(state.raceNumber))) {
      state.raceNumber = races.find(race => Number(race.raceNumber) === 11)?.raceNumber || races[0]?.raceNumber || 1;
    }
    writeJson(STORAGE_KEYS.selected, { date: state.date, venue: state.venue, raceNumber: state.raceNumber, edition: state.edition });
  }

  async function fetchBundledDataset(force = false) {
    try {
      const response = await fetch(`${DATA_URL}${force ? `?t=${Date.now()}` : ''}`, { cache: force ? 'no-store' : 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.source?.mode === 'unavailable' && Array.isArray(payload.races) && !payload.races.length) return payload;
      Engine.validateDataset(payload);
      return payload;
    } catch {
      return structuredClone(EMPTY_DATASET);
    }
  }

  async function loadDataset({ force = false, ignoreImport = false } = {}) {
    state.loading = true;
    nodes.refreshButton.classList.add('is-spinning');
    renderLoading();
    try {
      const imported = ignoreImport ? null : await idbGet('active-import');
      if (imported) {
        Engine.validateDataset(imported);
        state.dataset = imported;
        state.datasetOrigin = 'imported';
      } else {
        state.dataset = await fetchBundledDataset(force);
        state.datasetOrigin = state.dataset.source?.mode === 'demo' ? 'demo' : 'bundled';
      }
      state.recordCache.clear();
      normalizeSelection();
      captureEligiblePredictions();
      renderControls();
      renderAll();
      maybeAutoLearn();
    } catch (error) {
      console.error(error);
      state.dataset = structuredClone(EMPTY_DATASET);
      state.datasetOrigin = 'bundled';
      normalizeSelection();
      renderControls();
      renderAll();
      showToast('実データを読み込めませんでした。設定からJRA公式HTMLを取り込んでください');
    } finally {
      state.loading = false;
      nodes.refreshButton.classList.remove('is-spinning');
    }
  }

  function renderLoading() {
    nodes.runnerList.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  }

  function renderSourceStatus() {
    const source = state.dataset?.source || {};
    const raceCount = state.dataset?.races?.length || 0;
    nodes.sourceSummary.textContent = `${source.name || 'データソース不明'} · ${raceCount}R`;
    nodes.sourceBanner.className = 'source-banner';
    if (source.mode === 'demo') {
      nodes.sourceMode.textContent = '架空デモ';
      nodes.sourceDetail.textContent = source.detail || '実在データではありません';
    } else if (source.mode === 'unavailable') {
      nodes.sourceBanner.classList.add('is-error');
      nodes.sourceMode.textContent = '実データ未取込';
      nodes.sourceDetail.textContent = '設定からJRA公式HTMLを端末内へ読み込んでください';
    } else if (source.mode === 'local-jra') {
      nodes.sourceBanner.classList.add('is-live');
      nodes.sourceMode.textContent = 'JRA端末内取込';
      nodes.sourceDetail.textContent = `${raceCount}R · 外部送信なし`;
    } else if (state.datasetOrigin === 'imported') {
      nodes.sourceBanner.classList.add('is-live');
      nodes.sourceMode.textContent = '端末内データ';
      nodes.sourceDetail.textContent = `${source.name || 'JSONインポート'} · 取得条件は提供元で確認`;
    } else if (source.redistributable) {
      nodes.sourceBanner.classList.add('is-live');
      nodes.sourceMode.textContent = source.automated ? '自動更新' : '接続済み';
      nodes.sourceDetail.textContent = source.detail || source.name || '利用許諾済みデータ';
    } else {
      nodes.sourceBanner.classList.add('is-error');
      nodes.sourceMode.textContent = '要確認';
      nodes.sourceDetail.textContent = 'データ元の再配布条件を確認してください';
    }
  }

  function renderControls() {
    const dates = [...new Set(state.dataset.races.map(race => race.date))].sort().reverse();
    nodes.dateSelect.innerHTML = dates.map(date => `<option value="${escapeHtml(date)}"${date === state.date ? ' selected' : ''}>${escapeHtml(formatDate(date, true))}${state.dataset.source?.mode === 'demo' ? '（デモ）' : ''}</option>`).join('');
    nodes.venueTabs.innerHTML = ['東京', '中山', '京都'].map(venue => {
      const count = racesForSelection(state.date, venue).length;
      return `<button class="venue-tab${venue === state.venue ? ' is-active' : ''}" type="button" role="tab" aria-selected="${venue === state.venue}" data-venue="${venue}"${count ? '' : ' disabled'}>${venue}<small>${count ? `${count}R` : '開催なし'}</small></button>`;
    }).join('');
    const races = racesForSelection();
    nodes.raceStrip.innerHTML = races.length ? races.map(race => `<button class="race-chip${Number(race.raceNumber) === Number(state.raceNumber) ? ' is-active' : ''}${race.result?.status === 'final' ? ' is-final' : ''}" type="button" data-race-number="${race.raceNumber}" aria-pressed="${Number(race.raceNumber) === Number(state.raceNumber)}" aria-label="${race.raceNumber}レース ${escapeHtml(race.startTime)}"><strong>${race.raceNumber}R</strong><small>${escapeHtml(race.startTime)}</small></button>`).join('') : '<div class="empty-state">この競馬場の開催データはありません</div>';
    const activeRace = nodes.raceStrip.querySelector('.race-chip.is-active');
    if (activeRace) requestAnimationFrame(() => activeRace.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }));
    document.querySelectorAll('[data-edition]').forEach(button => {
      const active = button.dataset.edition === state.edition;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderSourceStatus();
  }

  function effectiveRace(race) {
    return Engine.mergeRaceEdition(race, state.edition);
  }

  function raceMetaText(race) {
    const current = effectiveRace(race);
    const pieces = [
      current.raceType === 'jump' ? '障害' : '平地',
      `${SURFACE_LABELS[current.surface] || current.surface}${formatNumber(current.distance)}m`,
      DIRECTION_LABELS[current.direction] || current.direction,
      current.weather ? WEATHER_LABELS[current.weather] || current.weather : '天候未発表',
      `馬場 ${GOING_LABELS[current.going] || current.going || '未発表'}`,
      `想定ペース ${PACE_LABELS[current.pace] || '不明'}`,
      current.status === 'cancelled' ? '開催中止' : null
    ];
    return pieces.filter(Boolean).join(' · ');
  }

  function markClass(mark) {
    return MARK_CLASSES[mark] || '';
  }

  function breakdownCell(runner, category, weights) {
    return runner.breakdown?.[category.key] || {
      points: null,
      weight: weights?.[category.key] ?? category.weight,
      coverage: 0,
      evidence: ['保存時の内訳なし']
    };
  }

  function frameStyle(gate) {
    const color = FRAME_COLORS[Math.max(0, Math.min(7, Number(gate || 1) - 1))];
    const textColor = Number(gate) === 2 ? '#fff' : '#06110c';
    return `--frame-color:${color};--frame-label:${textColor};color:${textColor};text-shadow:none`;
  }

  function renderRaceView() {
    const race = currentRace();
    if (!race) {
      const unavailable = state.dataset?.source?.mode === 'unavailable';
      nodes.raceViewTitle.textContent = unavailable ? '実データを取り込んでください' : '開催データなし';
      nodes.raceMeta.textContent = unavailable ? '設定 → JRA HTMLを取り込む' : '日付または競馬場を選び直してください';
      nodes.predictionPodium.innerHTML = '';
      nodes.confidenceGauge.innerHTML = '<span>自信度</span><strong>—</strong><small>データなし</small>';
      nodes.confidenceGauge.removeAttribute('title');
      nodes.openBreakdownButton.disabled = true;
      nodes.runnerCount.textContent = '—';
      nodes.runnerList.innerHTML = `<div class="empty-state">${unavailable ? 'WindowsのChrome／EdgeでJRA公式の詳細出馬表をHTML保存し、設定画面から読み込むと予想を作成します。' : '選択できるレースがありません'}</div>`;
      return;
    }
    const prediction = getPrediction(race);
    if (!prediction) {
      nodes.raceEyebrow.textContent = `${race.venue} ${race.raceNumber}R · ${state.edition === 'dayBefore' ? '前日版' : '当日最終版'}`;
      nodes.raceViewTitle.textContent = race.name;
      nodes.raceMeta.textContent = raceMetaText(race);
      nodes.confidenceGauge.innerHTML = '<span>自信度</span><strong>—</strong><small>公開待ち</small>';
      nodes.confidenceGauge.removeAttribute('title');
      nodes.predictionPodium.innerHTML = '';
      nodes.openBreakdownButton.disabled = true;
      nodes.runnerCount.textContent = '公開待ち';
      nodes.runnerList.innerHTML = `<div class="empty-state">${state.dataset?.source?.mode === 'local-jra' ? `この${state.edition === 'dayBefore' ? '前日版' : '当日最終版'}はまだ取り込まれていません。対象時刻に保存した詳細出馬表HTMLを読み込んでください。` : 'この版のスナップショットはまだ公開時刻前です。公開後に再読み込みしてください。'}</div>`;
      return;
    }
    const timingLabel = race.status === 'cancelled' ? ' · 開催中止'
      : prediction.retrospective && state.dataset?.source?.mode !== 'demo'
      ? ` · ${isFinalized(race) ? '結果後' : '締切後'}の参考再計算`
      : prediction.captureStatus === 'pre-race' ? ' · 発走前保存済み'
        : prediction.captureStatus === 'pending-save' ? ' · 端末へ保存中'
          : prediction.captureStatus === 'save-failed' ? ' · 端末保存なし' : '';
    nodes.raceEyebrow.textContent = `${race.venue} ${race.raceNumber}R · ${state.edition === 'dayBefore' ? '前日版' : '当日最終版'}${timingLabel}${prediction.inputChanged ? ' · 元データ更新あり' : ''}`;
    nodes.raceViewTitle.textContent = race.name;
    nodes.raceMeta.textContent = raceMetaText(race);
    nodes.openBreakdownButton.disabled = false;
    nodes.confidenceGauge.innerHTML = `<span>自信度</span><strong>${prediction.confidence.value}</strong><small>${escapeHtml(prediction.confidence.label)}</small>`;
    nodes.confidenceGauge.title = `${prediction.confidence.reason}・充足度${prediction.confidence.coverage}%`;
    nodes.predictionPodium.innerHTML = prediction.runners.slice(0, 3).map(runner => `<div class="podium-card" role="listitem"><span class="podium-mark">${runner.mark}</span><strong>${escapeHtml(runner.name)}</strong><span>${runner.number}番 · ${formatNumber(runner.score, 1)}点</span></div>`).join('');
    nodes.runnerCount.textContent = `${prediction.runners.length}頭`;
    nodes.runnerList.innerHTML = prediction.runners.map(runner => {
      const capturedOdds = runner.capturedOdds ?? runner.odds;
      const currentOdds = runner.currentOdds ?? runner.odds;
      const currentPopularity = runner.currentPopularity ?? runner.popularity;
      const currentText = Number.isFinite(Number(currentOdds)) ? `単 ${formatNumber(currentOdds, 1)}${currentPopularity ? `（${formatNumber(currentPopularity)}人気）` : ''}` : 'オッズ未発表';
      const changed = Number.isFinite(Number(capturedOdds)) && Number.isFinite(Number(currentOdds)) && Number(capturedOdds) !== Number(currentOdds);
      const oddsText = changed ? `予想時 ${formatNumber(capturedOdds, 1)} / 現在 ${currentText}` : currentText;
      return `<button class="runner-card${runner.rank <= 3 ? ' is-top' : ''}" type="button" data-runner-number="${runner.number}" aria-label="${escapeHtml(runner.name)}の詳細">
        <span class="horse-number" style="${frameStyle(runner.gate)}">${runner.number}<small>${formatNumber(runner.gate)}枠</small></span>
        <span class="runner-main"><span class="runner-title"><span class="mark ${markClass(runner.mark)}">${runner.mark || '—'}</span><strong>${escapeHtml(runner.name)}</strong></span><span class="runner-sub"><span>${escapeHtml(runner.sexAge || '')} ${formatNumber(runner.carriedWeight, 1)}kg</span><span>${escapeHtml(bodyWeightText(runner))}</span><span>${escapeHtml(runner.jockey || '騎手未定')}</span><span>${escapeHtml(Engine.STYLE_LABELS[runner.runningStyle] || '脚質不明')}</span></span><span class="runner-reason">${escapeHtml(runner.reason)}</span></span>
        <span class="runner-score"><strong>${formatNumber(runner.score, 1)}</strong><span>${runner.rank}位 / 100点</span><span class="odds${Number.isFinite(Number(currentOdds)) ? '' : ' is-missing'}">${escapeHtml(oddsText)}</span></span>
      </button>`;
    }).join('');
  }

  function renderTickets() {
    const race = currentRace();
    if (!race) { nodes.ticketGroups.innerHTML = '<div class="empty-state">レースを選択してください</div>'; return; }
    const prediction = getPrediction(race);
    if (!prediction) {
      nodes.ticketConfidence.textContent = '予想公開待ち';
      nodes.budgetInput.value = state.budget;
      nodes.budgetInput.disabled = false;
      nodes.budgetOutput.textContent = formatNumber(state.budget);
      document.querySelectorAll('[data-budget]').forEach(button => {
        button.disabled = false;
        button.classList.toggle('is-active', Number(button.dataset.budget) === Number(state.budget));
      });
      nodes.ticketSummary.innerHTML = '';
      nodes.ticketGroups.innerHTML = '<div class="empty-state">この版の予想データはまだ公開されていません。</div>';
      return;
    }
    const savedPlan = ['pre-race', 'pending-save'].includes(prediction.captureStatus) ? prediction.ticketPlan : null;
    const lockedPlan = Boolean(savedPlan && !isCaptureWindowOpen(race, state.edition));
    const displayBudget = savedPlan ? prediction.budget : state.budget;
    const plan = savedPlan || Engine.createTickets(prediction, displayBudget);
    nodes.budgetInput.value = displayBudget;
    nodes.budgetInput.disabled = Boolean(lockedPlan);
    nodes.budgetOutput.textContent = formatNumber(displayBudget);
    nodes.ticketConfidence.textContent = prediction.ticketPlanStatus === 'pending-save'
      ? `予算保存中 · 自信度 ${prediction.confidence.value}`
      : prediction.captureStatus === 'pending-save'
      ? `保存中 · 自信度 ${prediction.confidence.value}`
      : lockedPlan ? `発走前保存 · 自信度 ${prediction.confidence.value}`
        : prediction.captureStatus === 'save-failed' ? `未保存 · 自信度 ${prediction.confidence.value}`
          : prediction.retrospective ? `結果後の参考 · 自信度 ${prediction.confidence.value}`
            : savedPlan ? `予想保存済・予算変更可 · 自信度 ${prediction.confidence.value}` : `自信度 ${prediction.confidence.value} · ${prediction.confidence.label}`;
    document.querySelectorAll('[data-budget]').forEach(button => {
      button.disabled = Boolean(lockedPlan);
      button.classList.toggle('is-active', Number(button.dataset.budget) === Number(displayBudget));
    });
    if (!plan.tickets.length) {
      nodes.ticketSummary.innerHTML = `<div class="ticket-metric"><strong>0</strong><span>買い目</span></div><div class="ticket-metric"><strong>見送り</strong><span>判定</span></div><div class="ticket-metric"><strong>${prediction.confidence.value}</strong><span>自信度</span></div>`;
      nodes.ticketGroups.innerHTML = `<div class="empty-state">${escapeHtml(plan.reason || '買い目を作成できません')}</div>`;
      return;
    }
    const types = new Set(plan.tickets.map(ticket => ticket.type));
    nodes.ticketSummary.innerHTML = `<div class="ticket-metric"><strong>${plan.tickets.length}</strong><span>買い目</span></div><div class="ticket-metric"><strong>${types.size}</strong><span>券種</span></div><div class="ticket-metric"><strong>${formatNumber(plan.allocated)}円</strong><span>配分合計</span></div>`;
    const groups = [
      { label: '単勝・複勝', types: ['単勝', '複勝'] },
      { label: '馬連・ワイド・馬単', types: ['馬連', 'ワイド', '馬単'] },
      { label: '三連系', types: ['三連複', '三連単'] }
    ];
    nodes.ticketGroups.innerHTML = groups.map(group => {
      const tickets = plan.tickets.filter(ticket => group.types.includes(ticket.type));
      if (!tickets.length) return '';
      const subtotal = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
      return `<section class="ticket-group"><div class="ticket-group-heading"><h3>${group.label}</h3><span>${tickets.length}点 · ${formatNumber(subtotal)}円</span></div>${tickets.map(ticket => `<div class="ticket-row"><span class="ticket-type">${ticket.type}</span><span class="ticket-combo">${ticket.numbers.join(ticket.ordered ? ' → ' : ' − ')}<small>${escapeHtml(ticket.note)} · ${escapeHtml(ticket.names.join(' / '))}</small></span><span class="ticket-amount">${formatNumber(ticket.amount)}円</span></div>`).join('')}</section>`;
    }).join('');
  }

  function renderResult() {
    const race = currentRace();
    if (!race) { nodes.resultContent.innerHTML = '<div class="empty-state">レースを選択してください</div>'; return; }
    if (race.status === 'cancelled') {
      nodes.resultStatus.textContent = '開催中止';
      nodes.resultContent.innerHTML = '<article class="result-pending panel"><div class="pending-icon">中止</div><h3>このレースは開催中止です</h3><p>的中率・順位精度の集計対象には含めません。返還内容は公式発表を確認してください。</p></article>';
      renderRecords();
      return;
    }
    if (!Array.isArray(race.result?.order) || !race.result.order.length) {
      nodes.resultStatus.textContent = '結果待ち';
      nodes.resultContent.innerHTML = '<article class="result-pending panel"><div class="pending-icon">⌛</div><h3>結果はまだ確定していません</h3><p>結果データが入ると、保存済みの予想順位・印・買い目と自動照合します。前日版と当日最終版は別々に検証されます。</p></article>';
    } else {
      const prediction = getFrozenPrediction(race, state.edition);
      if (!prediction) {
        const names = new Map(race.horses.map(horse => [Number(horse.number), horse.name]));
        nodes.resultStatus.textContent = '検証対象外';
        nodes.resultContent.innerHTML = `<article class="result-pending panel"><div class="pending-icon">—</div><h3>発走前の予想が保存されていません</h3><p>結果確定後に作った予想は、過去的中率へ混ぜません。このレースは実着順だけを表示します。</p></article><div class="comparison-list">${race.result.order.map((number, index) => `<div class="comparison-row"><span class="finish-badge${index < 3 ? ' is-medal' : ''}">${index + 1}着</span><span class="comparison-name">${escapeHtml(names.get(Number(number)) || `馬番${Number(number)}`)}</span><span class="comparison-predicted">${Number(number)}番</span><span class="rank-diff">予想なし</span></div>`).join('')}</div>`;
        renderRecords();
        return;
      }
      const plan = prediction.ticketPlan || Engine.createTickets(prediction, prediction.budget || 3000);
      const comparison = Engine.compareResult(prediction, race.result, plan);
      nodes.resultStatus.textContent = prediction.captureStatus === 'demo-replay' ? `${state.edition === 'dayBefore' ? '前日版' : '当日版'}・架空デモ再現` : prediction.captureStatus === 'provider-snapshot' ? '提供済み発走前データを照合' : `${state.edition === 'dayBefore' ? '前日版' : '当日版'}の発走前予想を照合`;
      const ticketRows = comparison.ticketResults.map(ticket => `<div class="ticket-result-row${ticket.hit ? ' is-hit' : ''}${ticket.refunded ? ' is-refund' : ''}"><span class="ticket-type">${ticket.type}</span><span><strong>${ticket.numbers.join(ticket.ordered ? ' → ' : ' − ')}</strong><small>${ticket.refunded ? '返還' : ticket.hit ? '的中' : ticket.returnKnown ? '不的中' : '判定保留'} · ${formatNumber(ticket.amount)}円</small></span><strong>${ticket.returnAmount === null ? '未登録' : `${formatNumber(ticket.returnAmount)}円`}</strong></div>`).join('');
      nodes.resultContent.innerHTML = `<div class="result-scorecard">
        <article class="result-metric"><span>◎の1着</span><strong>${comparison.winnerHit ? '的中' : '不的中'}</strong><small>${comparison.winnerHit ? '本命が勝利' : `勝馬は予想${comparison.comparisons[0]?.predictedRank || '圏外'}位`}</small></article>
        <article class="result-metric"><span>◎の複勝圏</span><strong>${comparison.mainPlaced === null ? '発売なし' : comparison.mainPlaced ? '的中' : '不的中'}</strong><small>${comparison.mainPlaced === null ? '4頭以下' : (prediction.fieldSize || prediction.runners.length) >= 8 ? '3着以内' : '2着以内'}</small></article>
        <article class="result-metric"><span>Top3一致</span><strong>${comparison.top3Overlap}/3</strong><small>${comparison.exactTop3 ? '3頭すべて一致' : '集合としての一致数'}</small></article>
        <article class="result-metric"><span>平均順位差</span><strong>${formatNumber(comparison.meanRankError, 2)}</strong><small>小さいほど高精度</small></article>
      </div><div class="comparison-list">${comparison.comparisons.map(item => {
        const difference = item.difference;
        const differenceLabel = difference === null ? '予想外' : difference === 0 ? '一致' : difference > 0 ? `${difference}位上振れ` : `${Math.abs(difference)}位下振れ`;
        const capturedOdds = Number.isFinite(Number(item.odds)) ? ` · 単${formatNumber(item.odds, 1)}` : '';
        return `<div class="comparison-row"><span class="finish-badge${item.finish <= 3 ? ' is-medal' : ''}">${item.finish}着</span><span class="comparison-name">${escapeHtml(item.name)} <small>${item.number}番 ${item.mark || ''}</small></span><span class="comparison-predicted">予想${item.predictedRank || '—'}位${capturedOdds}</span><span class="rank-diff${difference === 0 ? ' is-good' : Math.abs(difference || 0) >= 4 ? ' is-bad' : ''}">${differenceLabel}</span></div>`;
      }).join('')}</div><section class="ticket-result-section"><div class="ticket-result-heading"><div><h3>買い目の結果</h3><p>保存予算 ${formatNumber(plan.allocated || prediction.budget || 0)}円</p></div><strong>${comparison.returnRate === null ? '払戻未登録' : `回収率 ${formatNumber(comparison.returnRate, 1)}%`}</strong></div><div class="ticket-result-list">${ticketRows || '<div class="empty-state">保存された買い目がありません</div>'}</div></section>`;
    }
    renderRecords();
  }

  function renderRecords() {
    const resolver = (race, edition) => getFrozenPrediction(race, edition);
    const storedSignature = hashString(Object.entries(state.predictions).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value?.capturedAt || ''}`).join('|'));
    const planSignature = hashString(Object.entries(state.ticketPlans).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value?.savedAt || ''}:${value?.budget || ''}`).join('|'));
    const aggregate = edition => {
      const key = `${datasetFingerprint()}:${state.dataset?.generatedAt || ''}:${hashWeights(state.weights)}:${storedSignature}:${planSignature}:${edition}`;
      if (!state.recordCache.has(key)) {
        state.recordCache.set(key, Engine.aggregateRecords(state.dataset.races, edition, state.weights, resolver));
        while (state.recordCache.size > 6) state.recordCache.delete(state.recordCache.keys().next().value);
      }
      return state.recordCache.get(key);
    };
    const record = aggregate(state.edition);
    const otherEdition = state.edition === 'dayBefore' ? 'final' : 'dayBefore';
    const otherRecord = aggregate(otherEdition);
    nodes.recordRaceCount.textContent = `${record.overall.count}レース${state.dataset?.source?.mode === 'demo' ? '（架空デモ）' : ''}`;
    const previous = state.edition === 'dayBefore' ? record : otherRecord;
    const final = state.edition === 'final' ? record : otherRecord;
    nodes.editionComparison.innerHTML = `<div><span>前日版</span><strong>◎ ${formatNumber(previous.overall.winRate, 1)}%</strong><small>Top3 ${formatNumber(previous.overall.top3Rate, 1)}% · ${previous.overall.count}R</small></div><div><span>当日最終版</span><strong>◎ ${formatNumber(final.overall.winRate, 1)}%</strong><small>Top3 ${formatNumber(final.overall.top3Rate, 1)}% · ${final.overall.count}R</small></div>`;
    const returnRate = record.overall.returnRate;
    nodes.recordDashboard.innerHTML = `<div class="record-kpi"><strong>${formatNumber(record.overall.winRate, 1)}%</strong><span>◎勝率</span></div><div class="record-kpi"><strong>${record.overall.placeRate === null ? '—' : `${formatNumber(record.overall.placeRate, 1)}%`}</strong><span>◎複勝率</span></div><div class="record-kpi"><strong>${formatNumber(record.overall.top3Rate, 1)}%</strong><span>Top3一致</span></div><div class="record-kpi"><strong>${returnRate === null ? '—' : `${formatNumber(returnRate, 1)}%`}</strong><span>回収率</span></div>`;
    nodes.recordTableBody.innerHTML = record.groups.map(group => `<tr><td>${escapeHtml(group.label)}</td><td>${formatNumber(group.winRate, 1)}%</td><td>${group.placeRate === null ? '—' : `${formatNumber(group.placeRate, 1)}%`}</td><td>${formatNumber(group.top3Rate, 1)}%</td><td>${group.count}R</td></tr>`).join('') || '<tr><td colspan="5">確定レースがありません</td></tr>';
    nodes.ticketRecordBody.innerHTML = record.ticketGroups.map(group => `<tr><td>${escapeHtml(group.type)}</td><td>${group.hitCount}/${group.betCount}</td><td>${formatNumber(group.stake)}円</td><td>${group.returnsKnown ? `${formatNumber(group.returns)}円` : '—'}</td><td>${group.returnRate === null ? '—' : `${formatNumber(group.returnRate, 1)}%`}</td></tr>`).join('') || '<tr><td colspan="5">発走前に保存された買い目がありません</td></tr>';
  }

  function renderSettings() {
    const total = Object.values(state.weights).reduce((sum, value) => sum + Number(value), 0);
    nodes.weightList.innerHTML = Engine.CATEGORY_META.map(category => {
      const value = Number(state.weights[category.key]);
      return `<div class="weight-row"><label>${escapeHtml(category.label)}</label><div class="weight-track"><div class="weight-fill" style="width:${Math.min(100, value / 22 * 100)}%"></div></div><strong>${formatNumber(value, value % 1 ? 1 : 0)}</strong></div>`;
    }).join('');
    nodes.weightTotal.textContent = `${formatNumber(total, total % 1 ? 1 : 0)}点`;
    const source = state.dataset?.source || {};
    const synthetic = source.mode === 'demo';
    const unavailable = source.mode === 'unavailable';
    const asOfGuaranteed = source.asOfFieldsGuaranteed === true;
    nodes.learningStatus.textContent = synthetic ? 'デモでは停止' : unavailable ? '実データ待ち' : !asOfGuaranteed ? '保証待ち' : state.autoLearning ? '自動検証中' : '検証可能';
    nodes.learningStatus.className = `status-pill ${synthetic || unavailable || !asOfGuaranteed ? 'is-warning' : 'is-ok'}`;
    const eligibleHistory = asOfGuaranteed ? state.dataset?.races?.filter(race => Engine.isHistoricalRaceEligible(race, 'final')).length || 0 : 0;
    nodes.learningDescription.textContent = synthetic
      ? '架空データで改善済みとは表示しません。利用許諾済みの確定レースを端末へ読み込むと、過去1年を時系列で分割して検証できます。'
      : unavailable
        ? 'まずJRA公式の詳細出馬表HTMLを端末内へ取り込んでください。発走前に保存した予想だけを、結果取込後に検証します。'
      : asOfGuaranteed
        ? `提供元が発走前時点で固定済みと保証した確定${eligibleHistory}レースを、開催日単位で古い60%・中間20%・新しい20%へ分けて検証します。`
        : '特徴量が発走前時点で固定済みという提供元保証がないため、配点学習は実行しません。';
    nodes.runLearningButton.disabled = synthetic || unavailable || !asOfGuaranteed;
    nodes.dataGeneratedAt.textContent = `更新 ${formatTimestamp(state.dataset?.generatedAt)}`;
    nodes.dataStatusPill.textContent = synthetic ? '架空デモ' : unavailable ? '未取込' : source.mode === 'local-jra' ? 'JRA端末内' : state.datasetOrigin === 'imported' ? '端末内' : source.automated ? '自動更新' : '接続済み';
    nodes.dataStatusPill.className = `status-pill ${synthetic || unavailable ? 'is-warning' : 'is-ok'}`;
    nodes.dataSourceCopy.textContent = synthetic
      ? '現在は実在のレース・馬・オッズではないUI確認用データです。JRA公式ページの無断自動取得・再配布は行っていません。'
      : unavailable
        ? '架空レースは表示しません。PCで保存したJRA公式の詳細出馬表・結果HTMLを、外部送信せずこの端末内だけで解析します。'
      : `${source.name || 'インポートデータ'}。予想計算にはオッズを使わず、画面表示だけに結合します。`;
    nodes.weightChangeLog.innerHTML = state.changes.slice(0, 4).map(change => `<div class="change-item"><strong>${escapeHtml(change.adopted ? '配点更新' : '据え置き')}</strong> · ${escapeHtml(formatTimestamp(change.at))}<br>${escapeHtml(change.reason)}${change.validation ? `（検証 ${change.validation.before} → ${change.validation.after}）` : ''}</div>`).join('');
  }

  function renderAll() {
    renderSourceStatus();
    renderRaceView();
    switchView(state.view, false);
  }

  function switchView(view, focus = true) {
    state.view = view;
    document.querySelectorAll('.view').forEach(section => {
      const active = section.dataset.view === view;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-nav]').forEach(button => {
      const active = button.dataset.nav === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (view === 'tickets') renderTickets();
    if (view === 'results') renderResult();
    if (view === 'settings') renderSettings();
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      nodes.mainContent.focus({ preventScroll: true });
    }
  }

  function openBreakdown() {
    const race = currentRace();
    const prediction = getPrediction(race);
    if (!prediction) return;
    const top = prediction.runners.slice(0, 7);
    nodes.breakdownContent.innerHTML = `<div class="breakdown-scroll"><table class="breakdown-table"><thead><tr><th>項目</th>${top.map(runner => `<th>${runner.mark} ${runner.number}番<br>${escapeHtml(runner.name)}</th>`).join('')}</tr></thead><tbody>${Engine.CATEGORY_META.map(category => `<tr><td>${escapeHtml(category.label)}<br><small>配点 ${formatNumber(prediction.weights?.[category.key] ?? state.weights[category.key], 1)}</small></td>${top.map(runner => { const cell = breakdownCell(runner, category, prediction.weights); return `<td><span class="score-mini">${formatNumber(cell.points, 1)}</span> / ${formatNumber(cell.weight, 1)}<br><small>充足${formatNumber(cell.coverage * 100, 0)}%</small></td>`; }).join('')}</tr>`).join('')}<tr><td><strong>合計</strong></td>${top.map(runner => `<td><strong class="score-mini">${formatNumber(runner.score, 1)}</strong></td>`).join('')}</tr></tbody></table></div>`;
    openSheet(nodes.breakdownBackdrop);
  }

  function openRunner(number) {
    const race = currentRace();
    const prediction = getPrediction(race);
    const runner = prediction?.runners.find(item => Number(item.number) === Number(number));
    if (!runner) return;
    nodes.runnerSheetEyebrow.textContent = `${runner.mark} 予想${runner.rank}位 · ${state.edition === 'dayBefore' ? '前日版' : '当日最終版'}`;
    nodes.runnerSheetTitle.textContent = runner.name;
    nodes.runnerSheetContent.innerHTML = `<div class="runner-profile"><span class="horse-number" style="${frameStyle(runner.gate)}">${runner.number}<small>${formatNumber(runner.gate)}枠</small></span><div><h3>${escapeHtml(runner.name)}</h3><p>${escapeHtml(runner.sexAge || '')} · 斤量${formatNumber(runner.carriedWeight, 1)}kg · ${escapeHtml(runner.jockey || '騎手未定')}<br>${escapeHtml(bodyWeightText(runner))} · ${escapeHtml(runner.trainer || '調教師不明')} · ${escapeHtml(Engine.STYLE_LABELS[runner.runningStyle] || '脚質不明')}</p><div class="profile-score"><strong>${formatNumber(runner.score, 1)}</strong><span>点 · データ充足度 ${runner.coverage}%</span></div></div></div>
      <section class="detail-section"><h3>評価理由</h3><div class="reason-box">${escapeHtml(runner.reason)}</div></section>
      <section class="detail-section"><h3>10項目の内訳</h3><div class="score-breakdown">${Engine.CATEGORY_META.map(category => { const score = breakdownCell(runner, category, prediction.weights); return `<div class="score-cell"><span>${escapeHtml(category.label)}</span><strong>${formatNumber(score.points, 1)} / ${formatNumber(score.weight, 1)}点</strong><span>充足度 ${formatNumber(score.coverage * 100, 0)}% · ${escapeHtml(score.evidence?.[0] || '保存時の根拠なし')}</span></div>`; }).join('')}</div></section>
      <section class="detail-section"><h3>直近5走</h3><div class="history-scroll"><table class="history-table"><thead><tr><th>日付・競馬場</th><th>条件</th><th>着順</th><th>着差</th><th>上がり</th><th>指数</th></tr></thead><tbody>${Array.isArray(runner.recentRuns) && runner.recentRuns.length ? runner.recentRuns.slice(0, 5).map(run => `<tr><td>${escapeHtml(run.date)} ${escapeHtml(run.venue)}</td><td>${escapeHtml(SURFACE_LABELS[run.surface] || run.surface || '不明')}${formatNumber(run.distance)}m ${escapeHtml(GOING_LABELS[run.going] || run.going || '')}</td><td>${formatNumber(run.finish)} / ${formatNumber(run.fieldSize)}</td><td>${Number(run.margin) <= 0 ? '1着' : `+${formatNumber(run.margin, 1)}`}</td><td>${formatNumber(run.last3F, 1)}（${formatNumber(run.last3FRank)}位）</td><td>${formatNumber(run.speedRating)}</td></tr>`).join('') : '<tr><td colspan="6">近走データがありません</td></tr>'}</tbody></table></div></section>`;
    openSheet(nodes.runnerBackdrop);
  }

  let sheetOpener = null;
  function openSheet(backdrop) {
    sheetOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.hidden = false;
    document.body.classList.add('is-locked');
    document.querySelector('.app-shell').inert = true;
    document.querySelector('.bottom-nav').inert = true;
    requestAnimationFrame(() => backdrop.querySelector('.sheet-close')?.focus());
  }

  function closeSheet(backdrop) {
    backdrop.hidden = true;
    if (nodes.breakdownBackdrop.hidden && nodes.runnerBackdrop.hidden) {
      document.body.classList.remove('is-locked');
      document.querySelector('.app-shell').inert = false;
      document.querySelector('.bottom-nav').inert = false;
      const opener = sheetOpener;
      sheetOpener = null;
      requestAnimationFrame(() => opener?.focus());
    }
  }

  function setBudget(value) {
    const race = currentRace();
    state.budget = normalizeBudget(value);
    writeJson(STORAGE_KEYS.budget, state.budget);
    if (race && state.dataset?.source?.mode !== 'demo' && isEditionAvailable(race, state.edition) && isCaptureWindowOpen(race, state.edition)) {
      const key = snapshotKey(race, state.edition);
      const prediction = state.predictions[key] || state.pendingPredictions[key];
      if (prediction) saveTicketPlanRevision(race, prediction, state.budget);
      else savePrediction(race, Engine.scoreRace(race, state.edition, state.weights), state.budget);
    }
    renderTickets();
  }

  async function importJraHtmlFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    try {
      if (!JraImporter) throw new Error('JRA HTML取込機能を初期化できませんでした');
      const snapshotMode = nodes.jraSnapshotMode.value;
      if (!['dayBefore', 'final', 'reference'].includes(snapshotMode)) throw new Error('出馬表の取込方法を選んでください');
      if (files.length > 48) throw new Error('一度に読み込めるのは48ファイルまでです');
      if (files.some(file => file.size > 8 * 1024 * 1024)) throw new Error('1ファイル8MB以内にしてください');
      if (files.reduce((sum, file) => sum + file.size, 0) > 32 * 1024 * 1024) throw new Error('合計32MB以内にしてください');
      if (files.some(file => !/\.html?$/i.test(file.name) && file.type !== 'text/html')) throw new Error('JRAページをHTML形式で保存したファイルを選んでください');
      const htmlEntries = [];
      for (const file of files) {
        const html = JraImporter.decodeHtml(await file.arrayBuffer());
        const inspected = JraImporter.inspectHtml(html);
        htmlEntries.push({ html, fileName: file.name, lastModified: file.lastModified, ...inspected });
      }
      const importedAt = new Date().toISOString();
      const duplicateKeys = new Set();
      htmlEntries.forEach(entry => {
        const key = `${entry.kind}:${entry.raceId}`;
        if (duplicateKeys.has(key)) throw new Error(`同じレースの${entry.kind === 'card' ? '出馬表' : '結果'}HTMLは一度に1件だけ選んでください`);
        duplicateKeys.add(key);
      });
      if (snapshotMode !== 'reference') {
        const importedTime = Date.parse(importedAt);
        const staleCard = htmlEntries.find(entry => entry.kind === 'card' && (!Number.isFinite(entry.lastModified)
          || importedTime - entry.lastModified > 30 * 60 * 1000 || entry.lastModified - importedTime > 5 * 60 * 1000));
        if (staleCard) throw new Error('版の確定には、30分以内に保存した出馬表HTMLを使用してください');
      }
      htmlEntries.sort((a, b) => (a.kind === 'card' ? 0 : 1) - (b.kind === 'card' ? 0 : 1));
      let imported;
      try {
        imported = await idbImportJraHtml(htmlEntries, importedAt, snapshotMode);
      } catch (error) {
        if (error?.code !== 'NON_JRA_DATASET') throw error;
        if (!window.confirm('現在端末に保存されているJSON取込データを、JRA HTMLの端末内データへ切り替えますか？')) return;
        imported = await idbImportJraHtml(htmlEntries, importedAt, snapshotMode, true);
      }
      state.dataset = imported.dataset;
      state.datasetOrigin = 'imported';
      state.recordCache.clear();
      const hasCards = imported.summaries.some(item => item.kind === 'card');
      const selected = (hasCards ? imported.summaries.filter(item => item.kind === 'card').at(-1) : imported.summaries.at(-1))?.race;
      if (selected) {
        state.date = selected.date;
        state.venue = selected.venue;
        state.raceNumber = selected.raceNumber;
        if (hasCards && (snapshotMode === 'dayBefore' || snapshotMode === 'final')) state.edition = snapshotMode;
      }
      normalizeSelection();
      captureEligiblePredictions();
      renderControls();
      renderAll();
      const cards = imported.summaries.filter(item => item.kind === 'card').length;
      const results = imported.summaries.filter(item => item.kind === 'result').length;
      const summary = [cards ? `出馬表${cards}件` : '', results ? `結果${results}件` : ''].filter(Boolean).join('・');
      const edition = cards && snapshotMode === 'dayBefore' ? '・前日版を確定' : cards && snapshotMode === 'final' ? '・当日最終版を確定' : '';
      showToast(`${summary}を端末内へ取り込みました${edition}`);
    } catch (error) {
      console.error(error);
      showToast(`JRA HTML取込失敗: ${error.message || '保存したページを確認してください'}`);
    } finally {
      nodes.jraHtmlImportInput.value = '';
    }
  }

  async function importDataset(file) {
    if (!file) return;
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error('40MBを超えるファイルは読み込めません');
      const text = await file.text();
      const payload = JSON.parse(text);
      Engine.validateDataset(payload);
      await idbSet('active-import', payload);
      state.dataset = payload;
      state.datasetOrigin = 'imported';
      state.recordCache.clear();
      normalizeSelection();
      captureEligiblePredictions();
      renderControls();
      renderAll();
      maybeAutoLearn();
      showToast(`${payload.races.length}レースを端末内へ読み込みました`);
    } catch (error) {
      console.error(error);
      showToast(`読み込み失敗: ${error.message || 'JSONを確認してください'}`);
    } finally {
      nodes.dataImportInput.value = '';
    }
  }

  async function restoreBundled() {
    try {
      await idbDelete('active-import');
      showToast('取込レースを消しました。予想・買い目履歴は残しています');
      await loadDataset({ force: true, ignoreImport: true });
    } catch (error) {
      console.error(error);
      showToast('取込レースを削除できませんでした');
    }
  }

  function optimizeWeightsOffMainThread(races, weights) {
    if (!('Worker' in window)) return Promise.reject(new Error('このブラウザはバックグラウンド検証に対応していません'));
    return new Promise((resolve, reject) => {
      const worker = new Worker('./learning-worker.js?v=130');
      const timeout = window.setTimeout(() => {
        worker.terminate();
        reject(new Error('配点検証が時間内に完了しませんでした'));
      }, 90_000);
      const finish = callback => value => {
        window.clearTimeout(timeout);
        worker.terminate();
        callback(value);
      };
      worker.addEventListener('message', finish(event => {
        if (event.data?.ok) resolve(event.data.result);
        else reject(new Error(event.data?.error || '配点検証に失敗しました'));
      }), { once: true });
      worker.addEventListener('error', finish(event => reject(new Error(event.message || '配点検証ワーカーを起動できません'))), { once: true });
      worker.postMessage({ races, weights });
    });
  }

  async function runLearning() {
    if (state.dataset?.source?.mode === 'demo') { showToast('架空デモでは配点を更新しません'); return; }
    if (state.dataset?.source?.asOfFieldsGuaranteed !== true) { showToast('発走前時点の特徴量保証がないため検証できません'); return; }
    nodes.learningStatus.textContent = '検証中';
    nodes.runLearningButton.disabled = true;
    try {
      const result = await optimizeWeightsOffMainThread(state.dataset.races, state.weights);
      if (result.adopted) {
        state.weights = result.weights;
        writeJson(STORAGE_KEYS.weights, state.weights);
        captureEligiblePredictions();
      }
      const change = {
        at: new Date().toISOString(),
        adopted: result.adopted,
        reason: result.reason,
        sampleSize: result.sampleSize,
        validation: result.validationScoreBefore === undefined ? null : { before: result.validationScoreBefore, after: result.validationScoreAfter }
      };
      state.changes.unshift(change);
      state.changes = state.changes.slice(0, 20);
      writeJson(STORAGE_KEYS.changes, state.changes);
      renderAll();
      showToast(result.adopted ? '検証成績が改善したため配点を更新しました' : result.reason);
    } catch (error) {
      console.error(error);
      showToast(error.message || '配点検証中にエラーが発生しました');
    } finally {
      nodes.runLearningButton.disabled = false;
    }
  }

  async function maybeAutoLearn() {
    if (state.autoLearning || state.dataset?.source?.mode === 'demo' || state.dataset?.source?.asOfFieldsGuaranteed !== true) return;
    const finalizedCount = state.dataset.races.filter(race => Engine.isHistoricalRaceEligible(race, 'final')).length;
    if (finalizedCount < 120) return;
    const signature = hashString(`${datasetFingerprint()}:${state.dataset.generatedAt || ''}:${finalizedCount}`);
    if (localStorage.getItem(STORAGE_KEYS.lastAutoLearn) === signature) return;
    state.autoLearning = true;
    nodes.learningStatus.textContent = '自動検証中';
    try {
      const result = await optimizeWeightsOffMainThread(state.dataset.races, state.weights);
      if (result.adopted) {
        state.weights = result.weights;
        writeJson(STORAGE_KEYS.weights, state.weights);
        state.changes.unshift({
          at: new Date().toISOString(),
          adopted: true,
          reason: `自動検証: ${result.reason}`,
          sampleSize: result.sampleSize,
          validation: { before: result.validationScoreBefore, after: result.validationScoreAfter }
        });
        state.changes = state.changes.slice(0, 20);
        writeJson(STORAGE_KEYS.changes, state.changes);
        captureEligiblePredictions();
        showToast('新しい結果を検証し、配点を更新しました');
      }
      localStorage.setItem(STORAGE_KEYS.lastAutoLearn, signature);
    } catch (error) {
      console.error(error);
    } finally {
      state.autoLearning = false;
      renderAll();
    }
  }

  function resetWeights() {
    state.weights = { ...Engine.DEFAULT_WEIGHTS };
    writeJson(STORAGE_KEYS.weights, state.weights);
    captureEligiblePredictions();
    renderAll();
    showToast('初期配点100点へ戻しました');
  }

  let toastTimer = 0;
  function showToast(message) {
    window.clearTimeout(toastTimer);
    nodes.toast.textContent = message;
    nodes.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => nodes.toast.classList.remove('is-visible'), 2800);
  }

  function bindEvents() {
    nodes.refreshButton.addEventListener('click', () => loadDataset({ force: true }));
    nodes.dateSelect.addEventListener('change', event => {
      state.date = event.target.value;
      normalizeSelection();
      renderControls();
      renderAll();
    });
    nodes.venueTabs.addEventListener('click', event => {
      const button = event.target.closest('[data-venue]');
      if (!button || button.disabled) return;
      state.venue = button.dataset.venue;
      normalizeSelection();
      renderControls();
      renderAll();
    });
    nodes.venueTabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const tabs = [...nodes.venueTabs.querySelectorAll('[data-venue]:not(:disabled)')];
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
    nodes.raceStrip.addEventListener('click', event => {
      const button = event.target.closest('[data-race-number]');
      if (!button) return;
      state.raceNumber = Number(button.dataset.raceNumber);
      normalizeSelection();
      renderControls();
      renderAll();
    });
    document.querySelectorAll('[data-edition]').forEach(button => button.addEventListener('click', () => {
      state.edition = button.dataset.edition;
      normalizeSelection();
      renderControls();
      renderAll();
    }));
    document.querySelector('.bottom-nav').addEventListener('click', event => {
      const button = event.target.closest('[data-nav]');
      if (button) switchView(button.dataset.nav);
    });
    nodes.runnerList.addEventListener('click', event => {
      const button = event.target.closest('[data-runner-number]');
      if (button) openRunner(button.dataset.runnerNumber);
    });
    nodes.openBreakdownButton.addEventListener('click', openBreakdown);
    nodes.closeBreakdownButton.addEventListener('click', () => closeSheet(nodes.breakdownBackdrop));
    nodes.closeRunnerButton.addEventListener('click', () => closeSheet(nodes.runnerBackdrop));
    [nodes.breakdownBackdrop, nodes.runnerBackdrop].forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeSheet(backdrop); }));
    document.addEventListener('keydown', event => {
      const backdrop = !nodes.runnerBackdrop.hidden ? nodes.runnerBackdrop : !nodes.breakdownBackdrop.hidden ? nodes.breakdownBackdrop : null;
      if (!backdrop) return;
      if (event.key === 'Escape') { closeSheet(backdrop); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...backdrop.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.disabled && !element.hidden);
      if (!focusable.length) { event.preventDefault(); backdrop.querySelector('.bottom-sheet')?.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    nodes.budgetInput.addEventListener('input', event => {
      if (!event.target.disabled) nodes.budgetOutput.textContent = formatNumber(normalizeBudget(event.target.value));
    });
    nodes.budgetInput.addEventListener('change', event => setBudget(event.target.value));
    document.querySelector('.budget-presets').addEventListener('click', event => {
      const button = event.target.closest('[data-budget]');
      if (button) setBudget(button.dataset.budget);
    });
    nodes.resetWeightsButton.addEventListener('click', resetWeights);
    nodes.runLearningButton.addEventListener('click', runLearning);
    nodes.jraHtmlImportButton.addEventListener('click', () => {
      if (!nodes.jraSnapshotMode.value) {
        showToast('先に出馬表の取込方法を選んでください');
        nodes.jraSnapshotMode.focus();
        return;
      }
      nodes.jraHtmlImportInput.click();
    });
    nodes.jraHtmlImportInput.addEventListener('change', event => importJraHtmlFiles(event.target.files));
    nodes.dataImportButton.addEventListener('click', () => nodes.dataImportInput.click());
    nodes.dataImportInput.addEventListener('change', event => importDataset(event.target.files?.[0]));
    nodes.restoreBundledButton.addEventListener('click', restoreBundled);
  }

  async function init() {
    if (!Engine || !JraImporter) {
      nodes.sourceSummary.textContent = '初期化に失敗しました';
      return;
    }
    [state.predictions, state.ticketPlans] = await Promise.all([idbGetPredictionSnapshots(), idbGetTicketPlanRevisions()]);
    const saved = readJson(STORAGE_KEYS.selected, null);
    if (saved) Object.assign(state, { date: saved.date || '', venue: saved.venue || '東京', raceNumber: Number(saved.raceNumber) || 11, edition: saved.edition === 'dayBefore' ? 'dayBefore' : 'final' });
    bindEvents();
    await loadDataset();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service Worker registration failed', error));
    }
  }

  init();
}());
