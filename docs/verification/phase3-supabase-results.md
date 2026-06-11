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

実機 E2E（Supabase プロジェクト接続後）: メインにて実施予定

### 実施手順（接続後）
1. Supabase ダッシュボードで新規プロジェクト作成
2. SQL Editor に `supabase/schema.sql` を貼り付け実行
3. `.env.local` を作成し `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定
4. `npm run dev` で起動
5. 「卓を立てる」→ 設定画面で「この設定ではじめる」→ 合言葉が表示されることを確認
6. 別デバイスで合言葉を入力 → ゲーム画面が同期されることを確認
