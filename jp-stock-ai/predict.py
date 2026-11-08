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
    "7203": "トヨタ自動車", "6758": "ソニーグループ",
    "7974": "任天堂", "8306": "三菱UFJ FG",
    "9432": "NTT", "9984": "ソフトバンクグループ",
    "6861": "キーエンス", "8035": "東京エレクトロン",
    "6098": "リクルートHD", "4063": "信越化学工業",
    "6501": "日立製作所", "6752": "パナソニックHD",
    "7267": "本田技研工業", "6902": "デンソー",
    "8031": "三井物産", "8058": "三菱商事",
    "8001": "伊藤忠商事", "8002": "丸紅",
    "8316": "三井住友FG", "8411": "みずほFG",
    "8766": "東京海上HD", "8591": "オリックス",
    "9433": "KDDI", "9434": "ソフトバンク",
    "9983": "ファーストリテイリング", "7976": "三菱鉛筆",
    "6367": "ダイキン工業", "6954": "ファナック",
    "7011": "三菱重工業", "7012": "川崎重工業",
    "5401": "日本製鉄", "5803": "フジクラ",
    "4568": "第一三共", "4502": "武田薬品工業",
    "4519": "中外製薬", "4901": "富士フイルムHD",
    "2914": "日本たばこ産業", "4452": "花王",
    "2802": "味の素", "2502": "アサヒグループHD",
    "7733": "オリンパス", "7741": "HOYA",
    "6981": "村田製作所", "6762": "TDK",
    "9101": "日本郵船", "9104": "商船三井",
    "9020": "東日本旅客鉄道", "9022": "東海旅客鉄道",
    "9843": "ニトリHD", "4661": "オリエンタルランド",
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

def daily_forecast(close, features, cutoff_pos, common):
    """Fit independent models for horizons 1..5 with labels mature at cutoff."""
    cutoff_price = float(close.iloc[cutoff_pos])
    input_row = features.iloc[[cutoff_pos]]
    if not input_row.notna().all(axis=None):
        raise ValueError("予測基準日の特徴量が不正です")
    result = [{"day": 0, "price": round(cutoff_price, 2)}]
    # For a k-session target, the latest observable training target
    # starts at or before cutoff_pos-k.
    for horizon in range(1, HORIZON + 1):
        label = close.shift(-horizon) / close - 1
        limit = cutoff_pos - horizon + 1
        past_x, past_y = features.iloc[:limit], label.iloc[:limit]
        eligible = past_x.notna().all(axis=1) & past_y.notna() & np.isfinite(past_y)
        xtrain = past_x.loc[eligible]
        ytrain = past_y.loc[eligible].clip(-0.5, 0.5)
        if len(xtrain) < 350:
            raise ValueError(f"{horizon}日先の学習データが不足")
        reg = HistGradientBoostingRegressor(**common)
        reg.fit(xtrain, ytrain)
        predicted_change = float(np.clip(reg.predict(input_row)[0], -0.3, 0.3))
        result.append({"day": horizon, "price": round(cutoff_price * (1 + predicted_change), 2),
                       "return_pct": round(predicted_change * 100, 2)})
    return result


def one_week_ago_check(close, features, target, common):
    """Reconstruct 1..5 day predictions with only information available at cutoff."""
    cutoff_pos = len(close) - 1 - HORIZON
    cutoff_date = close.index[cutoff_pos]
    predicted = daily_forecast(close, features, cutoff_pos, common)
    start_price = float(close.iloc[cutoff_pos])
    actual_price = float(close.iloc[-1])
    predicted_price = predicted[-1]["price"]
    predicted_return = predicted_price / start_price - 1
    actual_return = actual_price / start_price - 1
    actual_series = [
        {"day": offset, "date": close.index[cutoff_pos + offset].strftime("%Y-%m-%d"),
         "price": round(float(close.iloc[cutoff_pos + offset]), 2)}
        for offset in range(HORIZON + 1)
    ]
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
        "daily_forecast": predicted,
        "daily_actual": actual_series,
        "method": "各1～5取引日先を独立学習。各予測時点までに確定済みの教師データのみ使用"
    }


def rolling_one_day_forecasts(close, features, common, shown_days=70, refit_every=10):
    """Out-of-sample daily predictions for every plotted historical session.

    For a target session at index t, use features and price from t-1.
    Model is fitted with only 1-day labels fully observed at or before t-1.
    Refit periodically to bound compute; never train on a future observation.
    """
    start = max(1, len(close) - shown_days)
    target = close.shift(-1) / close - 1
    model = None
    records = []
    for t in range(start, len(close)):
        origin = t - 1
        if model is None or (t - start) % refit_every == 0:
            train_x = features.iloc[:origin]
            train_y = target.iloc[:origin]
            valid = train_x.notna().all(axis=1) & train_y.notna() & np.isfinite(train_y)
            train_x = train_x.loc[valid]
            train_y = train_y.loc[valid].clip(-0.5, 0.5)
            if len(train_x) < 350:
                raise ValueError("連続バックテストの学習データが不足")
            model = HistGradientBoostingRegressor(**common)
            model.fit(train_x, train_y)
        input_row = features.iloc[[origin]]
        if not input_row.notna().all(axis=None):
            raise ValueError("連続バックテストの特徴量が不正")
        predicted_return = float(np.clip(model.predict(input_row)[0], -0.3, 0.3))
        predicted_price = float(close.iloc[origin]) * (1 + predicted_return)
        observed_price = float(close.iloc[t])
        records.append({
            "date": close.index[t].strftime("%Y-%m-%d"),
            "prediction_asof": close.index[origin].strftime("%Y-%m-%d"),
            "predicted_price": round(predicted_price, 2),
            "actual_price": round(observed_price, 2),
            "previous_price": round(float(close.iloc[origin]), 2),
            "direction_correct": bool((predicted_return > 0) == (observed_price > float(close.iloc[origin])))
        })
    if not records:
        raise ValueError("連続バックテストの予測が生成されていません")
    error = [abs(r["predicted_price"] / r["actual_price"] - 1) * 100 for r in records]
    naive = [abs(r["previous_price"] / r["actual_price"] - 1) * 100 for r in records]
    return {
        "points": records,
        "metrics": {
            "samples": len(records),
            "direction_accuracy_pct": round(100 * sum(r["direction_correct"] for r in records) / len(records), 1),
            "mean_absolute_price_error_pct": round(float(np.mean(error)), 2),
            "unchanged_price_baseline_error_pct": round(float(np.mean(naive)), 2),
        },
        "method": "1取引日前に既知の価格と特徴量から翌日を予測。教師ラベルは予測時点までに確定したもののみ。モデルは10取引日ごとに更新。"
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
    if not (np.isfinite(current) and current > 0):
        raise ValueError("終値が不正です")
    quality_pass = bool(mae < baseline_mae and accuracy > baseline_acc)
    ranking_quality = "検証基準通過" if quality_pass else "精度未確認"
    ranking_reason = ("誤差・方向的中率とも基準値を上回る" if quality_pass else "検証成績が単純予測の基準を両方は超えていない")
    dates = dataset.index[first_test:]
    historical_check = one_week_ago_check(close, features, target, common)
    future_daily = daily_forecast(close, features, len(close) - 1, common)
    rolling_history = rolling_one_day_forecasts(close, features, common)
    change = future_daily[-1]['price'] / current - 1
    return {
        "one_week_ago_check": historical_check,
        "daily_forecast": future_daily,
        "rolling_history": rolling_history,
        "ranking_quality": ranking_quality, "ranking_quality_pass": quality_pass,
        "ranking_quality_reason": ranking_reason,
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
    payload = {"version":"0.6.0", "generated_at": datetime.now(timezone.utc).isoformat(), "horizon_sessions": HORIZON, "stocks": [], "errors": []}
    for code, name in TICKERS.items():
        try:
            payload["stocks"].append(forecast(code,name))
            print("OK", code)
        except Exception as exc:
            payload["errors"].append({"code":code,"message":str(exc)[:180]})
            print("ERROR", code, exc)
    if not payload["stocks"]:
        raise RuntimeError("全銘柄のデータ取得に失敗。公開済みのJSONは保持します。")
    payload["stocks"].sort(key=lambda row: row["code"])
    payload["universe_count"] = len(TICKERS)
    (ROOT/"data").mkdir(exist_ok=True)
    (ROOT/"data"/"predictions.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
if __name__ == "__main__":
    main()
