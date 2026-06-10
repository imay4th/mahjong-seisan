# Phase 2 UI実装 — 検証結果

実施日: 2026-06-11

---

## 完了条件チェック

### npm test -- --run

```
 RUN  v4.1.8 C:/dev/20260611_麻雀清算計算

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  01:16:10
   Duration  341ms (transform 61ms, setup 0ms, import 89ms, tests 16ms, environment 0ms)
```

**結果: PASS（30件 / 30件）**

---

### npm run build

```
> mahjong-settlement@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
✓ 24 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.31 kB
dist/assets/index-BmD1oKbr.css   12.54 kB │ gzip:  2.76 kB
dist/assets/index-Dxr4lOdw.js   206.61 kB │ gzip: 64.73 kB

✓ built in 156ms
```

**結果: PASS**

---

### npm run lint

```
> mahjong-settlement@0.0.0 lint
> eslint .
（出力なし = エラー0件）
```

**結果: PASS（エラー0件）**

---

## 実装ファイル一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `src/hooks/use-game-state.ts` | GameState管理フック（localStorage永続化） |
| `src/components/home-screen.tsx` | ホーム画面（新規/再開） |
| `src/components/setup-screen.tsx` | 設定画面（プレイヤー・ルール・場代） |
| `src/components/hanchan-form.tsx` | 持ち点入力フォーム（自動補完機能付き） |
| `src/components/game-screen.tsx` | ゲーム画面（累計収支・半荘履歴・削除確認） |
| `src/components/settlement-screen.tsx` | 清算画面（送金指示・場代別枠表示） |

### 全面書き換え

| ファイル | 変更内容 |
|---|---|
| `src/App.tsx` | 画面切替ルーティング（Screen状態管理） |
| `src/App.css` | コンポーネント固有スタイル（麻雀卓風ダーク） |
| `src/index.css` | グローバルスタイル・CSS変数定義 |

### 部分変更

| ファイル | 変更内容 |
|---|---|
| `src/types.ts` | `Screen`型・`GameState`型を末尾に追記 |
| `index.html` | `lang="ja"`、title `"麻雀清算"` に変更 |

---

## 画面構成

1. **ホーム画面** — アプリタイトル + 新規開始ボタン、localStorage進行中ゲームがある場合は再開ボタンも表示
2. **設定画面** — プレイヤー名4人入力、レート（点5/点10/カスタム）、ウマ（4プリセット）、オカトグル、場代金額＋分担方式
3. **ゲーム画面** — 累計収支カード（プラス金色/マイナス赤）、半荘履歴リスト（削除確認ダイアログ付き）、持ち点入力フォーム（3人入力後に残り1人自動補完ボタン表示、リアルタイム合計表示）
4. **清算画面** — 収支内訳表（麻雀収支・場代負担・最終収支）、場代別枠（各自が店に払う額）、送金指示（大きく表示）

---

## 視覚検証（メイン実施、2026-06-11、モバイル viewport 375×812）

dev サーバー（localhost:5173）に対し Claude Preview で操作フロー検証と computed style 観測を実施。

### 操作フロー検証（E2E、eval によるDOM観測）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | ホーム画面表示（タイトル・新規開始ボタン・深緑背景） | h1「麻雀清算」、背景 `linear-gradient(160deg, rgb(10,46,35) ...)` = 仕様 #0a2e23 | PASS |
| 2 | 設定画面遷移・入力（4人名前、レート点5、ウマ10-20、場代2000円） | 全項目入力可、場代 input は `inputmode=numeric` | PASS |
| 3 | ゲーム開始 → localStorage 保存 | `mahjong-settlement-v1` に settings 含め正しく保存（ratePer1000:50, uma:[20,10,-10,-20], oka:true） | PASS |
| 4 | 半荘入力（42300/28200/18000/11500）リアルタイム合計表示 | 「合計: 100,000/100,000点」表示 | PASS |
| 5 | 半荘追加 → 累計収支 | +2,610／+410／−1,100／−1,920 円 = **手計算期待値と完全一致** | PASS |
| 6 | 清算画面（内訳・場代別枠・送金指示） | 最終収支 +2,110/−90/−1,600/−2,420。場代各500円（合計2,000円）別枠表示。送金指示3件（北野→東山1,920／西村→東山690／西村→南田410）= n−1 回 | PASS |
| 7 | リロード → データ復元（必須要件: 複数半荘データの安全保持） | ホームに「続きから再開 前回: 東山・南田・西村・北野」表示、再開で全データ復元 | PASS |

### computed style 観測

| プロパティ | 観測値 | 期待 | 判定 |
|-----------|-------|------|------|
| プラス収支の color | rgb(201, 164, 92) | 金色 #c9a45c | PASS |
| マイナス収支の color | rgb(224, 85, 85) | 赤系 | PASS |
| 収支数字の font-variant-numeric | tabular-nums | 等幅数字 | PASS |
| 主要ボタンの高さ | 46px | ≥44px（タッチターゲット） | PASS |

### スクリーンショット

**未取得（残課題）**: preview_screenshot がツール側のタイムアウトで失敗、Claude in Chrome も未接続のため画像 artifact を残せなかった。機能・スタイルは上記の通り決定論的に PASS だが、**見た目の審美的確認はユーザーがブラウザで実施すること**（`npm run dev` → http://localhost:5173）。
