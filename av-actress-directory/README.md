# 日本AV女優名鑑

成人向け業界で活動した人物の**公開プロフィールだけ**を整理し、複数条件で検索できる静的Webアプリです。露骨な画像・動画は掲載していません。

## 主な機能

- 女優名・よみ・旧芸名・公表済み本名によるキーワード検索
- 出身地による絞り込み
- 年齢・身長・カップ数の範囲指定
- 「本名公表あり」「写真あり」の絞り込み
- 名前・年齢・身長・カップ数による並び替え
- 生年月日から現在年齢を自動計算（Asia/Tokyo基準）
- スマートフォン向けレスポンシブ表示
- 18歳以上の確認画面
- 詳細ダイアログ内でプロフィール確認元と写真ライセンスを表示

## 掲載方針

- 本名は、本人・事務所・過去の公的な芸能活動などを通じて広く公表済みと確認できる場合のみ掲載します。
- 推測、流出情報、匿名掲示板由来の情報は掲載しません。
- 情報源ごとに値が異なる項目、信頼できる確認元がない項目、非公表項目は `null` とし、画面上では `—` と表示します。
- 年齢・身長・カップ数の範囲フィルターが指定されている場合、その項目が未公表の人物は結果から除外します。
- 顔写真は再利用条件を確認できたWikimedia Commons画像のみ表示し、それ以外はプレースホルダーにします。
- 写真のクレジットとライセンスは [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) にまとめています。

## ファイル構成

- `index.html` — 画面構造、年齢確認、フィルターUI
- `styles.css` — レスポンシブデザイン
- `data.js` — 人物プロフィールと確認元、写真ライセンス情報
- `app.js` — 検索、絞り込み、並び替え、年齢計算、詳細表示
- `ATTRIBUTIONS.md` — 写真の出典とライセンス

## データ追加方法

`data.js` の `window.AV_ACTRESSES` に次の形式で追加します。

```js
{
  id: "unique-id",
  name: "芸名",
  kana: "よみ",
  aliases: ["旧芸名"],
  birthDate: "1990-01-01", // 生年非公表なら null
  birthdayLabel: null,     // 例: "1月1日（生年非公表）"
  birthplace: "東京都",
  realName: null,          // 公表確認できる場合だけ入力
  heightCm: 160,
  cup: "E",
  note: null,
  sources: [
    { label: "確認元名", url: "https://example.com/profile" }
  ]
}
```

写真を追加する場合は、再利用可能なライセンスを必ず確認し、次の情報も登録します。

```js
photo: {
  file: "Wikimedia Commons上のファイル名.jpg",
  pageUrl: "https://commons.wikimedia.org/wiki/File:...",
  author: "撮影者・権利者",
  license: "CC BY 2.0",
  licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  position: "50% 20%"
}
```

人物データを追加・変更した際は、`updatedAt` と確認元も同時に更新してください。
