# Phase 3 Supabase 実装 検証結果

実施日: 2026-06-11

## 検証結果（3項目）

### 1. npm test -- --run

```
 RUN  v4.1.8 C:/dev/20260611_麻雀清算計算

 Test Files  1 passed (1)
      Tests  30 passed (30)
   Start at  22:53:05
   Duration  407ms (transform 87ms, setup 0ms, import 119ms, tests 22ms, environment 0ms)
```

**結果: PASS（30件）**

### 2. npm run build

```
vite v8.0.16 building client environment for production...
✓ 66 modules transformed.
dist/index.html                   0.86 kB │ gzip:   0.50 kB
dist/assets/index-CAgBp6NL.css   21.07 kB │ gzip:   4.18 kB
dist/assets/index-5_AP5ZX9.js   419.04 kB │ gzip: 118.87 kB
✓ built in 273ms
```

**結果: 成功（環境変数なしでもビルド通過）**

### 3. npm run lint

```
（出力なし）Exit code 0
```

**結果: 0件エラー**

---

## 実装チェックリスト

- [x] `supabase/schema.sql` 作成（RLS強化版・RPC2本・Realtime設定付き）
- [x] `npm install @supabase/supabase-js` 実行済み
- [x] `src/lib/supabase.ts` 作成（未設定時は null・`isSupabaseConfigured()` エクスポート）
- [x] `.env.example` 作成（2変数テンプレート・取得場所コメント付き）
- [x] `.gitignore` に `*.local` 含まれる確認済み（Vite テンプレートデフォルト）
- [x] `src/hooks/use-room.ts` 作成（UseRoom インターフェース準拠）
  - [x] createRoom / joinRoom（RPC経由）
  - [x] addHanchan / updateHanchan / removeHanchan（楽観的更新 → DB書込）
  - [x] setTotalFee / setPersonalExpense（楽観的更新 → DB書込）
  - [x] setDraft（ローカルのみ、DB同期しない）
  - [x] leaveRoom（localStorage消去 → ホームへ）
  - [x] Realtimeリアルタイム購読（3テーブル・300ms debounce・room_id=eq.{roomId}フィルタ）
  - [x] 初期化時にlocalStorageから再接続
  - [x] removeChannel クリーンアップ
  - [x] DBエラー時は status='error' + 日本語 errorMessage
- [x] `src/App.tsx`: useGameState → useRoom 置換・createRoom待機中ボタン無効化
- [x] `src/components/home-screen.tsx`: roomInfo ベースの「前回の卓」・「合言葉で入る」セクション追加
- [x] `src/components/setup-screen.tsx`: isCreating/createError props 追加・ボタン disabled 対応
- [x] `src/components/game-screen.tsx`: 合言葉常時表示（右上・明朝・選択コピー可）・「卓を抜ける」ボタン追加
- [x] `src/index.css`: 新規スタイル追加（警告・合言葉入力・合言葉表示・卓を抜けるボタン）
- [x] TypeScript 厳密型（any 禁止・Supabase 応答型を定義）

---

## 作成・変更ファイル一覧

### 新規作成
- `supabase/schema.sql` — DBスキーマ（SQL Editorに貼り付けて実行）
- `.env.example` — 環境変数テンプレート
- `src/lib/supabase.ts` — Supabase クライアント
- `src/hooks/use-room.ts` — Supabase 連携フック（本体）

### 変更
- `src/App.tsx` — useGameState → useRoom に置換
- `src/components/home-screen.tsx` — roomInfo ベース + 合言葉入力追加
- `src/components/setup-screen.tsx` — isCreating/createError props 追加・onStart シグネチャ変更
- `src/components/game-screen.tsx` — inviteCode/onLeaveRoom props 追加・UI追加
- `src/index.css` — 新規スタイル追加
- `package.json` / `package-lock.json` — @supabase/supabase-js 追加

### 変更なし（指示通り）
- `src/lib/settlement.ts`
- `src/hooks/settlement.test.ts`
- `scaffold-tmp/`

---

## 実機 E2E

### メイン実施（2026-06-11、実プロジェクト ddgnazaangjpeojbhtox 接続、モバイル viewport 375×812）

| # | 検証項目 | 観測結果 | 判定 |
|---|---------|---------|------|
| 1 | 環境変数ガード解除 | .env.local 設定＋サーバー再起動で警告消滅・ボタン有効化（※ユーザー入力のURLに `/rest/v1/` が付いていたため修正した） | PASS |
| 2 | 卓の作成（RPC create_room） | 合言葉 ZE7T68 発行、ゲーム画面ヘッダに表示、localStorage に roomId/inviteCode 保存 | PASS |
| 3 | 半荘入力 → DB保存 | UI入力した第1局が REST GET（別クライアント＝curl）で取得できた（scores 4人分一致） | PASS |
| 4 | リアルタイム同期: room_state | curl PATCH で total_fee=3000 → **リロードなしで**画面の場代入力が 3000 に更新 | PASS |
| 5 | リアルタイム同期: hanchans | curl POST で第2局（30000×3＋10000）挿入 → **リロードなしで**第2局行が出現、収支 +2,000/+500/−500/−2,000・累計 +4,610/+910/−1,600/−3,920 と正確 | PASS |
| 6 | リロード再接続 | ホームに「前回の卓」（DB由来: 2局 ／ +4,610 〜 -3,920 ／ 合言葉）表示 → つづきを開くで全データ復元 | PASS |
| 7 | 卓を抜ける | localStorage クリア・ホームへ・前回の卓カード消滅 | PASS |
| 8 | 合言葉参加 | 小文字「ze7t68」で入力 → upper/trim 照合が機能し参加成功、全データ表示・localStorage 保存 | PASS |

### 検証中の発見（軽微・別途対応）
- 「卓を抜ける」が native `confirm()` を使用しており、ヘッドレス検証をブロックした（実機では問題なし）。半荘削除はカスタムダイアログのため不統一 → P3 で統一を推奨
- rooms テーブルは anon に削除権がないため、不要になったルームをユーザーが消す手段がない（テストルーム ZE7T68 が残存。実害なし）→ 将来 expires_at による失効 or 管理削除を検討

### 実施手順（接続後）
1. Supabase ダッシュボードで新規プロジェクト作成
2. SQL Editor に `supabase/schema.sql` を貼り付け実行
3. `.env.local` を作成し `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定
4. `npm run dev` で起動
5. 「卓を立てる」→ 設定画面で「この設定ではじめる」→ 合言葉が表示されることを確認
6. 別デバイスで合言葉を入力 → ゲーム画面が同期されることを確認
