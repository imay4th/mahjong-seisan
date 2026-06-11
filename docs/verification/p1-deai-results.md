# 脱AIスロップ改修 P1（Step 1〜4）検証レポート

実施日: 2026-06-11

---

## 自動検証結果

### npm test -- --run
```
 RUN  v4.1.8 C:/dev/20260611_麻雀清算計算

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  22:12:28
   Duration  487ms (transform 95ms, setup 0ms, import 134ms, tests 20ms, environment 0ms)
```

### npm run build
```
vite v8.0.16 building client environment for production...
✓ 23 modules transformed.
dist/index.html                   0.81 kB │ gzip:  0.48 kB
dist/assets/index-HL6r_L7E.css   15.24 kB │ gzip:  3.31 kB
dist/assets/index-BO3fQ3hc.js   208.93 kB │ gzip: 65.31 kB
✓ built in 360ms
```

### npm run lint
```
（エラー出力なし。終了コード 0）
```

---

## Step 1〜4 実装チェックリスト

### Step 1: フォント適用の仕上げ
- [x] `src/App.css` の `.app-title` に `font-family: var(--font-display)` を追加
- [x] `.app-title` の `color` を `var(--text-gold)` → `var(--text-primary)` に変更（Step 2 と同時）
- [x] `--font-mono` 適用箇所の全確認
  - `cumulative-amount`: App.css:143 — 適用済み
  - `score-cell-input`: App.css:425 — 適用済み
  - `score-total-val`: App.css:322 — 適用済み（`score-total-val` 親の `.score-cell-input` から継承）
  - `yen-val` / `score-val` / `score-cell-yen`: App.css:232,239,467 — 適用済み
  - `result-val`: App.css:591 — 適用済み
  - `transfer-amount`: App.css:744 — 適用済み
  - `fee-amount`: App.css:651 — 適用済み

### Step 2: 金色の格下げ＋質感修正
- [x] `.app-title` の `color: var(--text-gold)` → `var(--text-primary)` に変更（src/App.css:40）
- [x] `.screen-title` の `color: var(--text-gold)` → `var(--text-primary)` に変更（src/index.css:128）
- [x] `.mahjong-tile` の box-shadow を3層→2層に変更、inset ハイライト削除（src/App.css:31）
- [x] `.hanchan-label` の `color: var(--text-gold)` → `var(--text-secondary)` に変更（src/App.css:188）
- [x] `.score-table-th` の `color: var(--text-gold)` → `var(--text-secondary)` に変更（src/App.css:368）
- [x] `.transfer-arrow` の `color: var(--text-gold)` → `var(--text-secondary)` に変更（src/App.css:738）
- [x] `.btn-back` の `color: var(--text-gold)` → `var(--text-secondary)` に変更（src/index.css:140）
- [x] `.setup-section-title` の `color: var(--text-gold)` → `var(--text-secondary)` に変更（src/App.css:79）
- [x] `.fee-card-title` は `color: var(--text-gold)` を維持（「店に払う額」は金色ポリシー対象）
- [x] `--text-plus`（プラス収支の金色）は暫定維持
- [x] アクティブセグメントボタン（`--bg-segment-active: #c9a45c`）は維持

### Step 3: コピー一括修正
- [x] `プレイヤー{i+1}の名前を入力してください。` → `{i+1}席の名前が空です`（src/components/setup-screen.tsx:49）
- [x] `プレイヤー名が重複しています。` → `同じ名前が2人います`（src/components/setup-screen.tsx:53）
- [x] `カスタムレートに正の数を入力してください。` → `レートは1以上で`（src/components/setup-screen.tsx:57）
- [x] `ゲーム設定` → `卓の設定`（src/components/setup-screen.tsx:93）
- [x] `累計収支` → `ここまでの収支`（src/components/game-screen.tsx:183）
- [x] `送金指示` → `精算 — だれがだれに`（src/components/settlement-screen.tsx:177）
- [x] `収支内訳` → `収支のうちわけ`（src/components/settlement-screen.tsx:69、並べ替え後は後段）
- [x] `入力中` → `今局`（src/components/game-screen.tsx:261）
- [x] `送金なし（全員±0）` → `貸し借りなし。きれいに終局`（src/components/settlement-screen.tsx:179）
- [x] `text-transform: uppercase` を全 CSS から削除（デッドコード）
  - `.setup-section-title`: App.css:82
  - `.cumulative-title`: App.css:111
  - `.list-title`: App.css:157
  - `.result-card-title`: App.css:549
  - `.fee-card-title`: App.css:622
  - `.transfers-title`: App.css:695

### Step 4: 清算画面の順序入替＋送金ヒーロー化
- [x] セクション順を「送金→店に払う額→収支のうちわけ」に変更（src/components/settlement-screen.tsx:67〜）
- [x] 送金カードに `transfers-card-hero` クラス追加（border 強調・box-shadow 強化・不透明背景）
- [x] 送金額に `transfer-amount-hero` クラス追加（font-size: 26px → 画面最大）
- [x] ロジック・計算は一切変更なし（JSX 並べ替えのみ）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/App.css` | Step 1: `.app-title` font-family/color; Step 2: `.mahjong-tile` shadow, 各種 color, `text-transform` 削除; Step 4: hero CSS 追加 |
| `src/index.css` | Step 2: `.screen-title` color, `.btn-back` color |
| `src/components/setup-screen.tsx` | Step 3: エラーメッセージ3件, 画面タイトル |
| `src/components/game-screen.tsx` | Step 3: `ここまでの収支`, `今局` |
| `src/components/settlement-screen.tsx` | Step 3: 見出し2件, 空状態テキスト; Step 4: セクション順序入替, hero クラス付与 |

---

## コピー Before→After 適用箇所（file:line）

| Before | After | ファイル:行 |
|---|---|---|
| `プレイヤー${i+1}の名前を入力してください。` | `${i+1}席の名前が空です` | setup-screen.tsx:49 |
| `プレイヤー名が重複しています。` | `同じ名前が2人います` | setup-screen.tsx:53 |
| `カスタムレートに正の数を入力してください。` | `レートは1以上で` | setup-screen.tsx:57 |
| `ゲーム設定` | `卓の設定` | setup-screen.tsx:93 |
| `累計収支` | `ここまでの収支` | game-screen.tsx:183 |
| `送金指示` | `精算 — だれがだれに` | settlement-screen.tsx:68 |
| `収支内訳` | `収支のうちわけ` | settlement-screen.tsx:109 |
| `入力中` | `今局` | game-screen.tsx:261 |
| `送金なし（全員±0）` | `貸し借りなし。きれいに終局` | settlement-screen.tsx:73 |

---

## 視覚検証（メイン実施、2026-06-11、モバイル viewport 375×812、localhost:5174）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | フォント実体の読込（Google Fonts） | `document.fonts.load` 後に DM Mono / Zen Kaku Gothic New / Zen Old Mincho すべて check=true。woff2 直接 fetch も 200 OK | PASS |
| 2 | ホームタイトルの書体・色 | computed: `font-family: "Zen Old Mincho", serif` / `color: rgb(240,236,226)`（金色でない生成り） | PASS |
| 3 | 本文書体 | body computed: `"Zen Kaku Gothic New", system-ui, sans-serif` | PASS |
| 4 | 麻タイルの shadow 簡素化 | computed: 2層（`0 2px 0` + `0 6px 14px`）、inset 光沢なし | PASS |
| 5 | コピー適用（実画面で観測） | 「卓の設定」「1席の名前が空です」「ここまでの収支」「今局」「精算 — だれがだれに」「収支のうちわけ」表示確認 | PASS |
| 6 | 金色の格下げ | setup-section-title の color = rgb(168,184,164)（secondary）。金色は fee 系とアクティブセグメントのみ | PASS |
| 7 | 清算画面の順序 | 精算 — だれがだれに → 各自が店に払う額 → 収支のうちわけ | PASS |
| 8 | 送金ヒーロー化 | transfer-amount-hero: font-size 26px / DM Mono | PASS |
| 9 | 回帰: 計算値 | 半荘 42300/28200/18000/11500＋自動入力10000・場代2000均等 → 送金 1,920/690/410円（従来と同一） | PASS |
| 10 | 横スクロール | scrollWidth 375 = clientWidth 375 | PASS |
| 11 | デッドコード除去 | `grep text-transform src/` → 0件 | PASS |

備考: 「入力中」の文言は aria-label（game-screen.tsx:278、スクリーンリーダー向け）のみ残存。視覚UIは「今局」。
備考: title「麻雀清算 — 仲間内の精算メモ」確認。
スクリーンショット: preview_screenshot ツール障害のため未取得。見た目の審美確認はユーザーがブラウザで実施（http://localhost:5173）。
