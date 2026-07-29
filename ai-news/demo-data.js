window.ONE_NEWS_DEMO = (() => {
  const now = Date.now();
  const ago = hours => new Date(now - hours * 60 * 60 * 1000).toISOString();
  const source = (name, type, url = '') => ({ name, type, url });

  return {
    generatedAt: new Date(now).toISOString(),
    sourceMode: 'demo',
    totalArticles: 8,
    totalClusters: 8,
    succeededSources: 0,
    failedSources: 0,
    sources: [],
    items: [
      {
        id: 'demo-ai-models',
        title: '生成AI各社、新しい推論モデルを相次いで強化',
        summary: '主要AI企業が推論性能と処理速度を改善したモデルを相次いで発表。企業利用では精度だけでなく、料金と応答速度の競争がさらに重要になっています。',
        fact: '複数のAI企業が、推論・コーディング・業務自動化を主な用途とする新モデルや更新を公開しました。',
        background: '生成AI市場では、単純な文章生成から、複数段階の作業を進めるエージェント型機能へ競争軸が移っています。',
        importance: '仕事でAIを使う人にとって、利用モデルによって速度・料金・成果物の品質が大きく変わる可能性があります。',
        outlook: '今後はモデル単体の性能だけでなく、外部サービスとの連携、権限管理、実行コストも比較基準になります。',
        category: 'AI・IT',
        tags: ['AI', '生成AI', 'テクノロジー'],
        minutes: 2,
        priority: 100,
        breaking: true,
        publishedAt: ago(.2),
        sources: [source('公式発表', '公式発表'), source('報道機関', '報道機関'), source('専門メディア', '専門メディア')]
      },
      {
        id: 'demo-football-transfer',
        title: '欧州サッカー移籍市場、若手選手への大型投資が加速',
        summary: '各クラブが将来性の高い若手選手を早い段階で確保する動きを強化。移籍金だけでなく、契約年数や売却条項も重要になっています。',
        fact: '欧州主要リーグの複数クラブが、若手選手の獲得や契約延長を発表しました。',
        background: '財務規制への対応と将来の売却益を両立するため、若手選手へ投資する戦略が広がっています。',
        importance: '応援クラブの補強方針だけでなく、数年後の戦力や財務状況にも直結する動きです。',
        outlook: '移籍期間終盤にかけて、主力放出と若手獲得がセットで進む可能性があります。',
        category: 'サッカー',
        tags: ['サッカー', '移籍', '欧州'],
        minutes: 2,
        priority: 94,
        breaking: false,
        publishedAt: ago(.5),
        sources: [source('クラブ公式', '公式発表'), source('報道機関', '報道機関')]
      },
      {
        id: 'demo-weather',
        title: '国内で猛烈な暑さ続く、電力需要と熱中症対策に注意',
        summary: '広い範囲で気温が上昇し、自治体や電力会社が注意を呼びかけています。屋外活動だけでなく、室内での熱中症にも警戒が必要です。',
        fact: '気象機関が複数地域に高温への警戒情報を発表しました。',
        background: '高温が長時間続くと夜間も室温が下がりにくく、室内熱中症のリスクが高まります。',
        importance: '健康への直接的な影響に加え、電力需給や交通、イベント運営にも影響する可能性があります。',
        outlook: '最新の暑さ指数と自治体の情報を継続して確認する必要があります。',
        category: '気象・防災',
        tags: ['気象', '熱中症', '防災'],
        minutes: 1,
        priority: 91,
        breaking: true,
        publishedAt: ago(.7),
        sources: [source('気象機関', '公式発表'), source('報道機関', '報道機関')]
      },
      {
        id: 'demo-steam',
        title: 'Steamで大型セール、人気作の値下げ幅を比較',
        summary: '幅広いジャンルのPCゲームがセール対象に。割引率だけでなく、直近評価・平均クリア時間・過去最安値の確認が重要です。',
        fact: 'Steamストアで複数タイトルの期間限定割引が始まりました。',
        background: '大型セールでは対象作品が多いため、ウィッシュリストや評価条件で絞り込む使い方が一般的です。',
        importance: '価格だけでなく、プレイ時間や評価も購入後の満足度を左右します。',
        outlook: '終了日時と過去最安値を確認し、候補を保存して比較するのがよさそうです。',
        category: 'ゲーム',
        tags: ['Steam', 'ゲーム', 'セール'],
        minutes: 1,
        priority: 88,
        breaking: false,
        publishedAt: ago(1),
        sources: [source('Steam', '公式発表'), source('専門メディア', '専門メディア')]
      },
      {
        id: 'demo-economy',
        title: '円相場が変動、企業決算と個人消費への影響を整理',
        summary: '為替市場で円が大きく動き、輸出企業と輸入企業で影響が分かれています。旅行費用や食品価格にも時間差で影響する可能性があります。',
        fact: '外国為替市場で円相場が前日比で変動しました。',
        background: '為替は金利差、中央銀行の姿勢、経済指標、投資家心理など複数の要因で動きます。',
        importance: '企業業績だけでなく、海外旅行、輸入品、エネルギー価格など生活コストにも関係します。',
        outlook: '経済指標や中央銀行関係者の発言で、短期的な値動きが大きくなる可能性があります。',
        category: '経済',
        tags: ['経済', '円相場', '企業決算'],
        minutes: 2,
        priority: 85,
        breaking: false,
        publishedAt: ago(1.5),
        sources: [source('報道機関A', '報道機関'), source('報道機関B', '報道機関')]
      },
      {
        id: 'demo-jleague',
        title: 'Jリーグ終盤戦へ、上位争いと残留争いが同時に激化',
        summary: '勝ち点差が縮まり、上位・残留とも直接対決の重要性が上昇。連戦日程と選手層の厚さが順位を左右しそうです。',
        fact: '直近節の結果を受け、複数クラブ間の勝ち点差が縮まりました。',
        background: 'リーグ終盤は対戦相手の順位だけでなく、連戦、負傷者、得失点差も大きな意味を持ちます。',
        importance: '一試合の勝敗が順位を複数変動させる状況に入り、直接対決の価値が高まっています。',
        outlook: '控え選手の起用と試合終盤の得点力が、最終順位を決める要因になりそうです。',
        category: 'サッカー',
        tags: ['Jリーグ', 'サッカー', '順位'],
        minutes: 2,
        priority: 82,
        breaking: false,
        publishedAt: ago(2),
        sources: [source('Jリーグ', '公式発表'), source('スポーツメディア', '専門メディア')]
      }
    ]
  };
})();
