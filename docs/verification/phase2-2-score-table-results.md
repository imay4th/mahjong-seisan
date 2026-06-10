# Phase 2-2: 点数表方式への改修 — 検証結果

## 自動検証結果

| 項目 | 結果 |
|------|------|
| `npm test -- --run` | **PASS** (30/30) |
| `npm run build` | **PASS** (157ms) |
| `npm run lint` | **エラー0件** |

### テスト詳細（転載）

```
 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  01:34:30
   Duration  338ms (transform 60ms, setup 0ms, import 88ms, tests 14ms, environment 0ms)
```

### ビルド詳細（転載）

```
vite v8.0.16 building client environment for production...
✓ 23 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-BcXU0JWN.css   15.13 kB │ gzip:  3.28 kB
dist/assets/index-BLkuhyzC.js   208.94 kB │ gzip: 65.24 kB
✓ built in 157ms
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/types.ts` | `GameState` に `personalExpenses` / `draft` フィールドを追加 |
| `src/hooks/use-game-state.ts` | `updateHanchan` / `setTotalFee` / `setPersonalExpense` / `setDraft` を追加。後方互換loadState実装 |
| `src/App.tsx` | 新フック戻り値を `GameScreen` に渡すよう更新 |
| `src/components/game-screen.tsx` | 点数表UIに全面書き換え（スコアシート方式・ドラフト行・場代行・個人分行） |
| `src/components/hanchan-form.tsx` | 廃止（コメントのみ残存） |
| `src/components/setup-screen.tsx` | 場代金額入力を削除、分担方式セレクタのみ残す |
| `src/components/settlement-screen.tsx` | 個人分行を追加、「各自が店に払う額 = 場代負担 + 個人分」に変更 |
| `src/App.css` | 点数表スタイル追加（`.score-table-*`、`.score-cell-*`等）、清算画面の内訳スタイル追加 |

---

## 実装した仕様項目チェックリスト

### 点数表UI
- [x] ヘッダ行: プレイヤー名4列（先頭に行ラベル列）
- [x] 確定済み半荘行: インライン編集可能なinput、セル下に円収支表示（プラス金色・マイナス赤）
- [x] ドラフト行（入力中）を表の最下部に常に1行表示
- [x] 4セルすべて入力済みかつvalidateScores=nullで自動確定（最後のセルのblur時判定）
- [x] 自動入力: 3セル入力済みで残り1セルにフォーカスした時点で残額を自動セット
- [x] 確定済み行の編集中にも自動入力が機能
- [x] 行バリデーションエラーは日本語で小さく表示
- [x] 不正行は収支を「—」表示にし累計から除外（クラッシュなし）
- [x] 各半荘行に削除ボタン（×、confirm付き）
- [x] 場代行: 点数表内の下部に配置、GameState.totalFeeに保存
- [x] 個人分行: プレイヤーごとに金額input、GameState.personalExpensesに保存
- [x] ドラフト行のdraftもlocalStorageに保存・リロードで復元
- [x] 累計収支カード（確定済み有効半荘のみで計算）

### 設定画面
- [x] 場代金額入力を撤去
- [x] 分担方式セレクタは残存

### 清算画面
- [x] 収支内訳: 麻雀収支／場代負担／個人分／最終収支の4行構成
- [x] 「各自が店に払う額」= 場代負担 + 個人分（内訳と合計を表示）
- [x] 送金指示は麻雀収支ベース（変更なし）

### 後方互換
- [x] 旧形式（personalExpenses/draftなし）データ読み込み時のデフォルト値補完

### 制約
- [x] TypeScript厳密型（any禁止）
- [x] インデント2スペース、セミコロンあり、シングルクォート
- [x] 外部ライブラリ追加なし
- [x] 麻雀卓風ダークデザイン踏襲
- [x] タッチターゲット44px以上（score-cell-input: min-height 44px）
- [x] 数字は tabular-nums
- [x] settlement.ts / settlement.test.ts は変更なし

---

## 視覚・操作検証（メイン実施、2026-06-11、モバイル viewport 375×812）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | 後方互換: 旧形式 localStorage（personalExpenses/draft なし、totalFee=2000）の読込 | クラッシュなし。点数表に第1局・場代2000円が引き継がれ表示 | PASS |
| 2 | 点数表の構成（375px幅） | ヘッダ＋半荘行＋入力中行＋場代行＋個人分行。横スクロールなし（scrollWidth 375 = clientWidth 375） | PASS |
| 3 | 4人目の自動入力 | 3セル入力（30000×3）後、4人目セルに focusin → 10000 が自動セット | PASS |
| 4 | 自動確定 | 4セル目 focusout で第2局として確定、新しい入力中行が出現 | PASS |
| 5 | 確定行の収支計算 | 第2局 +2,000/+500/−500/−2,000円 = 手計算期待値と一致（同点は席順タイブレーク） | PASS |
| 6 | 累計収支更新 | +4,610/+910/−1,600/−3,920円 = 2半荘の合算と一致 | PASS |
| 7 | 個人分入力 → 清算画面 | 内訳4行（麻雀収支/場代負担/個人分/最終収支）。最終収支 +4,110/+410/−3,300/−5,220 = 手計算一致 | PASS |
| 8 | 各自が店に払う額 | 500/500/1,700/1,300円、合計4,000円 = 場代2,000＋個人分2,000 | PASS |
| 9 | 送金指示が麻雀収支ベース | 北野→東山3,920／西村→南田910／西村→東山690（3件 = n−1、送金後全員0） | PASS |
| 10 | リロード復元 | 2半荘の持ち点・場代2000・個人分1200/800・入力中行すべて復元 | PASS |

※ 自動入力の検証時、合成イベント 'focus' では発火せず 'focusin' で発火することを確認（React 17+ の仕様どおり。実機のタップでは focusin が発火するため問題なし）。

### スクリーンショット

未取得（preview_screenshot のツール障害継続）。見た目の審美的確認はユーザーがブラウザで実施すること。
