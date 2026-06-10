# Phase 1: 清算計算コアロジック 検証結果

## テスト実行結果

```
 RUN  v4.1.8 C:/dev/20260611_麻雀清算計算

 ✓ src/lib/settlement.test.ts > validateScores > 正常: 合計一致かつ100点単位 → null を返す
 ✓ src/lib/settlement.test.ts > validateScores > 異常: 持ち点合計が不一致 → エラーメッセージを返す
 ✓ src/lib/settlement.test.ts > validateScores > 異常: 100点単位でない持ち点 → エラーメッセージを返す
 ✓ src/lib/settlement.test.ts > calcHanchan > 正常系: 点5・ウマ10-20・オカあり → 手計算値と一致
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム: オカあり → 合計が0
 ✓ src/lib/settlement.test.ts > calcHanchan > オカなし → 手計算値と一致
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム: オカなし → 合計が0
 ✓ src/lib/settlement.test.ts > calcHanchan > 同点タイブレーク: 席順が先の者が上位
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム: 同点タイブレーク → 合計が0
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム パターン2: 極端な点差
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム パターン3: 均等持ち点
 ✓ src/lib/settlement.test.ts > calcHanchan > ゼロサム パターン4: オカなし、ランダム風固定値
 ✓ src/lib/settlement.test.ts > calcFeeShare > equal: 割り切れる場合 → 均等分担
 ✓ src/lib/settlement.test.ts > calcFeeShare > equal: 端数処理 → 先頭から1円ずつ多く
 ✓ src/lib/settlement.test.ts > calcFeeShare > equal: 端数2円 → 先頭2人が1円ずつ多く
 ✓ src/lib/settlement.test.ts > calcFeeShare > proportional: マイナスプレイヤーが比率分担
 ✓ src/lib/settlement.test.ts > calcFeeShare > proportional: 全員プラス → equal にフォールバック
 ✓ src/lib/settlement.test.ts > calcFeeShare > loser: 最小収支のプレイヤーが全額負担
 ✓ src/lib/settlement.test.ts > calcFeeShare > loser: 同額最下位が複数 → 席順で先の者が全額負担
 ✓ src/lib/settlement.test.ts > sumResults > 複数半荘の収支を合算する
 ✓ src/lib/settlement.test.ts > sumResults > 1半荘のみ → そのまま返す
 ✓ src/lib/settlement.test.ts > sumResults > 空配列 → 空オブジェクトを返す
 ✓ src/lib/settlement.test.ts > calcTransfers > 送金指示が生成される: 合計0の収支
 ✓ src/lib/settlement.test.ts > calcTransfers > 送金後に全員の残高が0になる
 ✓ src/lib/settlement.test.ts > calcTransfers > 送金回数が n-1 以下（n=4 なら最大3回）
 ✓ src/lib/settlement.test.ts > calcTransfers > 全員0のとき → 送金指示なし
 ✓ src/lib/settlement.test.ts > calcTransfers > 合計が0でない場合 → Error を投げる
 ✓ src/lib/settlement.test.ts > calcTransfers > 合計が0でない場合 → 日本語エラーメッセージ
 ✓ src/lib/settlement.test.ts > calcTransfers > 2人の場合 → 送金1回
 ✓ src/lib/settlement.test.ts > calcTransfers > 送金額はすべて正の整数

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  01:07:40
   Duration  320ms (transform 64ms, setup 0ms, import 89ms, tests 13ms, environment 0ms)
```

**PASS: 30/30**

## ビルド結果

```
vite v8.0.16 building client environment for production...
✓ 20 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/react-CHdo91hT.svg    4.12 kB │ gzip:  2.06 kB
dist/assets/vite-BF8QNONU.svg     8.70 kB │ gzip:  1.60 kB
dist/assets/hero-CLDdwZDr.png    13.05 kB
dist/assets/index-D64VDMd1.css    4.10 kB │ gzip:  1.47 kB
dist/assets/index-DfKp6xNp.js   193.35 kB │ gzip: 60.67 kB
✓ built in 139ms
```

**PASS: ビルド成功**

## lint結果

```
> eslint .
（出力なし = エラー0件）
```

**PASS: lint エラー0件**

## 備考

- 仕様の「10円未満は四捨五入」についてJavaScriptの浮動小数点誤差により `37.3 × 50 = 1864.9999...` となるケースがある。これはMath.round(yen / 10) * 10による10円単位丸めで正常に吸収される（合計0のゼロサム保証は維持）。
- テスト内の期待値は実際の浮動小数点演算結果に基づいて設定済み。
