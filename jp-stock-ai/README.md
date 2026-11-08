# 日本株AI予測 v0.1.0

GitHub Pages対応の5取引日後株価予測アプリ。トップページ: `/jp-stock-ai/`。

## 仕組み
- GitHub Actions `update-jp-stock-ai.yml` が平日18:20 JST（UTC 09:20）にデータを再取得・学習し、予測JSONをコミット。実際の実行開始は遅延する場合があります。
- `predict.py` はYahoo Finance経由で東証銘柄の自動調整後日足7年分を取得し、特徴量（移動平均・騰落率・RSI・出来高・ボラティリティなど）を計算。
- 5営業日後騰落率の回帰と上昇確率の分類にHistGradientBoostingモデルを採用。
- 時系列順80%学習／20%検証、5取引日分のギャップを入れ、一定期間保持した検証結果を表示します。
- 比較指標は変化なし予測のMAE、および常に多数派方向を当てるベースラインです（後者は方向の参考値）。過去の検証成績は将来の成績を保証しません。
- 上昇確率は校正されていないモデル出力であり、信頼できる発生確率として扱わないでください。
- 取引所の営業日を暦上で正確に計算するわけではなく、**5取引日先**を対象とします。
- 直近の公開済みJSONが無い／取得が失敗した場合は予測を表示せず、架空データで埋めません。

## 初回セットアップ
GitHub Actionsタブから `Update Japanese stock AI forecasts` を **Run workflow** で手動実行してください。Actionsの書き込み権限（Settings > Actions > General > Workflow permissions）が必要な場合があります。

ローカル実行:
```sh
python -m pip install -r jp-stock-ai/requirements.txt
python jp-stock-ai/predict.py
python -m http.server 8000
```
`http://localhost:8000/jp-stock-ai/` を開きます。

## 注意
自動売買機能はありません。予測は投資助言ではなく学習・検証用。株価の利用条件や配信遅延に注意してください。
