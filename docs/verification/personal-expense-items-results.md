# 個人分の複数明細化＋清算内訳の最上部表示 検証結果

実施日: 2026-06-13 / 対応プラン: docs/plans/personal-expense-items-plan.md
検証環境: ローカル dev サーバー（実 Supabase 接続）、viewport 390×844（モバイル）

## 1. 静的検証

| # | 項目 | 結果 | 根拠 |
|---|------|------|------|
| 1 | `npm run test` | **PASS** | `Tests 53 passed (53)`（旧46＋sumPersonalExpenseItems 7件） |
| 2 | `npm run build` | **PASS** | `✓ built in 355ms`、型エラー0 |
| 3 | `npm run lint` | **PASS** | eslint 出力なし |
| 4 | 旧 `personalExpenses` の残存参照なし | **PASS** | grep 結果: 残存は settlement-screen のローカル変数（sumPersonalExpenseItems の結果）と calcNetBalances の引数名のみ。GameState 経由の旧参照ゼロ |

## 2. UI/E2E 検証（preview ツール実機観測）

| # | 項目 | 結果 | 観測根拠（一次情報） |
|---|------|------|---------------------|
| 1 | 0明細時は「＋ 個人分を追加」行のみ表示 | **PASS** | `.btn-add-personal` text=「＋ 個人分を追加」、個人分の金額 input は0個 |
| 2 | ＋クリックで明細追加（摘要＋金額の2行組） | **PASS** | クリック250ms後: 摘要 input（placeholder「摘要（例: 昼食代）」）、金額 input×4、×削除ボタン（aria-label='この個人分明細を削除'）を観測 |
| 3 | 2行組の背景色が既存の個人分行と同値 | **PASS** | computed style: `.score-table-personal-memo-row` background = rgba(236,231,217,0.5) |
| 4 | 清算画面: うちわけが最上部 | **PASS** | DOM順 details→transfers-card-hero（compareDocumentPosition で確認） |
| 5 | うちわけデフォルト展開＋開閉トグル | **PASS** | `details.open` 初期値 true、summary クリックで false→true 切替 |
| 6 | summary 文言 | **PASS** | 「うちわけ」（「うちわけを見る」から変更） |
| 7 | コンソールエラー（クリーン環境） | **PASS** | サーバー再起動後の一巡操作で、エラーは想定済みの保存失敗（personal_expenses カラム欠如）のみ。**Hooks 順序エラーは HMR アーティファクトと確定**（フルリロード後・新セッションでは再発せず） |

## 3. 保留解除後の最終E2E（2026-06-13、ユーザーが ALTER 2本実行後）

カラム追加を REST SELECT で確認: `[{"fee_payer_id":null,"personal_expenses":[]}]`（エラーなし）

| # | 項目 | 結果 | 観測根拠（一次情報） |
|---|------|------|---------------------|
| E1 | 明細追加→保存（ロールバックなし） | **PASS** | 摘要「昼食代」金額 1000/300 入力 → 2.5秒後も残存（itemSurvived: true） |
| E2 | フルリロード後の永続化（DB往復） | **PASS** | reload→再接続後 memoValue='昼食代', amounts=['1000','300','','']  |
| E3 | 立替者選択の保存 | **PASS** | プレイヤー1選択 → 2秒後も active 保持、fee-payer-error なし |
| E4 | 店への支払いカード | **PASS** | 「プレイヤー1さんが店に払う ¥3,300 場代 ¥2,000 ＋ 飲食 ¥1,300」 |
| E5 | 立替込み送金（手計算一致） | **PASS** | P4→P1 4,400円 / P3→P1 2,700円。手計算: 点10で麻雀収支 +5300/+800/−2200/−3900、場代均等500、個人分 P1:1000 P2:300 → 純収支 +7100/0/−2700/−4400（ゼロサム） |
| E6 | 他端末同期 | **PASS（アーキテクチャ）** | fee_payer_id / personal_expenses とも room_state テーブルの既存 Realtime 購読に乗る（Phase 3.1 実機E2Eで2クライアント同期検証済みのチャネルと同一） |

| 残課題 | 状態 |
|---|---|
| スクリーンショット | preview_screenshot のツール障害（30秒タイムアウト）で取得不可。テキストベース観測で代替、ユーザー目視確認を推奨 |

## 4. 特記事項

- 旧 `players.personal_yen` のデータは新形式に引き継がない（プラン承認済み・テストデータのみのため）
- debounce は個人分専用タイマー（`personalExpensesDebounceRef`）で、draft 用の既存タイマーとの相互打ち消しなし（コードレビューで確認）
