# Supabase 設計ドキュメント（Phase 0.2 成果物）

作成: 2026-06-11（調査エージェントの報告を整理）
ステータス: 設計案（Phase 3 実装時に RLS の厳密化を再検討すること）

## 結論

- 無料枠で問題なく稼働する（同時4〜8人・1〜2ルームは制限値の1%未満）
- ルームコード（UUID）を知っていることをアクセス権とみなす RLS 設計は定石として成立
- Realtime + RLS の連動は公式サポート済み

## 制限値一覧（Free プラン、2026-06 時点）

| 項目 | Free プラン値 | 本アプリ想定 | 出典 |
|------|-------------|------------|------|
| DBストレージ | 500 MB | < 1 MB | https://supabase.com/pricing |
| Realtime 同時接続数 | 200 | 4〜8 | https://supabase.com/docs/guides/realtime/limits |
| Realtime 月間メッセージ数 | 200万 | < 1万 | 同上 |
| アクティブプロジェクト数 | 2 | 1 | https://supabase.com/pricing |
| **プロジェクト自動停止** | **7日間無操作で pause**（Studio から1クリック復帰、90日間データ保持） | 要注意 | https://supabase.com/docs/guides/platform/billing-faq |

## アクセス制御の設計方針

- `rooms.id`（UUID）を秘密識別子とする。UUID は事実上総当たり不可能（2^122）
- 人間向けの短い招待コード `invite_code`（6文字英数字）は `SECURITY DEFINER` の RPC 関数
  `get_room_by_invite(code)` でのみ room_id に変換する（rooms テーブルへの直接 SELECT は与えない）
- クライアントは room_id を localStorage に保持し、全クエリを `.eq('room_id', roomId)` でフィルタ
- スパム対策は Supabase デフォルトの API Rate Limit ＋ `expires_at` による古いルームの失効で対応

### ⚠️ Phase 3 実装時の再検討事項

調査報告の RLS 草案は players/hanchans の SELECT が `USING (true)`（= anon が全行読める）。
身内アプリとしては許容範囲だが、実装時に以下のいずれかで絞り込むこと:
- rooms への直接 SELECT を REVOKE し、RPC 経由のみとする（最低限）
- セッション変数（`set_config('app.room_id', ...)`）方式での行レベル絞り込み（より厳密）

## テーブル設計

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT        NOT NULL UNIQUE,   -- 例: "AX7K2R"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  settings    JSONB       NOT NULL           -- レート・ウマ・オカ・場代（venue_fee）等
);

CREATE TABLE public.players (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  seat_order  SMALLINT    NOT NULL CHECK (seat_order BETWEEN 1 AND 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat_order)
);

CREATE TABLE public.hanchans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  hanchan_no  SMALLINT    NOT NULL,
  scores      JSONB       NOT NULL,           -- { "<player_id>": 25000, ... }
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, hanchan_no)
);

CREATE INDEX ON public.rooms (invite_code);
CREATE INDEX ON public.players (room_id);
CREATE INDEX ON public.hanchans (room_id);

-- Realtime 対象
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hanchans;
```

- 場代は `rooms.settings.venue_fee` に含める（ルーム開設時に決まる固定費のため別テーブル不要）
- settings の構造はフロントの `RuleSettings` 型（src/types.ts）と対応させる

## invite_code → room_id 変換 RPC

```sql
CREATE OR REPLACE FUNCTION public.get_room_by_invite(code TEXT)
RETURNS TABLE (id UUID, settings JSONB, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, settings, created_at, expires_at
  FROM public.rooms
  WHERE invite_code = upper(trim(code))
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_room_by_invite(TEXT) TO anon;
```

## Phase 3 実装時の注意点

1. `createClient(url, anonKey)` のみ使用。service_role キーは絶対にフロントに置かない
2. Realtime `postgres_changes` は SELECT ポリシーで許可された行のみ届く。subscribe 時に
   `filter: 'room_id=eq.{roomId}'` を指定して通信量削減
3. DELETE イベントは行内容が届かない（PKのみ）→ 削除同期は再フェッチで対応
4. **7日無操作 pause 対策**: 月1回 Studio で復帰 or GitHub Actions で週1 ping（運用開始時に選択）
5. 清算計算はすべてフロントで実施し、DB には生点数（hanchans.scores）とルール設定のみ保存
