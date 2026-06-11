# 麻雀清算

麻雀の点数・場代・個人費用から「誰が誰にいくら払うか」を最小の送金回数で計算するWebアプリ。
合言葉（6文字のルームコード）を共有すると、全員のスマホで同じ点数表をリアルタイムに見られます。

## 機能

- 点数表（スコアシート）方式の持ち点入力。3人入力すれば4人目は自動計算
- レート・ウマ・オカ対応、場代の分担方式3種（均等／負け額比例／最下位負担）
- 食事代など個人に帰属する金額の個別管理
- 清算結果は送金指示（最大 n−1 回）と「店に払う額」を分けて表示
- Supabase Realtime による複数端末同期（ログイン不要・合言葉方式）

## 技術スタック

Vite + React + TypeScript / Supabase (Postgres + Realtime) / GitHub Pages

## 開発

```bash
npm install
cp .env.example .env.local   # Supabase の URL と anon キーを記入
npm run dev
```

DBスキーマは `supabase/schema.sql` を Supabase の SQL Editor で実行してください。

```bash
npm test      # 清算ロジックのユニットテスト
npm run build
npm run lint
```
