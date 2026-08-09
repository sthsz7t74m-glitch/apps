#!/usr/bin/env python3
"""Train and audit the NAR market-residual win model.

The input directory must contain the official NAR monthly CSV files extracted
from the race and odds ZIP downloads.  The model is a conditional logit:

    p(i wins race r) = softmax(log(q_i) + beta * x_i)

where q is the normalized final-win-odds probability and x contains only
race-card fields that are available before the result.  Final odds are useful
for probability calibration, but they are not treated as an executable
decision-time snapshot.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import numpy as np
from scipy.optimize import minimize


FEATURE_NAMES = [
    "career_log_starts",
    "career_win_rate",
    "career_place_rate",
    "direction_log_starts",
    "direction_win_rate",
    "direction_place_rate",
    "course_log_starts",
    "course_win_rate",
    "course_place_rate",
    "distance_log_starts",
    "distance_win_rate",
    "distance_place_rate",
    "jockey_log_starts",
    "jockey_win_rate",
    "jockey_place_rate",
    "draw_position",
    "carried_weight_relative",
    "body_weight_relative",
    "body_weight_change",
    "age_relative",
    "is_female",
    "is_gelding",
]

THOROUGHBRED_VENUES = {
    "門別", "盛岡", "水沢", "浦和", "船橋", "大井", "川崎", "金沢",
    "笠松", "名古屋", "園田", "姫路", "高知", "佐賀",
}


def numeric(value: object, default: float | None = None) -> float | None:
    if value is None:
        return default
    text = str(value).strip().replace(",", "")
    if not text:
        return default
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not match:
        return default
    try:
        return float(match.group())
    except ValueError:
        return default


def record(value: object) -> tuple[int, float, float]:
    numbers = [int(number) for number in re.findall(r"\d+", str(value or ""))]
    if len(numbers) < 4:
        return 0, 0.0, 0.0
    wins, seconds, thirds, others = numbers[:4]
    starts = wins + seconds + thirds + others
    if starts <= 0:
        return 0, 0.0, 0.0
    return starts, wins / starts, (wins + seconds + thirds) / starts


def key(row: dict[str, str]) -> tuple[str, str, int]:
    return row["競馬場"], row["競走年月日"], int(row["レース番号"])


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def load_win_odds(data_dir: Path) -> dict[tuple[str, str, int, int], float]:
    odds: dict[tuple[str, str, int, int], float] = {}
    for path in sorted(data_dir.glob("2026??_??_odds.csv")):
        for row in read_csv(path):
            if row.get("賭式") != "単勝":
                continue
            value = numeric(row.get("オッズ"))
            number = numeric(row.get("番号1"))
            if value is None or value <= 1 or number is None:
                continue
            odds[(*key(row), int(number))] = value
    return odds


def load_races(data_dir: Path) -> dict[tuple[str, str, int], dict[str, str]]:
    races: dict[tuple[str, str, int], dict[str, str]] = {}
    for path in sorted(data_dir.glob("2026??_racelist.csv")):
        for row in read_csv(path):
            races[key(row)] = row
    return races


def raw_feature(row: dict[str, str], race: dict[str, str], field_size: int) -> list[float]:
    career = record(row.get("全成績"))
    direction = record(row.get("ダート左成績") if race.get("回り") == "左" else row.get("ダート右成績"))
    course = record(row.get("当競馬場成績"))
    distance = record(row.get("うち当距離成績"))
    jockey = record(row.get("騎手成績"))
    number = numeric(row.get("馬番"), 0.0) or 0.0
    carried = numeric(row.get("負担重量"), math.nan)
    body = numeric(row.get("馬体重"), math.nan)
    change = numeric(row.get("馬体重増減"), 0.0) or 0.0
    age = numeric(row.get("齢"), math.nan)
    sex = str(row.get("性") or "")
    return [
        math.log1p(career[0]), career[1], career[2],
        math.log1p(direction[0]), direction[1], direction[2],
        math.log1p(course[0]), course[1], course[2],
        math.log1p(distance[0]), distance[1], distance[2],
        math.log1p(jockey[0]), jockey[1], jockey[2],
        (number - (field_size + 1) / 2) / max(field_size, 1),
        carried, body, max(-50.0, min(50.0, change)), age,
        1.0 if sex == "牝" else 0.0,
        1.0 if sex == "セン" else 0.0,
    ]


@dataclass
class RaceSample:
    race_key: tuple[str, str, int]
    race_date: date
    numbers: list[int]
    odds: np.ndarray
    log_market: np.ndarray
    features: np.ndarray
    finishes: np.ndarray
    winner_index: int


def load_samples(data_dir: Path) -> list[RaceSample]:
    races = load_races(data_dir)
    win_odds = load_win_odds(data_dir)
    grouped: dict[tuple[str, str, int], list[dict[str, str]]] = defaultdict(list)
    for path in sorted(data_dir.glob("2026??_horselist.csv")):
        for row in read_csv(path):
            grouped[key(row)].append(row)

    samples: list[RaceSample] = []
    for race_key, rows in grouped.items():
        venue, raw_date, _ = race_key
        race = races.get(race_key)
        if not race or venue not in THOROUGHBRED_VENUES:
            continue
        active = []
        for row in rows:
            number = int(numeric(row.get("馬番"), 0) or 0)
            finish = int(numeric(row.get("着順"), 0) or 0)
            odd = win_odds.get((*race_key, number))
            if number > 0 and finish > 0 and odd is not None:
                active.append((row, number, finish, odd))
        if len(active) < 5 or sum(finish == 1 for _, _, finish, _ in active) != 1:
            continue
        field_size = len(active)
        raw = np.asarray([raw_feature(row, race, field_size) for row, _, _, _ in active], dtype=float)
        for column in (16, 17, 19):
            values = raw[:, column]
            finite = values[np.isfinite(values)]
            fill = float(np.median(finite)) if finite.size else 0.0
            values[~np.isfinite(values)] = fill
            raw[:, column] = values - float(np.mean(values))
        numbers = [number for _, number, _, _ in active]
        finishes = np.asarray([finish for _, _, finish, _ in active], dtype=int)
        odds = np.asarray([odd for _, _, _, odd in active], dtype=float)
        market = (1 / odds) / np.sum(1 / odds)
        samples.append(RaceSample(
            race_key=race_key,
            race_date=datetime.strptime(raw_date, "%Y%m%d").date(),
            numbers=numbers,
            odds=odds,
            log_market=np.log(market),
            features=raw,
            finishes=finishes,
            winner_index=int(np.flatnonzero(finishes == 1)[0]),
        ))
    return sorted(samples, key=lambda sample: (sample.race_date, sample.race_key))


def fit_scaler(samples: list[RaceSample]) -> tuple[np.ndarray, np.ndarray]:
    matrix = np.vstack([sample.features for sample in samples])
    mean = np.mean(matrix, axis=0)
    scale = np.std(matrix, axis=0)
    scale[scale < 1e-8] = 1.0
    return mean, scale


def standardized(sample: RaceSample, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    matrix = (sample.features - mean) / scale
    return matrix - np.mean(matrix, axis=0, keepdims=True)


def softmax(scores: np.ndarray) -> np.ndarray:
    shifted = scores - np.max(scores)
    values = np.exp(shifted)
    return values / np.sum(values)


def fit_model(
    samples: list[RaceSample],
    l2: float,
    *,
    residual: bool = True,
) -> tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    mean, scale = fit_scaler(samples)
    matrices = [standardized(sample, mean, scale) for sample in samples]
    dimensions = 1 + (len(FEATURE_NAMES) if residual else 0)

    def objective(theta: np.ndarray) -> tuple[float, np.ndarray]:
        alpha = float(theta[0])
        beta = theta[1:] if residual else np.zeros(len(FEATURE_NAMES), dtype=float)
        loss = 10.0 * (alpha - 1.0) ** 2 + 0.5 * l2 * float(beta @ beta)
        gradient = np.zeros(dimensions, dtype=float)
        gradient[0] = 20.0 * (alpha - 1.0)
        if residual:
            gradient[1:] = l2 * beta
        for sample, matrix in zip(samples, matrices):
            scores = alpha * sample.log_market + matrix @ beta
            probabilities = softmax(scores)
            loss -= math.log(max(probabilities[sample.winner_index], 1e-15))
            delta = probabilities.copy()
            delta[sample.winner_index] -= 1
            gradient[0] += float(sample.log_market @ delta)
            if residual:
                gradient[1:] += matrix.T @ delta
        return loss, gradient

    result = minimize(
        fun=lambda theta: objective(theta),
        x0=np.r_[1.0, np.zeros(dimensions - 1, dtype=float)],
        jac=True,
        method="L-BFGS-B",
        bounds=[(0.5, 1.5), *([(None, None)] * (dimensions - 1))],
        options={"maxiter": 400, "ftol": 1e-11, "gtol": 1e-7},
    )
    if not result.success:
        raise RuntimeError(f"model fit failed: {result.message}")
    beta = result.x[1:] if residual else np.zeros(len(FEATURE_NAMES), dtype=float)
    return float(result.x[0]), beta, mean, scale


def probabilities(sample: RaceSample, alpha: float, beta: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    return softmax(alpha * sample.log_market + standardized(sample, mean, scale) @ beta)


def evaluate(samples: list[RaceSample], alpha: float, beta: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> dict[str, float | int]:
    market_loss = model_loss = market_brier = model_brier = 0.0
    market_hits = model_hits = 0
    for sample in samples:
        market = softmax(sample.log_market)
        model = probabilities(sample, alpha, beta, mean, scale)
        winner = sample.winner_index
        market_loss -= math.log(max(market[winner], 1e-15))
        model_loss -= math.log(max(model[winner], 1e-15))
        target = np.zeros(len(model))
        target[winner] = 1
        market_brier += float(np.sum((market - target) ** 2))
        model_brier += float(np.sum((model - target) ** 2))
        market_hits += int(np.argmax(market) == winner)
        model_hits += int(np.argmax(model) == winner)
    count = max(1, len(samples))
    return {
        "races": len(samples),
        "marketLogLoss": market_loss / count,
        "modelLogLoss": model_loss / count,
        "marketBrier": market_brier / count,
        "modelBrier": model_brier / count,
        "marketTop1": market_hits / count,
        "modelTop1": model_hits / count,
    }


def ranking_marginals(probability: np.ndarray, places: int, gamma: float) -> np.ndarray:
    strength = probability ** gamma
    strength /= np.sum(strength)
    count = len(strength)
    output = np.zeros(count)
    if places == 2:
        for first in range(count):
            for second in range(count):
                if first == second:
                    continue
                value = strength[first] * strength[second] / (1 - strength[first])
                output[first] += value
                output[second] += value
        return output
    for first in range(count):
        after_first = 1 - strength[first]
        for second in range(count):
            if first == second:
                continue
            first_two = strength[first] * strength[second] / after_first
            after_second = after_first - strength[second]
            for third in range(count):
                if third in (first, second):
                    continue
                value = first_two * strength[third] / after_second
                output[first] += value
                output[second] += value
                output[third] += value
    return output


def placement_log_loss(samples: list[RaceSample], alpha: float, beta: np.ndarray, mean: np.ndarray, scale: np.ndarray, gamma: float) -> float:
    total = 0.0
    observations = 0
    for sample in samples:
        places = 3 if len(sample.numbers) >= 8 else 2
        marginal = ranking_marginals(probabilities(sample, alpha, beta, mean, scale), places, gamma)
        target = (sample.finishes <= places).astype(float)
        clipped = np.clip(marginal, 1e-9, 1 - 1e-9)
        total -= float(np.sum(target * np.log(clipped) + (1 - target) * np.log(1 - clipped)))
        observations += len(target)
    return total / max(1, observations)


def month_range(samples: list[RaceSample], year: int, month: int) -> list[RaceSample]:
    return [sample for sample in samples if sample.race_date.year == year and sample.race_date.month == month]


def rounded_metrics(metrics: dict[str, float | int]) -> dict[str, float | int]:
    return {key: round(value, 8) if isinstance(value, float) else value for key, value in metrics.items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--training-cutoff", default="2026-08-08")
    args = parser.parse_args()

    cutoff = datetime.strptime(args.training_cutoff, "%Y-%m-%d").date()
    all_samples = [sample for sample in load_samples(args.data_dir) if sample.race_date <= cutoff]
    march = month_range(all_samples, 2026, 3)
    april = month_range(all_samples, 2026, 4)
    if not march or not april:
        raise RuntimeError("March and April tuning data are required")

    l2_candidates = [20.0, 40.0, 80.0, 160.0, 320.0, 640.0]
    tuning: list[tuple[float, str, float, float, np.ndarray, np.ndarray, np.ndarray, dict[str, float | int]]] = []
    baseline_mean, baseline_scale = fit_scaler(march)
    baseline_beta = np.zeros(len(FEATURE_NAMES), dtype=float)
    baseline_metrics = evaluate(april, 1.0, baseline_beta, baseline_mean, baseline_scale)
    tuning.append((baseline_metrics["modelLogLoss"], "market", 0.0, 1.0, baseline_beta, baseline_mean, baseline_scale, baseline_metrics))
    alpha, beta, mean, scale = fit_model(march, 0.0, residual=False)
    metrics = evaluate(april, alpha, beta, mean, scale)
    tuning.append((metrics["modelLogLoss"], "market-exponent", 0.0, alpha, beta, mean, scale, metrics))
    for l2 in l2_candidates:
        alpha, beta, mean, scale = fit_model(march, l2)
        metrics = evaluate(april, alpha, beta, mean, scale)
        tuning.append((metrics["modelLogLoss"], "market-residual", l2, alpha, beta, mean, scale, metrics))
    _, selected_mode, selected_l2, tuning_alpha, tuning_beta, tuning_mean, tuning_scale, tuning_metrics = min(tuning, key=lambda item: item[0])

    gamma_candidates = [round(value, 2) for value in np.arange(0.55, 1.31, 0.05)]
    gamma_scores = [
        (placement_log_loss(april, tuning_alpha, tuning_beta, tuning_mean, tuning_scale, gamma), gamma)
        for gamma in gamma_candidates
    ]
    selected_gamma = min(gamma_scores)[1]

    folds = []
    for evaluation_month in (5, 6, 7, 8):
        train = [sample for sample in all_samples if sample.race_date < date(2026, evaluation_month, 1)]
        if evaluation_month == 8:
            test = [sample for sample in all_samples if date(2026, 8, 1) <= sample.race_date <= cutoff]
        else:
            test = month_range(all_samples, 2026, evaluation_month)
        if selected_mode == "market":
            mean, scale = fit_scaler(train)
            alpha, beta = 1.0, np.zeros(len(FEATURE_NAMES), dtype=float)
        else:
            alpha, beta, mean, scale = fit_model(train, selected_l2, residual=selected_mode == "market-residual")
        metrics = evaluate(test, alpha, beta, mean, scale)
        metrics["placementLogLoss"] = placement_log_loss(test, alpha, beta, mean, scale, selected_gamma)
        folds.append({
            "trainThrough": max(sample.race_date for sample in train).isoformat(),
            "evaluate": f"2026-{evaluation_month:02d}" if evaluation_month < 8 else "2026-08-01..2026-08-08",
            **rounded_metrics(metrics),
        })

    if selected_mode == "market":
        final_mean, final_scale = fit_scaler(all_samples)
        final_alpha, final_beta = 1.0, np.zeros(len(FEATURE_NAMES), dtype=float)
    else:
        final_alpha, final_beta, final_mean, final_scale = fit_model(
            all_samples, selected_l2, residual=selected_mode == "market-residual"
        )
    payload = {
        "modelVersion": "NAR-1.0.0-market-reference",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "trainingRange": {
            "start": min(sample.race_date for sample in all_samples).isoformat(),
            "end": max(sample.race_date for sample in all_samples).isoformat(),
            "races": len(all_samples),
            "excludesBanei": True,
        },
        "formula": "softmax(marketExponent * log(normalized inverse final odds) + standardized race-card features @ coefficients)",
        "decisionTimeCaveat": "Final odds calibrate probabilities but are not a timestamped executable betting snapshot.",
        "featureNames": FEATURE_NAMES,
        "featureMean": [round(float(value), 12) for value in final_mean],
        "featureScale": [round(float(value), 12) for value in final_scale],
        "marketExponent": round(float(final_alpha), 12),
        "coefficients": [round(float(value), 12) for value in final_beta],
        "selectedMode": selected_mode,
        "regularizationL2": selected_l2,
        "placementStrengthGamma": selected_gamma,
        "tuning": {
            "train": "2026-03",
            "validation": "2026-04",
            "selectedMode": selected_mode,
            "selectedL2": selected_l2,
            "marketLogLoss": round(float(tuning_metrics["marketLogLoss"]), 8),
            "modelLogLoss": round(float(tuning_metrics["modelLogLoss"]), 8),
            "placementGammaCandidates": gamma_candidates,
            "selectedPlacementGamma": selected_gamma,
        },
        "forwardAudit": folds,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "races": len(all_samples),
        "selectedMode": selected_mode,
        "selectedL2": selected_l2,
        "selectedGamma": selected_gamma,
        "folds": folds,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
