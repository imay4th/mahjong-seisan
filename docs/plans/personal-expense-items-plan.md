---
status: completed
created: 2026-06-13
completed: 2026-06-13
---

# 個人分の複数明細化＋清算内訳の最上部表示 改修プラン

> **実行推奨モデル**: メイン=Fable 5（現行のまま、切替不要） / サブエージェント=sonnet

## Context

前回の粗点・場代立替改修に続くユーザー追加要望。①点数表の「個人分」が現在プレイヤーごとに1金額しか入れられないため、＋ボタンで明細行を複数追加でき、各明細に摘要メモ（例「昼食代」）を付けられるようにする。②清算画面の「うちわけ」を最上部に移動し、デフォルトで展開表示する。

## 設計の要点

### データ構造（src/types.ts）
```ts
export interface PersonalExpenseItem {
  id: string;                       // crypto.randomUUID()
  memo: string;                     // 摘要（例: 昼食代）
  amounts: Record<string, number>;  // playerId → 円
}
```
- `GameState.personalExpenses: Record<string, number>` を**削除**し `personalExpenseItems: PersonalExpenseItem[]` に置換（リネームで全使用箇所を型エラー検出）

### 集計ヘルパー（src/lib/settlement.ts）
- `sumPersonalExpenseItems(items, playerOrder): Record<string, number>` を新設（明細→プレイヤー別合計、欠損プレイヤーは0、playerOrder外キーは無視）
- `calcNetBalances` のシグネチャは**変更しない**（既存テストも無影響）

### Supabase（supabase/schema.sql + src/hooks/use-room.ts）
- `room_state` に `personal_expenses jsonb not null default '[]'::jsonb` を追加（create table 本文＋手動マイグレーションコメントに ALTER 追記）
- `players.personal_yen` は使用停止（カラム残置、deprecated コメント。旧データは引き継がない）
- use-room.ts: `DbRoomState.personal_expenses` 追加、`buildGameState` でランタイム型ガード（不正要素 filter 除外）
- `setPersonalExpense` 廃止 → `setPersonalExpenseItems(items)`: 楽観的更新は即時、DB UPDATE は 400ms debounce（**専用 ref を新設、既存 debounceRef と共用禁止**）。エラー時 refetchAll ロールバック
- 許容リスク: debounce 中の Realtime refetch で入力中の摘要が巻き戻る可能性（MVP許容）

### ゲーム画面UI（src/components/game-screen.tsx）
- 個人分行を**1明細=2行組**に置換: 行1=ラベル「個人分」＋摘要 text input（colSpan=4、placeholder「摘要（例: 昼食代）」）＋×削除ボタン／行2=金額 input×4
- 直後に「＋ 個人分を追加」行（colSpan 全列）。0明細時は＋行のみ
- key 付き Fragment（`import { Fragment } from 'react'`）

### 清算画面（src/components/settlement-screen.tsx）
- `const personalExpenses = sumPersonalExpenseItems(personalExpenseItems, playerOrder);` で以降の参照を無変更化
- うちわけ `<details>` を精算ヒーローの**前**に移動し `open` 付与。summary を「うちわけ」に変更
- 個人分行はプレイヤー別合計表示のまま

### その他
- App.tsx 配線変更 / use-game-state.ts コンパイル整合 / App.css スタイル追加

## テストケース

`describe('sumPersonalExpenseItems')`: S-01 複数明細合算 / S-02 空配列 / S-03 amounts欠損 / S-04 全員0 / S-05 playerOrder 1人 / S-06 playerOrder外キー無視 / S-07 calcNetBalances 統合（ゼロサム）。既存46テスト無影響。

## 実装体制

- サブ1体（sonnet）が全コード変更（リネーム波及のため分割不可）。メイン: 独立検収＋preview UI検証＋docs更新

## 検証（メイン）

1. test / build / lint 全PASS
2. preview（390×844）: 明細追加→摘要・金額入力→2明細目→×削除→0明細で＋行のみ／清算画面への飲食合計反映／うちわけ最上部・デフォルト展開・開閉動作／コンソールエラーなし
3. `docs/verification/personal-expense-items-results.md` に記録

## リスク・手動ステップ

- **Supabase 手動 ALTER 2本**（fee_payer_id 未実行分＋personal_expenses。IF NOT EXISTS 付き冪等。順序: ALTER → デプロイ）
- ALTER 未実行の間は個人分の保存が失敗しロールバック（console.error のみ）
- 旧 personal_yen データは引き継がない

## 対象外

- 明細別の内訳表示 / メンバー名編集 / 過去データ移行 / use-game-state の App 配線復活
