(function buildUmaLogDemo(root) {
  'use strict';

  const VENUES = [
    { name: '東京', code: 'tokyo', direction: 'left', drawBias: -.22 },
    { name: '中山', code: 'nakayama', direction: 'right', drawBias: -.42 },
    { name: '京都', code: 'kyoto', direction: 'right', drawBias: .08 }
  ];
  const DATES = ['2026-07-12', '2026-07-19', '2026-07-26', '2026-08-02', '2026-08-09'];
  const DISTANCES = [1200, 1800, 1400, 1600, 2000, 1400, 1800, 1200, 2200, 1600, 2000, 2400];
  const SURFACES = ['dirt', 'turf', 'dirt', 'turf', 'turf', 'dirt', 'turf', 'dirt', 'turf', 'turf', 'turf', 'turf'];
  const RACE_NAMES = ['3歳未勝利', '2歳新馬', '3歳未勝利', '3歳1勝クラス', '2歳新馬', '3歳以上1勝クラス', '3歳以上1勝クラス', '3歳以上2勝クラス', '特別競走', '特別競走', 'メイン競走', '3歳以上2勝クラス'];
  const CLASS_LEVELS = [1, 1, 1, 2, 1, 2, 2, 3, 3, 4, 5, 3];
  const PREFIXES = ['グリーン', 'ライト', 'ノーブル', 'スカイ', 'ミント', 'ブレイブ', 'ソニック', 'クリア', 'ラピッド', 'ルミナス', 'アーバン', 'コスモ'];
  const SUFFIXES = ['アロー', 'リーフ', 'スター', 'ウイング', 'ノート', 'リズム', 'ロード', 'ベル', 'ステップ', 'ライン', 'ハート', 'ムーン'];
  const JOCKEYS = ['青葉ユウ', '白川ソラ', '緑野レン', '橘ハル', '黒瀬リク', '水城ナオ', '朝倉レイ', '若松トワ', '藤森アキ', '桜井ケイ'];
  const TRAINERS = ['東山厩舎', '西森厩舎', '南谷厩舎', '北原厩舎', '中央厩舎', '若葉厩舎'];
  const STYLES = ['front', 'stalk', 'stalk', 'mid', 'mid', 'close'];
  const GOINGS = ['firm', 'good', 'yielding', 'soft'];

  function seedFrom(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function rng(seedValue) {
    let state = seedFrom(seedValue) || 1;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function between(random, min, max, digits = 0) {
    const value = min + random() * (max - min);
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function daysBefore(date, days) {
    const value = new Date(`${date}T00:00:00+09:00`);
    value.setDate(value.getDate() - days);
    return value.toISOString().slice(0, 10);
  }

  function formatTime(raceNumber) {
    const total = 9 * 60 + 50 + (raceNumber - 1) * 34;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function formatSnapshotTime(raceNumber) {
    const total = 9 * 60 + 30 + (raceNumber - 1) * 34;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function createRecentRuns(random, race, horseIndex, latent) {
    return Array.from({ length: 5 }, (_, index) => {
      const surface = random() < .68 ? race.surface : (race.surface === 'turf' ? 'dirt' : 'turf');
      const distanceShift = [-400, -200, 0, 200, 400][Math.floor(random() * 5)];
      const distance = clamp(race.distance + distanceShift, 1000, 2600);
      const fieldSize = 10 + Math.floor(random() * 7);
      const noise = between(random, -2.4, 2.6, 2);
      const finish = clamp(Math.round(fieldSize + 1 - latent * fieldSize + noise + index * .24), 1, fieldSize);
      const quality = clamp(latent + between(random, -.18, .18, 3), .08, .96);
      return {
        id: `${race.id}-h${horseIndex + 1}-run${index + 1}`,
        date: daysBefore(race.date, 21 + index * 28 + Math.floor(random() * 12)),
        venue: VENUES[Math.floor(random() * VENUES.length)].name,
        surface,
        distance,
        direction: random() < .52 ? 'left' : 'right',
        going: GOINGS[Math.floor(random() * GOINGS.length)],
        gate: 1 + Math.floor(random() * 8),
        finish,
        fieldSize,
        margin: finish === 1 ? between(random, -.6, 0, 1) : between(random, .1, Math.min(6, finish * .52), 1),
        last3F: between(random, surface === 'turf' ? 33.2 : 36.1, surface === 'turf' ? 37.5 : 40.4, 1),
        last3FRank: clamp(Math.round(fieldSize + 1 - quality * fieldSize + between(random, -1.5, 1.5)), 1, fieldSize),
        speedRating: Math.round(58 + quality * 60 + between(random, -5, 5)),
        classLevel: clamp(race.classLevel + Math.floor(between(random, -1.2, 1.8)), 1, 5),
        opponentRating: Math.round(clamp(47 + quality * 49 + between(random, -8, 8), 35, 100))
      };
    });
  }

  function createHorse(random, race, index) {
    const number = index + 1;
    const latent = clamp(.28 + random() * .62 + (10 - index) * .006, .15, .95);
    const prefix = PREFIXES[(index + race.raceNumber + Math.floor(random() * 4)) % PREFIXES.length];
    const suffix = SUFFIXES[(index * 3 + race.raceNumber + Math.floor(random() * 5)) % SUFFIXES.length];
    const workoutScore = Math.round(clamp(46 + latent * 48 + between(random, -10, 10), 30, 96));
    const bodyWeight = Math.round(between(random, 424, 530));
    const bodyWeightChange = Math.round(between(random, -11, 12));
    const winRate = clamp(.045 + latent * .16 + between(random, -.02, .025, 3), .03, .25);
    const placeRate = clamp(.18 + latent * .33 + between(random, -.04, .04, 3), .12, .6);
    const coursePlaceRate = clamp(placeRate + between(random, -.07, .08, 3), .08, .64);
    const pairPlaceRate = clamp(.12 + latent * .45 + between(random, -.08, .08, 3), .05, .66);
    const finalOdds = Math.round((1.6 + (1 - latent) ** 2 * 36 + random() * 5) * 10) / 10;
    return {
      id: `${race.id}-horse-${number}`,
      number,
      gate: Math.min(8, Math.ceil(number * 8 / 10)),
      name: `${prefix}${suffix}`,
      sexAge: `${random() < .48 ? '牡' : '牝'}${2 + Math.floor(random() * 5)}`,
      jockey: `${JOCKEYS[(index + race.raceNumber) % JOCKEYS.length]}（デモ）`,
      trainer: `${TRAINERS[(index + race.raceNumber) % TRAINERS.length]}（デモ）`,
      carriedWeight: random() < .45 ? 55 : random() < .72 ? 56 : 57,
      burdenChange: between(random, -2, 2, 1),
      restDays: Math.round(between(random, 14, 105)),
      runningStyle: STYLES[(index + Math.floor(random() * 3)) % STYLES.length],
      distanceFit: Math.round(clamp(42 + latent * 48 + between(random, -14, 14), 25, 97)),
      courseFit: Math.round(clamp(40 + latent * 46 + between(random, -15, 15), 22, 96)),
      goingFit: Math.round(clamp(42 + latent * 42 + between(random, -16, 16), 20, 97)),
      paceFit: Math.round(clamp(40 + latent * 45 + between(random, -17, 17), 20, 98)),
      drawFit: Math.round(clamp(40 + latent * 40 + between(random, -14, 14), 22, 95)),
      classFit: Math.round(clamp(39 + latent * 48 + between(random, -12, 12), 24, 97)),
      conditionScore: Math.round(clamp(43 + latent * 40 + between(random, -13, 13), 24, 96)),
      jockeyStats: { winRate, placeRate, coursePlaceRate, pairPlaceRate, pairStarts: 1 + Math.floor(random() * 14) },
      trainerStats: { placeRate: clamp(.17 + latent * .26 + between(random, -.05, .05, 3), .1, .52), coursePlaceRate: clamp(.15 + latent * .27 + between(random, -.06, .06, 3), .08, .55) },
      pedigree: { turfScore: Math.round(clamp(40 + latent * 43 + between(random, -13, 13), 20, 97)), dirtScore: Math.round(clamp(40 + latent * 43 + between(random, -13, 13), 20, 97)), distanceScore: Math.round(clamp(42 + latent * 40 + between(random, -14, 14), 20, 96)) },
      workout: { score: Math.max(25, workoutScore - Math.round(between(random, 0, 8))), label: workoutScore >= 78 ? '良好' : workoutScore >= 62 ? '順調' : '平行線' },
      recentRuns: createRecentRuns(random, race, index, latent),
      versions: {
        dayBefore: { odds: null, popularity: null, bodyWeight: null, bodyWeightChange: null, conditionScore: null },
        final: { odds: finalOdds, bodyWeight, bodyWeightChange, workout: { score: workoutScore, label: workoutScore >= 78 ? '良好' : workoutScore >= 62 ? '順調' : '平行線' } }
      },
      _demoLatent: latent
    };
  }

  function resultPayouts(order, random) {
    const [first, second, third] = order;
    const unordered2 = [first, second].sort((a, b) => a - b);
    const unordered3 = [first, second, third].sort((a, b) => a - b);
    const widePairs = [[first, second], [first, third], [second, third]].map(pair => pair.sort((a, b) => a - b));
    return [
      { type: '単勝', numbers: [first], payoutPer100: Math.round(between(random, 180, 1900) / 10) * 10 },
      { type: '複勝', numbers: [first], payoutPer100: Math.round(between(random, 110, 480) / 10) * 10 },
      { type: '複勝', numbers: [second], payoutPer100: Math.round(between(random, 120, 620) / 10) * 10 },
      { type: '複勝', numbers: [third], payoutPer100: Math.round(between(random, 130, 760) / 10) * 10 },
      { type: '馬連', numbers: unordered2, payoutPer100: Math.round(between(random, 550, 8500) / 10) * 10 },
      ...widePairs.map(numbers => ({ type: 'ワイド', numbers, payoutPer100: Math.round(between(random, 260, 3400) / 10) * 10 })),
      { type: '馬単', numbers: [first, second], payoutPer100: Math.round(between(random, 900, 15000) / 10) * 10 },
      { type: '三連複', numbers: unordered3, payoutPer100: Math.round(between(random, 1100, 26000) / 10) * 10 },
      { type: '三連単', numbers: [first, second, third], payoutPer100: Math.round(between(random, 4200, 98000) / 10) * 10 }
    ];
  }

  function createRace(date, venue, raceNumber, isFinal) {
    const random = rng(`${date}-${venue.code}-${raceNumber}`);
    const surface = SURFACES[raceNumber - 1];
    const distance = DISTANCES[raceNumber - 1] + (venue.code === 'nakayama' && raceNumber % 4 === 0 ? 200 : 0);
    const base = {
      id: `demo-${date}-${venue.code}-${String(raceNumber).padStart(2, '0')}`,
      date,
      venue: venue.name,
      meetingLabel: '架空開催・UI確認用',
      raceNumber,
      startTime: formatTime(raceNumber),
      name: RACE_NAMES[raceNumber - 1],
      classLevel: CLASS_LEVELS[raceNumber - 1],
      surface,
      raceType: 'flat',
      distance,
      direction: venue.direction,
      weather: 'sunny',
      going: GOINGS[(raceNumber + VENUES.indexOf(venue)) % GOINGS.length],
      pace: ['middle', 'fast', 'middle', 'slow'][(raceNumber + VENUES.indexOf(venue)) % 4],
      drawBias: venue.drawBias + between(random, -.12, .12, 2),
      status: isFinal ? 'final' : 'scheduled',
      versions: {
        dayBefore: { weather: null, going: 'good', drawBias: venue.drawBias },
        final: {}
      },
      snapshots: {
        dayBefore: { asOf: `${daysBefore(date, 1)}T10:00:00+09:00`, label: '前日版', ready: true },
        final: { asOf: `${date}T${formatSnapshotTime(raceNumber)}:00+09:00`, label: '当日最終', ready: true }
      }
    };
    base.horses = Array.from({ length: 10 }, (_, index) => createHorse(random, base, index));
    const byOdds = base.horses.slice().sort((a, b) => a.versions.final.odds - b.versions.final.odds);
    byOdds.forEach((horse, index) => { horse.versions.final.popularity = index + 1; });
    if (isFinal) {
      const order = base.horses.slice().sort((a, b) => {
        const performanceA = a._demoLatent + between(rng(`${base.id}-${a.number}-result`), -.22, .22, 4);
        const performanceB = b._demoLatent + between(rng(`${base.id}-${b.number}-result`), -.22, .22, 4);
        return performanceB - performanceA || a.number - b.number;
      }).map(horse => horse.number);
      base.result = { status: 'final', confirmedAt: `${date}T18:00:00+09:00`, order, payouts: resultPayouts(order, random) };
    }
    base.horses.forEach(horse => { delete horse._demoLatent; });
    return base;
  }

  const races = [];
  DATES.forEach((date, dateIndex) => {
    VENUES.forEach(venue => {
      for (let raceNumber = 1; raceNumber <= 12; raceNumber += 1) races.push(createRace(date, venue, raceNumber, dateIndex < DATES.length - 1));
    });
  });

  root.UMA_LOG_DEMO = {
    schemaVersion: 1,
    generatedAt: '2026-08-09T00:00:00+09:00',
    source: {
      mode: 'demo',
      datasetId: 'uma-log-ai-demo-v1',
      name: '架空デモデータ',
      detail: '実在の開催・馬・オッズではありません',
      redistributable: true,
      automated: false
    },
    venues: VENUES.map(venue => venue.name),
    races
  };
}(typeof window !== 'undefined' ? window : globalThis));
