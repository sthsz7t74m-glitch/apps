# よい時計（YoiTokei）

App Store公開を目指すSwiftUI製の時計・アラームアプリです。

## 初期版の機能

- 現在時刻と日付
- 複数アラーム
- アラームの有効・無効切り替え
- ローカル通知
- タイマー
- ストップウォッチ
- 端末内へのアラーム保存

## Macで開く

XcodeとXcodeGenを用意して、リポジトリ直下で実行します。

```bash
brew install xcodegen
cd ios/yoitokei
xcodegen generate
open YoiTokei.xcodeproj
```

Xcodeの `Signing & Capabilities` で自分のTeamを選択し、Bundle Identifierが重複する場合は変更してください。

## 注意

通常のローカル通知を使用しています。iPhoneの消音モード、集中モード、通知設定などによって音が鳴らない場合があります。Apple標準の時計アプリと同じ強制的な目覚まし動作を保証するものではありません。

## App Store提出前に必要なもの

- 正式なアプリアイコン
- 実機での通知テスト
- プライバシーポリシー
- サポートURL
- App Store用スクリーンショット
- Apple Developer Programへの登録
