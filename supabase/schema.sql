-- ============================================================
-- 麻雀清算アプリ Supabase スキーマ
-- Supabase の SQL Editor に貼り付けて実行してください。
-- ============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------
-- rooms: 合言葉の正本
-- anon への GRANT は一切しない（RPC経由のみアクセス可）
-- -------------------------------------------------------
create table public.rooms (
  id          uuid        primary key default gen_random_uuid(),
  invite_code text        not null unique,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------
-- room_state: ゲーム設定（可変）。秘密情報なし
-- -------------------------------------------------------
create table public.room_state (
  room_id           uuid        primary key references public.rooms(id) on delete cascade,
  settings          jsonb       not null,            -- RuleSettings をそのまま格納
  total_fee         integer     not null default 0,
  fee_mode          text        not null default 'equal' check (fee_mode in ('equal','proportional','loser')),
  personal_expenses jsonb       not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);

-- -------------------------------------------------------
-- players: 参加者
-- -------------------------------------------------------
create table public.players (
  id           uuid     primary key default gen_random_uuid(),
  room_id      uuid     not null references public.rooms(id) on delete cascade,
  name         text     not null,
  seat_order   smallint not null check (seat_order between 1 and 8),
  personal_yen integer  not null default 0,  -- deprecated: room_state.personal_expenses に移行（カラムは互換のため残置）
  unique (room_id, seat_order)
);

-- -------------------------------------------------------
-- hanchans: 半荘スコア
-- -------------------------------------------------------
create table public.hanchans (
  id         uuid     primary key default gen_random_uuid(),
  room_id    uuid     not null references public.rooms(id) on delete cascade,
  hanchan_no smallint not null,
  scores     jsonb    not null,              -- { "<player_id>": 25000, ... }
  created_at timestamptz not null default now(),
  unique (room_id, hanchan_no)
);

-- room_state.fee_payer_id: 場代＋個人分を店にまとめて立替払いするプレイヤー（未選択なら null）
-- players テーブルより後でないと外部キーを張れないため alter で追加する
alter table public.room_state
  add column fee_payer_id uuid references public.players(id) on delete set null;

create index on public.players (room_id);
create index on public.hanchans (room_id);

-- -------------------------------------------------------
-- RLS: 全テーブルで有効化
-- rooms は anon に何も GRANT しない（RPC経由のみ）
-- room_state / players / hanchans は anon に全操作を GRANT し
-- ポリシーは using(true)/with check(true)
-- 既知の制約: anon キー保持者は全行列挙が可能。
--   身内 MVP として許容。UUID を知ることがアクセス権。
-- -------------------------------------------------------
alter table public.rooms       enable row level security;
alter table public.room_state  enable row level security;
alter table public.players     enable row level security;
alter table public.hanchans    enable row level security;

-- room_state: anon へアクセス許可
grant select, insert, update, delete on public.room_state to anon;
create policy "room_state_open" on public.room_state
  using (true) with check (true);

-- players: anon へアクセス許可
grant select, insert, update, delete on public.players to anon;
create policy "players_open" on public.players
  using (true) with check (true);

-- hanchans: anon へアクセス許可
grant select, insert, update, delete on public.hanchans to anon;
create policy "hanchans_open" on public.hanchans
  using (true) with check (true);

-- -------------------------------------------------------
-- RPC 1: create_room
--   紛らわしい文字を除いた6文字コード（ABCDEFGHJKMNPQRSTUVWXYZ23456789）
--   をランダム生成し unique 衝突時はリトライ（最大10回）。
--   rooms / room_state / players(seat_order=配列順) を insert し、
--   json で { room_id, invite_code, players: [{id, name, seat_order}] } を返す。
-- -------------------------------------------------------
create or replace function public.create_room(
  p_settings  jsonb,
  p_total_fee integer,
  p_fee_mode  text,
  p_names     text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id    uuid;
  v_code       text;
  v_charset    text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code_len   int  := 6;
  v_attempts   int  := 0;
  v_max_retry  int  := 10;
  v_player_ids uuid[];
  v_name       text;
  v_idx        int;
  v_pid        uuid;
  v_players    jsonb := '[]'::jsonb;
begin
  -- 招待コードを生成（衝突時リトライ）
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > v_max_retry then
      raise exception 'invite code generation failed after % attempts', v_max_retry;
    end if;

    -- ランダム6文字生成
    v_code := '';
    for i in 1..v_code_len loop
      v_code := v_code || substr(v_charset,
        floor(random() * length(v_charset))::int + 1, 1);
    end loop;

    -- unique チェック
    begin
      insert into public.rooms (invite_code) values (v_code)
        returning id into v_room_id;
      exit; -- 成功したらループ終了
    exception when unique_violation then
      continue;
    end;
  end loop;

  -- room_state を insert
  insert into public.room_state (room_id, settings, total_fee, fee_mode)
  values (v_room_id, p_settings, p_total_fee, p_fee_mode);

  -- players を insert（配列順に seat_order を割り当て）
  v_idx := 1;
  foreach v_name in array p_names loop
    insert into public.players (room_id, name, seat_order, personal_yen)
    values (v_room_id, v_name, v_idx, 0)
    returning id into v_pid;

    v_players := v_players || jsonb_build_object(
      'id', v_pid,
      'name', v_name,
      'seat_order', v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  return jsonb_build_object(
    'room_id',     v_room_id,
    'invite_code', v_code,
    'players',     v_players
  );
end;
$$;

grant execute on function public.create_room(jsonb, integer, text, text[]) to anon;

-- -------------------------------------------------------
-- RPC 2: get_room_by_invite
--   upper(trim(code)) で照合し { room_id, invite_code } を返す（無ければ null）
-- -------------------------------------------------------
create or replace function public.get_room_by_invite(code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'room_id',     r.id,
    'invite_code', r.invite_code
  )
  from public.rooms r
  where r.invite_code = upper(trim(code))
  limit 1;
$$;

grant execute on function public.get_room_by_invite(text) to anon;

-- -------------------------------------------------------
-- Realtime publication
-- -------------------------------------------------------
alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.hanchans;

-- ============================================================
-- 既存DBへのマイグレーション（スキーマ適用済みの環境のみ）
-- Supabase の SQL Editor で以下を手動実行してください。
-- ※ アプリの新バージョンをデプロイする「前」に実行すること
-- ============================================================
-- ALTER TABLE public.room_state
--   ADD COLUMN IF NOT EXISTS fee_payer_id uuid
--   REFERENCES public.players(id) ON DELETE SET NULL;
--
-- ALTER TABLE public.room_state
--   ADD COLUMN IF NOT EXISTS personal_expenses jsonb NOT NULL DEFAULT '[]'::jsonb;
