#!/usr/bin/env python3
"""Build a normalized Uma Log AI archive from locally captured race data.

The script deliberately accepts files that were already captured by a human or
an approved upstream process.  It does not crawl a third-party website.  Raw
HTML/text is not copied to the public dataset; only normalized race facts and
the app's own prediction output are written.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


JST = timezone(timedelta(hours=9))
VENUE_BY_CODE = {"01": "札幌", "04": "新潟", "07": "中京"}
WEATHER = {"晴": "sunny", "曇": "cloudy", "雨": "rain", "雪": "snow"}
GOING = {"良": "firm", "稍重": "yielding", "稍": "yielding", "重": "soft", "不良": "heavy", "不": "heavy"}


def strip_citations(value: str) -> str:
    value = re.sub(r"cite\d+†([^]+)", r"\1", value)
    value = re.sub(r"cite[^]+", "", value)
    return value.replace("†", "").strip()


def content_lines(path: Path) -> list[str]:
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        matches = list(re.finditer(r"(?:^|\s)L\d+:\s?(.*?)(?=(?:\s+L\d+:)|$)", raw))
        if matches:
            lines.extend(strip_citations(match.group(1)) for match in matches)
        else:
            lines.append(strip_citations(raw))
    return lines


def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def as_number(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def snapshot_iso(value: str | None) -> str | None:
    if not value:
        return None
    parsed = datetime.strptime(value, "%Y/%m/%d %H:%M").replace(tzinfo=JST)
    return parsed.isoformat(timespec="seconds")


def parse_odds(path: Path) -> dict[str, Any]:
    """Parse a locally captured win/place odds table into normalized facts."""
    lines = content_lines(path)
    updated = next(
        (match.group(1) for line in lines if (match := re.fullmatch(r"(\d{4}/\d{1,2}/\d{1,2} \d{1,2}:\d{2}) 更新", line))),
        None,
    )
    runners: dict[int, dict[str, Any]] = {}
    for line in lines:
        parts = [part.strip() for part in line.split(" | ")]
        if len(parts) != 5 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        win = as_number(parts[3])
        place = re.fullmatch(r"([\d.]+)\s*-\s*([\d.]+)", parts[4])
        if win is None or not place:
            continue
        lower = float(place.group(1))
        upper = float(place.group(2))
        if win <= 1 or lower <= 1 or upper < lower:
            continue
        runners[int(parts[1])] = {
            "win": win,
            "place": {"lower": lower, "upper": upper},
        }
    if not runners:
        raise ValueError(f"No win/place odds parsed from {path}")
    return {"capturedAt": snapshot_iso(updated), "runners": runners}


def class_level(name: str, conditions: str) -> int:
    text = f"{name} {conditions}"
    if re.search(r"G.?1", text, re.I):
        return 8
    if re.search(r"G.?2", text, re.I):
        return 7
    if re.search(r"G.?3", text, re.I):
        return 6
    if "リステッド" in text or re.search(r"\bL\b", text):
        return 5
    if "オープン" in text or "OP" in text:
        return 5
    if "3勝" in text or "1600万" in text:
        return 4
    if "2勝" in text or "1000万" in text:
        return 3
    if "1勝" in text or "500万" in text:
        return 2
    return 1


def parse_card(path: Path) -> dict[str, Any]:
    race_id = path.stem
    venue = VENUE_BY_CODE.get(race_id[2:4])
    if not venue:
        raise ValueError(f"Unsupported venue code in {race_id}")
    lines = content_lines(path)
    start_index = next((index for index, line in enumerate(lines) if re.fullmatch(r"\d{1,2}:\d{2}発走", line)), None)
    if start_index is None:
        raise ValueError(f"Start time not found in {path}")
    raw_start_time = lines[start_index].removesuffix("発走")
    start_time = datetime.strptime(raw_start_time, "%H:%M").strftime("%H:%M")
    name_index = next((index for index in range(start_index + 1, len(lines)) if lines[index].startswith("## ")), None)
    if name_index is None:
        raise ValueError(f"Race name not found in {path}")
    race_name = lines[name_index][3:].strip()
    course_index = next((index for index in range(name_index + 1, min(len(lines), name_index + 12)) if re.search(r"(?:芝|ダート|障害).*\d+m", lines[index])), None)
    if course_index is None:
        raise ValueError(f"Course not found in {path}")
    course = lines[course_index]
    distance_match = re.search(r"(\d+)m", course)
    if not distance_match:
        raise ValueError(f"Distance not found in {path}")
    race_type = "jump" if "障害" in course or "障害" in race_name else "flat"
    surface = "dirt" if "ダート" in course else "turf"
    direction = "left" if "左" in course else "right" if "右" in course else "straight"
    weather = next((WEATHER[line] for line in lines[course_index + 1:course_index + 8] if line in WEATHER), None)
    going = next((GOING[line] for line in lines[course_index + 1:course_index + 12] if line in GOING), None)
    conditions = next((line for line in lines[course_index + 1:course_index + 16] if "本賞金" in line), "")
    meeting_label = next((line for line in reversed(lines[max(0, start_index - 8):start_index]) if re.search(r"\d+回.+\d+日", line)), "")
    captured = next((line for line in lines if re.fullmatch(r"2026/8/9 \d{1,2}:\d{2}", line)), None)

    horses: list[dict[str, Any]] = []
    for line in lines:
        if " | " not in line:
            continue
        parts = [part.strip() for part in line.split(" | ")]
        if len(parts) < 8 or not parts[0].isdigit() or not parts[1].isdigit():
            continue
        identity = re.match(r"(.+?)\s+((?:牡|牝|せん|セン)\d+)(?:/[^ ]+)?", parts[2])
        if not identity:
            continue
        number = int(parts[1])
        jockey = re.match(r"(.+?)\s+[▲△☆★◇]?(\d+(?:\.\d+)?)$", parts[3])
        trainer = re.match(r"(.+?)\s*\((?:美浦|栗東|地方|海外)\)", parts[4])
        body = re.search(r"(\d+)\(([+-]?\d+)\)", parts[6])
        market = re.search(r"(\d+)\(([\d.]+)\)", parts[7])
        pedigree = re.sub(r"\s+", " ", parts[5]).strip()
        scratched = "取消" in line or "除外" in line
        horse: dict[str, Any] = {
            "id": f"{race_id}-{number}",
            "number": number,
            "gate": int(parts[0]),
            "name": identity.group(1).strip(),
            "sexAge": identity.group(2).replace("セン", "せん"),
            "jockey": jockey.group(1).strip() if jockey else "",
            "trainer": trainer.group(1).strip() if trainer else "",
            "carriedWeight": float(jockey.group(2)) if jockey else None,
            "bodyWeight": float(body.group(1)) if body else None,
            "bodyWeightChange": float(body.group(2)) if body else None,
            "odds": float(market.group(2)) if market else None,
            "popularity": int(market.group(1)) if market else None,
            "runningStyle": "unknown",
            "recentRuns": [],
            "pedigreeDescription": pedigree,
        }
        if scratched:
            horse["scratched"] = True
        horses.append({key: value for key, value in horse.items() if value is not None})
    if len(horses) < 3:
        raise ValueError(f"Only {len(horses)} horses parsed from {path}")

    return {
        "id": race_id,
        "date": "2026-08-09",
        "venue": venue,
        "meetingLabel": meeting_label,
        "raceNumber": int(race_id[-2:]),
        "startTime": start_time,
        "name": race_name,
        "classLevel": class_level(race_name, conditions),
        "surface": surface,
        "raceType": race_type,
        "distance": int(distance_match.group(1)),
        "direction": direction,
        "weather": weather or "cloudy",
        "going": going or "firm",
        "pace": "middle",
        "drawBias": 0,
        "status": "final",
        "isDebut": "新馬" in race_name or "メイクデビュー" in race_name,
        "cardCapturedAt": snapshot_iso(captured),
        "horses": horses,
    }


def load_predictions(csv_path: Path) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            race_id = row.get("race_id") or ""
            if not race_id:
                continue
            grouped[race_id].append(row)
    return grouped


def prediction_payload(rows: list[dict[str, Any]], race: dict[str, Any], summary: dict[str, Any] | None) -> dict[str, Any]:
    ordered = sorted(rows, key=lambda row: int(row["model_rank"]))
    probability_total = sum(float(row["probability"]) for row in ordered)
    if not ordered or probability_total <= 0:
        raise ValueError(f"No usable probabilities for {race['id']}")
    captured_at = snapshot_iso(ordered[0].get("snapshot")) or race.get("cardCapturedAt")
    post_at = datetime.fromisoformat(f"{race['date']}T{race['startTime']}:00+09:00")
    captured_time = datetime.fromisoformat(captured_at) if captured_at else post_at
    minutes_before_post = round((post_at - captured_time).total_seconds() / 60, 1)
    capture_timing = "pre-race" if minutes_before_post > 0 else "post-race"

    by_number = {int(row["number"]): row for row in ordered}
    for horse in race["horses"]:
        row = by_number.get(int(horse["number"]))
        if not row:
            horse["scratched"] = True
            continue
        ability = as_number(row.get("ability_raw"))
        pace = as_number(row.get("pace_raw"))
        trend = as_number(row.get("trend_raw"))
        draw = as_number(row.get("draw_raw"))
        jockey = as_number(row.get("jockey_raw"))
        trainer = as_number(row.get("trainer_raw"))
        if ability is not None:
            horse["distanceFit"] = round(clamp(ability * 100), 1)
            horse["courseFit"] = round(clamp(ability * 100), 1)
        if pace is not None:
            horse["paceFit"] = round(clamp(pace * 100), 1)
        if trend is not None:
            horse["conditionScore"] = round(clamp(trend * 100), 1)
        if draw is not None:
            horse["drawFit"] = round(clamp(50 + (draw - 0.24) * 500), 1)
        if jockey is not None:
            horse["jockeyStats"] = {"placeRate": round(clamp(jockey, 0, 1), 4)}
        if trainer is not None:
            horse["trainerStats"] = {"placeRate": round(clamp(trainer, 0, 1), 4)}

    output = {
        "modelVersion": "2.0.0-stable",
        "generatedAt": captured_at,
        "capturedAt": captured_at,
        "captureTiming": capture_timing,
        "minutesBeforePost": minutes_before_post,
        "output": "final-win-probability",
        "runners": [
            {
                "number": int(row["number"]),
                "rank": int(row["model_rank"]),
                "probability": float(row["probability"]) / probability_total,
                "odds": float(row["odds"]),
                "fairOdds": float(row["fair_odds"]),
            }
            for row in ordered
        ],
    }
    if summary:
        output["grade"] = summary.get("grade")
        output["decision"] = summary.get("bet")
    return output


def build(args: argparse.Namespace) -> dict[str, Any]:
    cards = {path.stem: parse_card(path) for path in sorted(args.cards.glob("*.txt"))}
    odds = {path.stem: parse_odds(path) for path in sorted(args.odds.glob("*.txt"))} if args.odds else {}
    predictions = load_predictions(args.predictions_csv)
    summary_document = json.loads(args.predictions_json.read_text(encoding="utf-8"))
    summaries = {row["race_id"]: row for row in summary_document.get("races", [])}
    result_document = json.loads(args.results_json.read_text(encoding="utf-8"))
    results = {
        (venue, int(row["race_number"])): row
        for venue, rows in result_document.get("venues", {}).items()
        for row in rows
    }
    confirmed_at = datetime.strptime(result_document["confirmed_at"], "%Y-%m-%d %H:%M JST").replace(tzinfo=JST).isoformat(timespec="seconds")

    races: list[dict[str, Any]] = []
    for race_id, race in cards.items():
        rows = predictions.get(race_id)
        if rows:
            published = prediction_payload(rows, race, summaries.get(race_id))
            race["publishedPrediction"] = published
            race["probabilityModel"] = {
                "version": published["modelVersion"],
                "frozenBeforePost": published["captureTiming"] == "pre-race",
                "output": published["output"],
            }
            race["oddsSnapshotAt"] = published["capturedAt"]
        else:
            race["modelStatus"] = "out-of-scope"

        captured_odds = odds.get(race_id)
        if captured_odds:
            if captured_odds.get("capturedAt"):
                race["oddsSnapshotAt"] = captured_odds["capturedAt"]
            for horse in race["horses"]:
                quote = captured_odds["runners"].get(int(horse["number"]))
                if quote:
                    horse["winOddsSnapshot"] = quote["win"]
                    horse["placeOdds"] = quote["place"]

        official = results.get((race["venue"], race["raceNumber"]))
        if not official:
            raise ValueError(f"Official result missing for {race['venue']} {race['raceNumber']}R")
        order = [int(item["number"]) for item in official.get("top3", [])]
        horse_numbers = {int(horse["number"]) for horse in race["horses"]}
        if len(order) != 3 or any(number not in horse_numbers for number in order):
            raise ValueError(f"Result does not match runners for {race_id}: {order}")
        race["result"] = {
            "status": "final",
            "confirmedAt": confirmed_at,
            "capturedAt": confirmed_at,
            "order": order,
            "refundsUnknown": True,
        }
        if official.get("excluded_numbers"):
            race["result"]["refundHorseNumbers"] = [int(number) for number in official["excluded_numbers"] if int(number) in horse_numbers]
        if official.get("note"):
            race["result"]["note"] = official["note"]
        race["bettingFieldSize"] = len([horse for horse in race["horses"] if not horse.get("scratched")])
        races.append(race)

    races.sort(key=lambda race: (race["date"], ["札幌", "新潟", "中京"].index(race["venue"]), race["raceNumber"]))
    if len(races) != 36:
        raise ValueError(f"Expected 36 races, parsed {len(races)}")
    pre_race = sum(race.get("publishedPrediction", {}).get("captureTiming") == "pre-race" for race in races)
    post_race = sum(race.get("publishedPrediction", {}).get("captureTiming") == "post-race" for race in races)
    place_odds_races = sum(any(horse.get("placeOdds") for horse in race["horses"]) for race in races)
    return {
        "schemaVersion": 1,
        "generatedAt": confirmed_at,
        "source": {
            "mode": "reference-archive",
            "datasetId": "uma-log-ai-reference-archive-v1",
            "name": "2026年8月9日 JRA実データ",
            "detail": f"札幌・新潟・中京36R（発走前参考{pre_race}R／複勝オッズ{place_odds_races}R／結果後参考{post_race}R／モデル対象外1R）",
            "redistributable": True,
            "automated": False,
            "asOfFieldsGuaranteed": False,
            "normalizedFactsOnly": True,
            "officialResultsVerified": True,
            "verificationSource": "JRA公式レース結果",
        },
        "venues": ["札幌", "新潟", "中京"],
        "archive": {
            "date": "2026-08-09",
            "preRaceReferenceCount": pre_race,
            "postRaceReferenceCount": post_race,
            "outOfScopeCount": 1,
            "placeOddsRaceCount": place_odds_races,
            "note": "結果後に取得した予想は前向き成績・利益検証へ含めません",
        },
        "races": races,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cards", required=True, type=Path)
    parser.add_argument("--odds", type=Path)
    parser.add_argument("--predictions-csv", required=True, type=Path)
    parser.add_argument("--predictions-json", required=True, type=Path)
    parser.add_argument("--results-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    payload = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['races'])} real races to {args.output}")
    print(payload["source"]["detail"])


if __name__ == "__main__":
    main()
