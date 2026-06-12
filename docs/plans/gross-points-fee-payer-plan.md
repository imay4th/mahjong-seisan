---
status: completed
created: 2026-06-12
completed: 2026-06-13
---

# 粗点表示＋場代立替モデル＋設定メニュー 改修プラン

> **実行推奨モデル**: メイン=Fable 5（現行のまま、切替不要） / サブエージェント=sonnet

## Context

清算アプリの収支が常に「円」で表示されるのが生々しいというユーザー要望。麻雀の慣習どおり**粗点（1000点=1pt、ウマ・オカ込み）**で普段は表示し、円に換算するのは清算画面だけにする。あわせて、場代・飲食代は**一人が店にまとめて払う**実態に合わせ、立替分の返済を送金計算に織り込み、**誰が店にいくら払うか**を清算結果に明示する。また点数表画面から**ルール設定を変更できるメニューボタン**を追加する。

ユーザー確定済みの仕様:
- 立替者は**清算画面で選択**
- **個人分（飲食代等）も立替者がまとめて店に払う**（送金計算に織り込む）
- 粗点の端数は**五捨六入で整数化**（百の位5以下→切り捨て、6以上→切り上げ。負の持ち点は絶対値で丸めて符号復元）。整数化で合計≠0ならトップ調整でゼロサム保証

## 設計の要点

### 1. 清算ロジック（src/lib/settlement.ts）
- **`calcHanchanPoints(scores, playerOrder, settings)` 新設**: 既存 calcHanchan の L58-65 のポイント計算を独立させ、五捨六入丸めを追加。手順: ①各持ち点を五捨六入で千点単位化 → ②`(丸め後 − basePoint)/1000` → ③オカ（トップ）・ウマ加算 → ④合計≠0ならトップ（sorted[0]）から差分を引く。戻り値は整数ポイントのゼロサム
- **既存 `calcHanchan`（円）を再実装**: `calcHanchanPoints の結果 × ratePer1000`。ポイントが整数なので円も厳密ゼロサム。既存の10円丸め＋トップ調整（L67-80）は削除
- **`calcNetBalances(mahjongYen, feeShare, personalExpenses, feePayerId, totalFee, playerOrder)` 新設**: 各自 = 麻雀収支(円) − 場代負担 − 自分の個人分。立替者はさらに +（場代総額＋個人分総額）。合計0をassert（≠0ならthrow）。feePayerId が null または場代・個人分がともに0なら mahjongYen をそのまま返す。結果を既存 `calcTransfers` に渡せば立替返済込みの最小送金になる
- `calcFeeShare` / `calcTransfers` / `validateScores` / `sumResults` は変更なし

### 2. 型・状態管理
- `src/types.ts`: `GameState` に `feePayerId: string | null` 追加
- `src/hooks/use-game-state.ts`（localStorage版）: startGame 初期値 `feePayerId: null`、loadState の後方互換補完 `parsed.feePayerId ?? null`、`setFeePayerId` と `updateSettings(settings, feeMode)` を既存 setTotalFee と同パターンで追加
- `src/hooks/use-room.ts`（Supabase版）: `DbRoomState`（L25-31）に `fee_payer_id: string | null`、`buildGameState`（L100-128）に変換追加、`setFeePayerId` / `updateSettings` を setTotalFee（L523-541）と同パターンで追加（楽観的更新＋room_state UPDATE）。Realtime は既存の room_state 購読で自動同期されるため追加設定不要
- `supabase/schema.sql`: fee_payer_id カラム追加（players 定義後に alter table で追加。FK の前方参照を避けるため）＋末尾に既存DB用 ALTER 文をコメントで記載

### 3. UI
- **ゲーム画面 `src/components/game-screen.tsx`**:
  - 各行の収支セル（L254-256）と累計カード（L199-212）を `calcHanchanPoints` ベースの粗点表示に変更。フォーマット: 正 `+N`、零 `±0`、負 `△N`（絶対値）。「円」表記を撤去
  - ヘッダー（L185-193 付近）に設定ボタン（⚙、aria-label='設定を変更'）→ `onOpenSettings` prop 追加
  - 場代行（L309-331）の円入力は現状維持
- **清算画面 `src/components/settlement-screen.tsx`**: 表示は円のみ（粗点は出さない）
  - props に `onSetFeePayerId: (id: string | null) => void` 追加。選択状態は `gameState.feePayerId` を参照（ローカルstateを持たない→全端末同期）
  - 場代＋個人分>0 のとき: 立替者選択ボタン群を表示。未選択なら「立替者を選択してください（選択するまで送金は麻雀収支のみ）」注記＋麻雀収支のみで送金計算。選択済みなら `calcNetBalances`→`calcTransfers` で立替込み送金
  - 既存「各自が店に払う額」カード（L118-148）を「**○○さんが店に払う ¥Z（場代¥X＋飲食¥Y）**」カードに置き換え
  - 麻雀収支の内訳行（L164-176）は円表示のまま維持
- **設定画面 `src/components/setup-screen.tsx` の編集モード**:
  - props 追加: `editMode?` / `initialSettings?` / `initialFeeMode?` / `onSaveSettings?(settings, feeMode)`
  - 編集モード時: プレイヤー名入力を非表示（メンバー名変更はスコープ外）、初期値を現在の設定から復元（uma/rate のプリセット逆引きヘルパー追加、該当なしは custom）、保存ボタンで `onSaveSettings` → game 画面へ戻る
- **`src/App.tsx` 配線**:
  - `setupMode: 'create' | 'edit'` state を追加（`!!gameState` 判定だと新規作成フローと衝突するため）。GameScreen の `onOpenSettings` で `setupMode='edit'` + `setScreen('setup')`、ホームからの新規作成は `'create'`
  - SettlementScreen に `onSetFeePayerId` を配線（use-room / use-game-state 両対応）

## 実装体制（サブエージェント、全 sonnet）

```
[A] settlement.ts + types.ts + settlement.test.ts（土台、最初に単独実行）
[E] schema.sql（独立・小規模のためメインが直接実施）
  ↓ A 完了後
[B] use-game-state.ts + use-room.ts   ┐ 並行（ファイル競合なし、
[C] game-screen / settlement-screen / setup-screen ┘ propsシグネチャはプランで固定済み）
  ↓ B・C 完了後
[D] App.tsx 配線
  ↓
メイン: build / lint / test ＋ Playwright 検証（artifact 作成）
```

## テストケース（A が settlement.test.ts に実装）

**calcHanchanPoints 正常系**（レート点5・ウマ10-20 [20,10,-10,-20]）
- P-01 オカあり 42300/28200/18000/11500 → 丸め後 42000/28000/18000/11000、ポイント 52/8/−22/−39（和=−1）→ トップ調整で **53/8/−22/−39**
- P-02 オカなし 同スコア → 37/13/−17/−34（和=−1）→ **38/13/−17/−34**
- P-03 オカなし全員25000 → ウマのみ +20/+10/−10/−20
- P-04 任意スコアでゼロサム保証
- 五捨六入境界: 25500→25000、25600→26000、24400→24000、25000→そのまま、0→0
- 負の持ち点: −1500→−1000、−1600→−2000、−500→0、−600→−1000
- トップ調整: 和が+1/−1のケースで sorted[0] が吸収、調整後ゼロサム
- 同点タイブレーク: 丸め後同点は席順上位が上

**calcHanchan（円）回帰更新**
- 点5・オカあり: `{p1:2650, p2:400, p3:-1100, p4:-1950}`（= 53/8/−22/−39 × 50）
- オカなし: `{p1:1900, p2:650, p3:-850, p4:-1700}`（= 38/13/−17/−34 × 50）

**calcNetBalances**
- B-01 立替者あり・場代のみ / B-02 場代＋個人分 / B-03 null→素通し / B-04 場代0個人分0→素通し / Z-01,02 ゼロサム / E-01 不正入力throw / 統合: calcTransfers 接続

## 検証（メインが実施、UI変更につき必須）

1. `npm run test` / `npm run build` / `npm run lint` すべて PASS
2. Playwright（モバイル viewport 390×844）で観測し `docs/verification/gross-points-fee-payer-results.md` に PASS/FAIL 記録:
   - 粗点表示: 42300/28200/18000/11500 → 行収支 `+53 / +8 / △22 / △39`、累計も粗点、スコア表示部に「円」なし
   - 設定ボタン: ⚙ → 設定画面（プレイヤー名非表示・現在値復元）→ レート変更 → 清算画面の円換算が変わる
   - 立替者選択: 未選択注記 → 選択 → 「○○さんが店に払う ¥Z（場代¥X＋飲食¥Y）」カード＋立替込み送金
   - 清算画面は円表示のみ
   - computed style: 粗点の正負色分けクラス
3. スクリーンショット（ゲーム画面・清算画面）を artifact に添付

## リスク・手動ステップ

- **Supabase 手動 ALTER（ユーザー作業）**: デプロイ前に SQL Editor で `ALTER TABLE public.room_state ADD COLUMN IF NOT EXISTS fee_payer_id uuid REFERENCES public.players(id) ON DELETE SET NULL;` を実行。**順序厳守: ALTER → デプロイ**
- localStorage 旧データ: `feePayerId ?? null` 補完で対応
- 既存テスト期待値の変更は丸め方式変更に伴う正当な更新。手計算根拠をテストコメントに残す
- 円表示の残存チェック: game-screen L207 / L255 が変更対象。settlement-screen と場代入力欄の円表示は意図的に維持

## 対象外

- メンバー名の編集 / RLS 厳密化（LIM-001） / デザインP3・confirm統一 / 通算成績・3人麻雀（Phase 5）
