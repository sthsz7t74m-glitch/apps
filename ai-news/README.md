# ONE NEWS

複数のRSS・Atom・公式フィードを横断し、同じ出来事の記事を自動統合して表示するスマホ向けニュースアプリです。

公開URL: `https://sthsz7t74m-glitch.github.io/apps/ai-news/`

## 現在の機能

- RSS・Atom・公式フィードの自動取得
- URL正規化とタイトル類似度による重複記事の統合
- 配信元、カテゴリ、鮮度を使った重要度スコア
- 配信元とカテゴリが偏りすぎないおすすめ順
- おすすめ、あなた向け、新着、ジャンル、あとで読む
- タイトル、要約、タグ、配信元の横断検索
- 何が起きたか、背景、重要性、今後の確認ポイント
- 元記事リンクと取得ソースの状態表示
- カード表示・コンパクト表示
- 興味キーワードと保存記事の端末内保存
- 通信失敗時の保存済みデータ・デモデータへのフォールバック

## データ更新

GitHub Actionsの `Update ONE NEWS data` が30分ごとに動作します。

```text
RSS / Atom / 公式フィード
        ↓
ai-news/scripts/update-news.mjs
        ↓ URL正規化・重複統合
ai-news/scripts/refine-news.mjs
        ↓ 配信元・カテゴリの偏りを調整
ai-news/data/news.json
        ↓
GitHub Pages
```

APIキーやGitHub Secretsは不要です。

## 主なファイル

```text
ai-news/
├─ index.html
├─ styles.css
├─ app.js
├─ demo-data.js
├─ data/
│  ├─ sources.json
│  └─ news.json
└─ scripts/
   ├─ update-news.mjs
   └─ refine-news.mjs
```

## 配信元を変更する

`data/sources.json` の項目を追加・変更します。

```json
{
  "id": "example",
  "name": "配信元名",
  "url": "https://example.com/feed.xml",
  "type": "公式発表",
  "category": "AI・IT",
  "language": "ja",
  "priority": 8,
  "maxItems": 20
}
```

変更をmainへ反映すると、GitHub Actionsが自動で再取得します。

## 注意

表示するのはフィードで配信された見出し、概要、リンクをもとにした自動整理です。記事本文は転載しません。正確な表現と最新情報は、各カードの情報源から元記事を確認してください。
