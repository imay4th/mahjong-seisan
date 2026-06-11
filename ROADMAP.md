# 麻雀清算計算アプリ 開発ロードマップ

最終更新: 2026-06-11

## ⚠️ 進捗管理ルール

**各タスク完了時に必ず以下を更新すること:**
1. タスクのステータスを ✅ に変更
2. 「進捗ログ」セクションに日付・完了内容・発見した問題を記録
3. 「次のTodo」セクションを更新
4. 新たなバグを発見した場合は REQUIREMENTS.md の「既知の問題」に追記

**セッション開始時に必ず以下を確認すること:**
1. このファイルの「進捗ログ」で前回どこまで完了したか確認
2. 「次のTodo」セクションで今回着手すべきタスクを確認
3. REQUIREMENTS.md の「既知の問題」で未修正バグを確認

**アーカイブルール（dev2-save時に自動提案）:**
- ROADMAP.md が150行を超えた場合、完了済みPhaseと古い進捗ログのアーカイブを提案する
- 完了Phase → ROADMAP_ARCHIVE.md に移動（1行サマリーを残す）
- 進捗ログ → 最新5件を保持、それ以前は ROADMAP_ARCHIVE.md に移動する

---

## Phase 0: 初期セットアップ

### 0.1 プロジェクト雛形作成 [S] — ✅ 完了 (2026-06-11)
- Vite + React + TypeScript の雛形を一時ディレクトリで作成→本ディレクトリへ展開
- git init、初回コミット、Vitest 導入

### 0.2 Supabase 制約確認＋テーブル設計 [M] — ✅ 完了 (2026-06-11)
- 設計ドキュメント: `docs/design/supabase-design.md`（無料枠OK、UUID＋招待コードRPC方式）
- 残課題: Phase 3 実装時に RLS の SELECT 絞り込みを厳密化（doc 内 ⚠️ 参照）

---

## Phase 1: 清算計算コア（純粋関数＋テスト）

### 1.1 点数→収支計算 [M] — ✅ 完了 (2026-06-11)
- `src/lib/settlement.ts`（レート・ウマ・オカ、同点は席順タイブレーク、ゼロサム保証）

### 1.2 場代分担＋最小送金清算 [M] — ✅ 完了 (2026-06-11)
- 場代3方式（均等／負け額比例／最下位負担）、貪欲法による最小送金（最大 n−1 回）
- 検証: docs/verification/phase1-settlement-results.md（テスト 30/30 PASS）

---

## Phase 2: UI（モバイルファースト）

### 2.1 画面実装 [L] — ✅ 完了 (2026-06-11) ※見た目のユーザー確認のみ残
- ホーム／設定／ゲーム（半荘入力・履歴・累計）／清算の4画面、localStorage 永続化
- 検証: docs/verification/phase2-ui-results.md（E2Eフロー7項目・style4項目 PASS、スクリーンショットのみツール障害で未取得）

---

## Phase 3: リアルタイム共有

### 3.1 Supabase 連携 [L] — 🔶 実装済み・実機E2E待ち (2026-06-11)
- コード実装完了: supabase/schema.sql（RPC方式・rooms遮断）、use-room フック（楽観的更新＋Realtime refetch）、合言葉UI
- 残: ユーザーの Supabase プロジェクト作成 → .env.local 設定 → メインが実機E2E（2クライアント同期・再接続）

---

## Phase 4: 公開

### 4.1 Vercel デプロイ＋実機確認 [S] — ⬜ 未着手
- 依存: 3.1
- GitHub リポジトリ作成→Vercel 連携→公開URL発行→スマホ実機で動作確認

---

## Phase 5: MVP後（将来構想）

### 5.1 メンバー別の通算成績集計 [L] — ⬜ 未着手
### 5.2 3人麻雀対応 [M] — ⬜ 未着手

---

## 依存関係グラフ

```
Phase 0:  0.1 | 0.2 (並行可)
Phase 1:  0.1 → 1.1 → 1.2
Phase 2:  1.2 → 2.1
Phase 3:  (0.2, 2.1) → 3.1
Phase 4:  3.1 → 4.1
```

## 時間不足の場合の削減順序

1. Phase 3（リアルタイム共有）を後回し → localStorage 版（1台のスマホ運用）でも清算機能は完結するため
2. 場代分担の方式を「均等割り」のみに縮小 → 最も使用頻度が高い方式から先に

---

## 進捗ログ

> **このセクションは各タスク完了時に追記すること**

| 日付 | 完了タスク | メモ・発見した問題 |
|------|-----------|-------------------|
| 2026-06-11 | — | ヒアリング完了、開発計画策定（ROADMAP / REQUIREMENTS 作成） |
| 2026-06-11 | 0.1 | Vite+React+TS 雛形作成、Vitest導入、build/lint PASS。残課題: `scaffold-tmp/` フォルダの手動削除（rm が権限拒否のため残置、gitignore・eslint ignore 済み） |
| 2026-06-11 | 0.2 | Supabase 制約確認＋テーブル設計（docs/design/supabase-design.md）。無料枠OK。注意: 7日無操作で自動pause |
| 2026-06-11 | 1.1, 1.2 | 清算計算コア実装＋テスト30件 PASS（サブ委譲→メイン独立検証済み）。円換算は10円単位丸め＋1位調整でゼロサム保証 |
| 2026-06-11 | 2.1 | UI4画面実装（麻雀卓風ダーク）。E2Eフロー・計算値・localStorage復元すべてPASS。残: スクリーンショット未取得（preview_screenshotタイムアウト障害）→ユーザーの目視確認待ち |
| 2026-06-11 | 2.2 | ユーザー要望で点数表方式に改修（スコアシート入力・4人目タップ自動入力・場代行・個人分行）。E2E 10項目 PASS（docs/verification/phase2-2-score-table-results.md） |
| 2026-06-11 | 2.3 | AIっぽさ監査34件（独立3レビュアー）→改修計画策定（docs/design/ai-slop-*.md）→P1実装（フォント3種導入・金色格下げ・コピー修正・清算ヒーロー化）。検証11項目 PASS（docs/verification/p1-deai-results.md） |
| 2026-06-11 | 2.4 | P2実装＋ユーザー指示で白基調（紙の精算表）テーマへ全面変更。Step5-6=トークン体系/見出し罫線化（p2-light-theme-results.md 6項目PASS）、Step7-9=ホーム帳面化/設定重要度/清算伝票化＋折りたたみ（p2-structure-results.md 11項目PASS）。P3（Step10: インタラクション/エラー表示）は未実装 |
| 2026-06-11 | 3.1(実装) | Supabase連携コード実装（schema.sql・use-roomフック・合言葉UI・未設定時ガード）。build/lint/test PASS（phase3-supabase-results.md）。実機E2Eはユーザーのプロジェクト作成待ち |

---

## 次のTodo

> **このセクションはセッション終了時に更新すること。次回セッション開始時にここから再開。**

- [ ] （手動）Supabase プロジェクト作成 → supabase/schema.sql 実行 → .env.local 設定（手順はセッションログ参照）
- [ ] Phase 3.1 実機E2E（2クライアント同期・再接続・合言葉参加）
- [ ] Phase 4.1: GitHub リポジトリ作成 → Vercel デプロイ（環境変数設定込み）
- [ ] デザイン改修 P3（計画 Step 10）— 任意
- [ ] （手動）`scaffold-tmp/` フォルダをエクスプローラーで削除（未対応なら）
- [ ] Phase 3.1: Supabase 連携（リアルタイム共有）— ユーザーの Supabase プロジェクト作成が必要
- [ ] （手動）`scaffold-tmp/` フォルダをエクスプローラーで削除

---

## 検証方法

各フェーズ完了時に:
1. ビルド成功確認（`npm run build`）
2. リントエラーなし確認（`npm run lint`）
3. UI/挙動変更を含む場合は Playwright screenshot＋computed style 観測を `docs/verification/` に記録（モバイル viewport 必須）
