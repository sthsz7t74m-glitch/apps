(() => {
  "use strict";

  const septemberRows = String.raw`
2026-09-07|13:30|14:00|ルミネtheよしもと|新宿|ルミネtheよしもと 平日14時の部 プラス|yose|available||価格は公式で確認|村上ショージ／麒麟／ギャロップ／フルーツポンチ／ニッポンの社長／コロコロチキチキペッパーズ／ビスケットブラザーズ／他|https://ticket.fany.lol/event/detail/17690/46868
2026-09-23|10:30|11:00|ルミネtheよしもと|新宿|ルミネtheよしもと シルバーウィーク特別公演＜1回目＞|yose|available||価格は公式で確認|５ＧＡＰ／ジョイマン／ガクテンソク／チョコレートプラネット／蓮華／ジェラードン／ミキ／ヨネダ2000|https://ticket.fany.lol/lumine?from=2026%2F09%2F23%28%E6%B0%B4%29&genre=0&search_type=form&to=2026%2F09%2F23%28%E6%B0%B4%29
2026-09-23|12:30|13:00|ルミネtheよしもと|新宿|ルミネtheよしもと シルバーウィーク特別公演＜2回目＞|yose|available||価格は公式で確認|５ＧＡＰ／ジョイマン／ガクテンソク／チョコレートプラネット／蓮華／ジェラードン／ミキ／ヨネダ2000|https://ticket.fany.lol/lumine?from=2026%2F09%2F23%28%E6%B0%B4%29&genre=0&search_type=form&to=2026%2F09%2F23%28%E6%B0%B4%29
2026-09-23|14:30|15:00|ルミネtheよしもと|新宿|ルミネtheよしもと シルバーウィーク特別公演＜3回目＞|yose|available||価格は公式で確認|ジョイマン／ガクテンソク／チョコレートプラネット／蓮華／ジェラードン／スクールゾーン／ミキ／ヨネダ2000|https://ticket.fany.lol/lumine?from=2026%2F09%2F23%28%E6%B0%B4%29&genre=0&search_type=form&to=2026%2F09%2F23%28%E6%B0%B4%29
2026-09-23|16:30|17:00|ルミネtheよしもと|新宿|ルミネtheよしもと シルバーウィーク特別公演＜4回目＞|yose|available||価格は公式で確認|ジョイマン／ガクテンソク／ジェラードン／蓮華／スクールゾーン／ミキ／ヨネダ2000／他|https://ticket.fany.lol/lumine?from=2026%2F09%2F23%28%E6%B0%B4%29&genre=0&search_type=form&to=2026%2F09%2F23%28%E6%B0%B4%29`;

  const current = String(window.YOSHIMOTO_LIVE_ROWS || "").trim();
  window.YOSHIMOTO_LIVE_ROWS = `${current}\n${septemberRows.trim()}`.trim();
})();