# P2 ライトテーマ化 検証結果（Step 5・6）

実施日: 2026-06-11
担当: Claude Code (claude-sonnet-4-6)

---

## テスト結果

```
> mahjong-settlement@0.0.0 test
> vitest --run

 RUN  v4.1.8 C:/dev/20260611_麻雀清算計算

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  22:26:33
   Duration  355ms (transform 73ms, setup 0ms, import 104ms, tests 16ms, environment 0ms)
```

## ビルド結果

```
> mahjong-settlement@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
✓ 23 modules transformed.
dist/index.html                   0.86 kB │ gzip:  0.50 kB
dist/assets/index-D8bkO4xH.css   17.33 kB │ gzip:  3.48 kB
dist/assets/index-CuZhl8h5.js   208.93 kB │ gzip: 65.31 kB
✓ built in 192ms
```

## lint 結果

```
> mahjong-settlement@0.0.0 lint
> eslint .

（0件）
```

---

## 実装チェックリスト

### カラートークン置換
- [x] `--bg-app: #f3efe5` 適用（body.background-color = rgb(243,239,229) 確認）
- [x] `--bg-sheet: #fdfcf8` 適用（mahjong-tile.background-color = rgb(253,252,248) 確認）
- [x] `--text-primary: #2f2c25` 適用（body.color = rgb(47,44,37) 確認）
- [x] `--accent: #1d5c45` / `--accent-fee: #8a6d2a` 追加
- [x] `--rule` / `--rule-strong` トークン追加
- [x] `background-attachment: fixed` グラデーション廃止 → ソリッド `--bg-app`
- [x] `--text-gold` / `--bg-gradient` / `linear-gradient` 残存ゼロ（grep確認）

### Step 5: 寸法トークン
- [x] `--radius-card: 4px` / `--radius-control: 8px` 定義・適用
- [x] `--space-1..5: 4/8/12/16/24px` 定義・適用
- [x] `.sheet` 共通クラス定義（bg-sheet、罫線1px、radius-card、影1px/2px）
- [x] `.card` / `.cumulative-card` / `.result-card` / `.fee-card` / `.transfers-card` を .sheet 同一値に統合
- [x] `.cumulative-item` の card-in-card 背景塗りを廃止 → 罫線区切りグリッドへ

### Step 6: セクション見出しの罫線化
- [x] `.setup-section-title` — 明朝15px/700/text-primary/border-bottom:rule
- [x] `.cumulative-title` — 明朝15px/700/text-primary/border-bottom:rule
- [x] `.list-title` — 明朝15px/700/text-primary/border-bottom:rule
- [x] `.result-card-title` — 明朝15px/700/text-primary/border-bottom:rule
- [x] `.transfers-title` — 明朝15px/700/text-primary/border-bottom:rule
- [x] `.fee-card-title` — 明朝15px/700/accent-fee/border-bottom:rule（店に払う額のみ茶金）
- [x] `letter-spacing: 0.08em` 量産指定を全削除

### 麻タイル
- [x] 白牌（bg-sheet地・墨文字・罫線枠・落ち影1層）に変更
- [x] グラデーション廃止（linear-gradient を単色 var(--bg-sheet) に置換）

### index.html
- [x] `<meta name="theme-color" content="#f3efe5">` 追加

### 点数表
- [x] 表罫線 → `--rule`、ヘッダ行 → `--rule-strong`
- [x] セル input → 白地・墨字
- [x] 場代・個人分行の薄い生成り背景（bg-segment 50%程度）で半荘行と区別

---

## カラートークン対応表（旧 → 新）

| 旧変数 | 旧値 | 新変数 | 新値 |
|--------|------|--------|------|
| `--bg-app` | `#0a2e23` | `--bg-app` | `#f3efe5` |
| `--bg-gradient` | `linear-gradient(...)` | （廃止） | ソリッド `--bg-app` |
| `--bg-card` | `#0f3b2c` | `--bg-sheet` / `--bg-card` | `#fdfcf8` |
| `--bg-segment` | `rgba(0,0,0,0.3)` | `--bg-segment` | `#ece7d9` |
| `--bg-segment-active` | `#c9a45c` | `--bg-segment-active` | `var(--accent)` = `#1d5c45` |
| `--text-primary` | `#f0ece2` | `--text-primary` | `#2f2c25` |
| `--text-secondary` | `#a8b8a4` | `--text-secondary` | `#75705f` |
| `--text-gold` | `#c9a45c` | （廃止） | `--accent` / `--accent-fee` に分割 |
| `--text-plus` | `#c9a45c`（金） | `--text-plus` | `#1d6b4e`（深緑） |
| `--text-minus` | `#e05555` | `--text-minus` | `#b3402f`（朱） |
| `--btn-primary-bg` | `#c9a45c` | `--btn-primary-bg` | `var(--accent)` = `#1d5c45` |
| `--btn-danger-bg` | `rgba(224,85,85,0.2)` | `--btn-danger-bg` | `rgba(179,64,47,0.10)` |
| `--border` | `rgba(201,164,92,0.2)` | `--border` / `--rule` | `rgba(47,44,37,0.18)` |

新規追加トークン: `--bg-sheet`, `--accent`, `--accent-contrast`, `--accent-fee`, `--rule`, `--rule-strong`, `--radius-card`, `--radius-control`, `--space-1..5`

---

### メイン実施（2026-06-11、モバイル viewport 375×812）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | 画面地が白基調 | body background = rgb(243,239,229) = #f3efe5（生成りの紙） | PASS |
| 2 | 墨文字コントラスト | text-primary vs 画面地 = 12.13:1（WCAG AA 4.5:1 を大幅クリア） | PASS |
| 3 | 朱/緑の収支色 | プラス rgb(29,107,78) = #1d6b4e（深緑）／マイナス rgb(179,64,47) = #b3402f（朱） | PASS |
| 4 | 旧テーマ残存 | `grep -rn "text-gold" src/` = 0件（メインでも独立実行） | PASS |
| 5 | データ保持 | テーマ変更後もリロード→「つづきを開く」で全データ復元 | PASS |
| 6 | 横スクロール | scrollWidth 375 = clientWidth | PASS |
