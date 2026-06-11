# P2 構造改修 検証結果（Step 7・8・9）

実施日: 2026-06-11

---

## 1. 自動検証結果

### テスト（npm test -- --run）

```
Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  22:35:46
   Duration  375ms (transform 74ms, setup 0ms, import 105ms, tests 17ms, environment 0ms)
```

### ビルド（npm run build）

```
vite v8.0.16 building client environment for production...
✓ 23 modules transformed.
dist/index.html                   0.86 kB │ gzip:  0.50 kB
dist/assets/index-DNSKAqie.css   19.66 kB │ gzip:  3.93 kB
dist/assets/index-bq_sPem8.js   211.07 kB │ gzip: 65.90 kB
✓ built in 234ms
```

### lint（npm run lint）

```
（出力なし: 0件）
```

---

## 2. Step 7 実装チェックリスト（ホーム画面再構成）

- [x] 中央寄せヒーロー廃止 → 「帳面を開く」レイアウト（上から縦積み）
- [x] タイトル「麻雀清算」（明朝28px・墨）+ 下に強罫線 (`.home-title-rule`)
- [x] サブタイトル「半荘ごとの収支を自動で計算」を削除
- [x] 麻タイルを48px程度に格下げ（タイトル横に添えるのみ）
- [x] 進行中ゲームがあれば「前回の卓」シート（`.sheet` 規格）: プレイヤー名4人・局数・収支幅表示
- [x] 局数・収支幅を `calcHanchan` / `sumResults` / `validateScores` の呼び出しで算出（ロジック新設なし）
- [x] 「つづきを開く」ボタン（インラインSVGチェブロン）
- [x] primary ボタン文言「卓を立てる」（旧「新しいゲームを始める」）
- [x] 清算画面「新しいゲームを始める」→「新しい卓へ」
- [x] `.btn-back` の「←」をインラインSVGチェブロンに置換（setup-screen）

---

## 3. Step 8 実装チェックリスト（設定画面の重要度設計）

- [x] 必須2項目（プレイヤー名・レート）を画面上部に配置
- [x] 必須区画の見出しに強罫線 (`.setup-section-title-strong` → `--rule-strong`)
- [x] ルール詳細（ウマ・オカ・場代の分担方式）を「ルール詳細」副次グループにまとめ
- [x] 副次グループはインデント（左ボーダー）+ 弱罫線 (`.setup-rule-details`)
- [x] デフォルト展開のまま（折りたたみなし）
- [x] 区画間 gap: 必須 = `--space-5`、副次グループ内 = `--space-4`
- [x] オカのセグメントボタンを「あり / なし」のみに縮小
- [x] 補足「25000持ち30000返し」を `.setup-section-note`（13px ゴシック・`--text-secondary`）に分離
- [x] 「ゲーム開始」→「この設定ではじめる」

---

## 4. Step 9 実装チェックリスト（清算画面の伝票レイアウト＋内訳折りたたみ）

- [x] 送金1件を「伝票の1行」に: `.transfer-parties` + CSS引き線（インラインSVG）+ 金額主役
- [x] 生テキスト「→」の span を廃止 → SVG引き線（line + path）に置換
- [x] 金額（DM Mono・太字・28px）を右揃えで主役配置 (`.transfer-amount-row`)
- [x] 送金カードは不透明背景 `--bg-sheet`・金額 tabular-nums 維持
- [x] 「収支のうちわけ」を `<details>` 要素で折りたたみ（summary: 「うちわけを見る」、デフォルト閉）
- [x] summary のタッチターゲット 44px 以上（`min-height: 44px` 設定済み）
- [x] 「各自が店に払う額」は折りたたまずそのまま表示

---

## 5. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/components/home-screen.tsx` | Step 7: 帳面レイアウト全面再構成 |
| `src/components/setup-screen.tsx` | Step 7 (btn-back チェブロン) + Step 8 (重要度設計・文言変更) |
| `src/components/settlement-screen.tsx` | Step 7 (文言変更) + Step 9 (伝票レイアウト・details折りたたみ) |
| `src/App.css` | Step 7: ホーム画面CSS全面更新 / Step 8: 設定画面CSS追加 / Step 9: 清算画面CSS更新 |

---

## 6. 視覚検証

### メイン実施（2026-06-11、モバイル viewport 375×812、localhost:5174）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | ホーム: 帳面レイアウト | 中央ヒーロー廃止。「前回の卓」シートに名前4人・「1局 ／ +2,610 〜 -1,920」（局数・収支幅）表示 | PASS |
| 2 | ホーム: 文言・タイル | 「卓を立てる」「つづきを開く」。サブタイトル削除。麻タイル 48px | PASS |
| 3 | 戻るボタン | `.btn-back svg` = SVGチェブロン（「←」文字廃止） | PASS |
| 4 | 設定: 重要度設計 | セクション = プレイヤー名／レート／ルール詳細（.setup-rule-details グループ実在） | PASS |
| 5 | 設定: オカ説明分離 | ボタン「あり／なし」のみ、注記「25000持ち30000返し」が .setup-section-note に | PASS |
| 6 | 設定: CTA | 「この設定ではじめる」 | PASS |
| 7 | 清算: 伝票化 | transfer-item 内に SVG 引き線＋チェブロン（生テキスト「→」残存なし）。金額 .transfer-amount-hero = 28px / DM Mono / 700、シート背景は不透明 rgb(253,252,248) | PASS |
| 8 | 清算: 折りたたみ | details デフォルト閉、summary「うちわけを見る」高さ47px（≥44px） | PASS |
| 9 | 清算: ボタン | 「ゲームに戻る」「新しい卓へ」 | PASS |
| 10 | 回帰 | 送金 1,920/690/410円・店払い各500円が従来どおり。リロード復元OK | PASS |
| 11 | 横スクロール | 全画面で scrollWidth 375 = clientWidth | PASS |

スクリーンショット: preview_screenshot ツール障害のため未取得。審美確認はユーザーがブラウザで実施。
