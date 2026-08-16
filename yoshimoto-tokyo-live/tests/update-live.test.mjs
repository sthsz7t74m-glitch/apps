import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiveData,
  performanceToEvent,
  parseFanyPage,
  serializeDataJs
} from "../scripts/update-live.mjs";

const venue = {
  id: "jimbocho",
  name: "神保町よしもと漫才劇場",
  venue: "神保町よしもと漫才劇場",
  area: "神保町",
  url: "https://ticket.fany.lol/jimbocho_manzaigekijyo"
};

test("FANYの劇場ページから公演日時・タイトル・出演者を抽出する", () => {
  const html = `
    <article>
      <h4>2026/08/17(月)開場 16:45 開演 17:00</h4>
      <h3>神保町Kakeru翔SPプラス＋</h3>
      <p>神保町よしもと漫才劇場（東京都）</p>
      <p>出演</p>
      <p>[ネタ出演者]シカゴ実業／オダウエダ／9番街レトロ／金魚番長</p>
      <p>[コーナー出演者]MC：金魚番長／オダウエダ</p>
      <p>先着発売中 一般発売 受付期間：2026/07/05(日) 10:00〜2026/08/17(月) 15:00</p>
    </article>
  `;

  const events = parseFanyPage(html, venue, {
    today: "2026-08-17",
    endDate: "2026-10-16"
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-08-17");
  assert.equal(events[0].open, "16:45");
  assert.equal(events[0].start, "17:00");
  assert.equal(events[0].title, "神保町Kakeru翔SPプラス＋");
  assert.equal(events[0].genre, "neta-corner");
  assert.equal(events[0].status, "available");
  assert.deepEqual(events[0].performers, ["シカゴ実業", "オダウエダ", "9番街レトロ", "金魚番長"]);
});

test("範囲外の日付は除外する", () => {
  const html = `
    <h4>2026/08/16(日)開場 12:45 開演 13:00</h4>
    <h3>神保町マンゲキお笑いライブ</h3>
    <p>出演</p><p>滝音／金魚番長</p>
    <h4>2026/08/20(木)開場 17:15 開演 17:30</h4>
    <h3>神保町Kakeru翔LIVE</h3>
    <p>出演</p><p>イチゴ／大王</p>
  `;

  const events = parseFanyPage(html, venue, {
    today: "2026-08-17",
    endDate: "2026-08-31"
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-08-20");
});

test("FANY JSONの公演データをアプリ用イベントへ変換する", () => {
  const event = performanceToEvent({
    id: 47014,
    event_id: 17815,
    name: "漫才鬼",
    performance_date: "2026/08/21(<span class=\"g-dayofweek\">金</span>)",
    opening_time: "190000",
    start_time: "191500",
    is_ticketable: true,
    performer_detail: "[企画ライブ]金魚番長／ゼロカラン",
    performance_sales: [
      {
        display_sales_status: "先着発売中",
        destination_url: "https://ticket.fany.lol/reception/57403/47014"
      }
    ]
  }, venue);

  assert.equal(event.date, "2026-08-21");
  assert.equal(event.open, "19:00");
  assert.equal(event.start, "19:15");
  assert.equal(event.title, "漫才鬼");
  assert.equal(event.status, "available");
  assert.deepEqual(event.performers, ["金魚番長", "ゼロカラン"]);
  assert.equal(event.url, "https://ticket.fany.lol/reception/57403/47014");
});

test("取得件数が少なすぎる場合は更新を止める", async () => {
  const html = `
    <h4>2026/08/20(木)開場 17:15 開演 17:30</h4>
    <h3>神保町Kakeru翔LIVE</h3>
    <p>出演</p><p>イチゴ／大王</p>
  `;

  await assert.rejects(
    () => buildLiveData({
      today: "2026-08-17",
      endDate: "2026-10-16",
      sources: { jimbocho: html },
      minEvents: 2,
      now: new Date("2026-08-17T06:17:00+09:00")
    }),
    /少なすぎます/
  );
});

test("data.js形式へ安全にシリアライズする", async () => {
  const html = `
    <h4>2026/08/20(木)開場 17:15 開演 17:30</h4>
    <h3>神保町Kakeru翔LIVE</h3>
    <p>出演</p><p>イチゴ／大王</p>
  `;

  const data = await buildLiveData({
    today: "2026-08-17",
    endDate: "2026-10-16",
    sources: { jimbocho: html },
    minEvents: 1,
    now: new Date("2026-08-17T06:17:00+09:00")
  });
  const output = serializeDataJs(data);

  assert.match(output, /window\.YOSHIMOTO_LIVE_META/);
  assert.match(output, /coverageLabel/);
  assert.match(output, /2026-08-20\|17:15\|17:30\|神保町よしもと漫才劇場/);
});
