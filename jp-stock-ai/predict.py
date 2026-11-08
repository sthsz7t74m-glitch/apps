#!/usr/bin/env python3
"""5-session Japanese equity forecast. Educational estimates, not advice."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parent
TICKERS = {
    "7203": "トヨタ自動車",
    "6758": "ソニーグループ",
    "7974": "任天堂",
    "8306": "三菱UFJフィナンシャル・グループ",
    "9432": "NTT",
    "9984": "ソフトバンクグループ",
    "6861": "キーエンス",
    "8035": "東京エレクトロン",
    "6098": "リクルートホールディングス",
    "4063": "信越化学工業",
}
HORIZON = 5
FEATURES = ["ret1", "ret5", "ret10", "ret20", "ma5", "ma20", "ma60", "vol5", "vol20", "volume_ratio", "range1", "rsi14"]

def prepare(raw):
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    raw = raw.sort_index().copy()
    close = raw["Close"].astype(float)
    volume = raw["Volume"].astype(float)
    high = raw["High"].astype(float)
    low = raw["Low"].astype(float)
    returns = close.pct_change(fill_method=None)
    x = pd.DataFrame(index=raw.index)
    for n in (1, 5, 10, 20):
        x[f"ret{n}"] = close.pct_change(n, fill_method=None)
    for n in (5, 20, 60):
        x[f"ma{n}"] = close / close.rolling(n).mean() - 1
    for n in (5, 20):
        x[f"vol{n}"] = returns.rolling(n).std()
    x["volume_ratio"] = volume / volume.rolling(20).mean() - 1
    x["range1"] = (high - low) / close
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
    x["rsi14"] = (100 - 100 / (1 + gain / loss.replace(0, np.nan))) / 100
    x = x.replace([np.inf, -np.inf], np.nan)
    y = close.shift(-HORIZON) / close - 1
    return close, x, y

def one_week_ago_check(close, features, target, common):
    """Simulate a decision made five sessions ago, without future labels."""
    cutoff_pos = len(close) - 1 - HORIZON
    cutoff_date = close.index[cutoff_pos]
    input_row = features.iloc[[cutoff_pos]]
    if not input_row.notna().all(axis=None):
        raise ValueError("過去時点の特徴量が不正です")
    # Labels at cutoff were observable only for rows <= cutoff - 5 sessions.
    limit = cutoff_pos - HORIZON + 1
    past_x, past_y = features.iloc[:limit], target.iloc[:limit]
    eligible = past_x.notna().all(axis=1) & past_y.notna() & np.isfinite(past_y)
    train_x = past_x.loc[eligible]
    train_y = past_y.loc[eligible].clip(-0.5, 0.5)
    if len(train_x) < 350:
        raise ValueError("過去時点の学習データ不足")
    model = HistGradientBoostingRegressor(**common)
    model.fit(train_x, train_y)
    predicted_return = float(np.clip(model.predict(input_row)[0], -0.3, 0.3))
    start_price = float(close.iloc[cutoff_pos])
    actual_price = float(close.iloc[-1])
    predicted_price = start_price * (1 + predicted_return)
    actual_return = actual_price / start_price - 1
    return {
        "asof": cutoff_date.strftime("%Y-%m-%d"),
        "target_date": close.index[-1].strftime("%Y-%m-%d"),
        "asof_price": round(start_price, 2),
        "predicted_price": round(predicted_price, 2),
        "actual_price": round(actual_price, 2),
        "predicted_return_pct": round(predicted_return * 100, 2),
        "actual_return_pct": round(actual_return * 100, 2),
        "price_error_yen": round(predicted_price - actual_price, 2),
        "absolute_error_pct": round(abs(predicted_price / actual_price - 1) * 100, 2),
        "direction_correct": bool((predicted_return > 0) == (actual_return > 0)),
        "train_samples": len(train_x),
        "method": "5取引日前に判明していた価格・特徴量・確定ラベルだけを使用"
    }


def forecast(code, name):
    raw = yf.download(code + ".T", period="7y", auto_adjust=True, progress=False, threads=False)
    if raw.empty or len(raw) < 480:
        raise ValueError("学習に必要な株価履歴がありません")
    close, features, target = prepare(raw)
    valid = features.notna().all(axis=1) & target.notna() & np.isfinite(target)
    dataset = features.loc[valid]
    y = target.loc[valid].clip(-0.5, 0.5)
    if len(dataset) < 350:
        raise ValueError("有効な学習データが不足しています")
    # Chronological evaluation, with 5-session embargo before validation.
    split = int(len(dataset) * .8)
    first_test = split + HORIZON
    if first_test >= len(dataset) - 30:
        raise ValueError("検証区間が短すぎます")
    xtr, ytr = dataset.iloc[:split], y.iloc[:split]
    xte, yte = dataset.iloc[first_test:], y.iloc[first_test:]
    common = dict(max_iter=120, max_leaf_nodes=12, min_samples_leaf=30, learning_rate=.04, random_state=42, l2_regularization=1.0)
    reg = HistGradientBoostingRegressor(**common)
    reg.fit(xtr, ytr)
    pred = reg.predict(xte)
    baseline = np.zeros(len(yte))
    mae = float(mean_absolute_error(yte, pred))
    baseline_mae = float(mean_absolute_error(yte, baseline))
    accuracy = float(np.mean((pred > 0) == (yte.to_numpy() > 0)))
    baseline_acc = float(max(np.mean(yte.to_numpy() > 0), np.mean(yte.to_numpy() <= 0)))
    # Classification probability is uncalibrated; label it accordingly.
    clf = HistGradientBoostingClassifier(**common)
    clf.fit(xtr, (ytr > 0).astype(int))
    last = features.dropna().iloc[[-1]]
    if last.index[-1] != close.index[-1]:
        raise ValueError("最新日の特徴量を計算できません")
    # Retrain on all labeled observations; the future observation is never included.
    reg.fit(dataset, y)
    clf.fit(dataset, (y > 0).astype(int))
    change = float(np.clip(reg.predict(last)[0], -0.3, 0.3))
    probability = float(clf.predict_proba(last)[0, 1])
    current = float(close.iloc[-1])
    dates = dataset.index[first_test:]
    historical_check = one_week_ago_check(close, features, target, common)
    return {
        "one_week_ago_check": historical_check,
        "code": code, "name": name, "asof": close.index[-1].strftime("%Y-%m-%d"),
        "price": round(current, 2), "forecast": round(current * (1 + change), 2),
        "return_pct": round(change * 100, 2), "up_probability_pct": round(probability * 100, 1),
        "metrics": {"samples": len(dataset), "test_samples": len(xte),
                    "direction_accuracy_pct": round(accuracy*100, 1),
                    "naive_direction_accuracy_pct": round(baseline_acc*100, 1),
                    "mae_return_pct": round(mae*100, 2),
                    "flat_baseline_mae_pct": round(baseline_mae*100, 2)},
        "history": [{"date": d.strftime("%Y-%m-%d"), "price": round(float(p),2)}
                    for d,p in close.tail(70).items()],
        "validation": [{"date": d.strftime("%Y-%m-%d"), "actual_return_pct": round(float(a)*100,2),
                        "predicted_return_pct": round(float(p)*100,2)}
                       for d,a,p in list(zip(dates, yte, pred))[-30:]],
        "disclaimer": "推定値です。上昇確率は未校正。過去の成績は将来の成果を保証しません。"
    }

def main():
    payload = {"version":"0.2.0", "generated_at": datetime.now(timezone.utc).isoformat(), "horizon_sessions": HORIZON, "stocks": [], "errors": []}
    for code, name in TICKERS.items():
        try:
            payload["stocks"].append(forecast(code,name))
            print("OK", code)
        except Exception as exc:
            payload["errors"].append({"code":code,"message":str(exc)[:180]})
            print("ERROR", code, exc)
    if not payload["stocks"]:
        raise RuntimeError("全銘柄のデータ取得に失敗。公開済みのJSONは保持します。")
    (ROOT/"data").mkdir(exist_ok=True)
    (ROOT/"data"/"predictions.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
if __name__ == "__main__":
    main()
