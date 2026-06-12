import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, HanchanScores, RuleSettings, FeeSplitMode, Player, PersonalExpenseItem } from '../types.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

// -------------------------------------------------------
// localStorage キー
// -------------------------------------------------------
const ROOM_STORAGE_KEY = 'mahjong-room-v1';
const DRAFT_STORAGE_KEY_PREFIX = 'mahjong-room-draft-';

// -------------------------------------------------------
// Supabase 応答の型定義
// -------------------------------------------------------
interface RpcCreateRoomResult {
  room_id: string;
  invite_code: string;
  players: Array<{ id: string; name: string; seat_order: number }>;
}

interface RpcGetRoomResult {
  room_id: string;
  invite_code: string;
}

interface DbRoomState {
  room_id: string;
  settings: RuleSettings;
  total_fee: number;
  fee_mode: FeeSplitMode;
  fee_payer_id: string | null;
  personal_expenses: PersonalExpenseItem[] | null;
  updated_at: string;
}

/** ランタイム型ガード: PersonalExpenseItem の形状を検証する */
function isPersonalExpenseItem(v: unknown): v is PersonalExpenseItem {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as PersonalExpenseItem).id === 'string' &&
    typeof (v as PersonalExpenseItem).memo === 'string' &&
    typeof (v as PersonalExpenseItem).amounts === 'object'
  );
}

interface DbPlayer {
  id: string;
  room_id: string;
  name: string;
  seat_order: number;
  personal_yen: number;
}

interface DbHanchan {
  id: string;
  room_id: string;
  hanchan_no: number;
  scores: HanchanScores;
  created_at: string;
}

// -------------------------------------------------------
// localStorage 保存形式
// -------------------------------------------------------
interface StoredRoomInfo {
  roomId: string;
  inviteCode: string;
}

function loadRoomInfo(): StoredRoomInfo | null {
  try {
    const raw = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoomInfo;
  } catch {
    return null;
  }
}

function saveRoomInfo(info: StoredRoomInfo): void {
  try {
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // 書き込み失敗は無視
  }
}

function clearRoomInfo(): void {
  localStorage.removeItem(ROOM_STORAGE_KEY);
}

function loadDraft(roomId: string): Record<string, number | null> {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY_PREFIX + roomId);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number | null>;
  } catch {
    return {};
  }
}

function saveDraft(roomId: string, draft: Record<string, number | null>): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY_PREFIX + roomId, JSON.stringify(draft));
  } catch {
    // 書き込み失敗は無視
  }
}

// -------------------------------------------------------
// DB 行 → GameState 変換
// -------------------------------------------------------
function buildGameState(
  roomState: DbRoomState,
  players: DbPlayer[],
  hanchans: DbHanchan[],
  draft: Record<string, number | null>,
): GameState {
  const sortedPlayers: Player[] = [...players]
    .sort((a, b) => a.seat_order - b.seat_order)
    .map((p) => ({ id: p.id, name: p.name }));

  const sortedHanchans: HanchanScores[] = [...hanchans]
    .sort((a, b) => a.hanchan_no - b.hanchan_no)
    .map((h) => h.scores);

  return {
    players: sortedPlayers,
    settings: roomState.settings,
    totalFee: roomState.total_fee,
    feeMode: roomState.fee_mode,
    hanchans: sortedHanchans,
    personalExpenseItems: Array.isArray(roomState.personal_expenses)
      ? roomState.personal_expenses.filter(isPersonalExpenseItem)
      : [],
    draft,
    feePayerId: roomState.fee_payer_id ?? null,
  };
}

// -------------------------------------------------------
// フック本体
// -------------------------------------------------------
export interface UseRoom {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  roomInfo: { roomId: string; inviteCode: string } | null;
  gameState: GameState | null;
  createRoom(
    names: string[],
    settings: RuleSettings,
    totalFee: number,
    feeMode: FeeSplitMode,
  ): Promise<boolean>;
  joinRoom(code: string): Promise<boolean>;
  addHanchan(scores: HanchanScores): void;
  updateHanchan(index: number, scores: HanchanScores): void;
  removeHanchan(index: number): void;
  setTotalFee(fee: number): void;
  setFeePayerId(id: string | null): void;
  /** 場代立替者の保存に失敗したときのエラーメッセージ（成功・再試行開始で null） */
  feePayerSaveError: string | null;
  setPersonalExpenseItems(items: PersonalExpenseItem[]): void;
  setDraft(draft: Record<string, number | null>): void;
  updateSettings(settings: RuleSettings, feeMode: FeeSplitMode): void;
  leaveRoom(): void;
}

export function useRoom(): UseRoom {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ roomId: string; inviteCode: string } | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [feePayerSaveError, setFeePayerSaveError] = useState<string | null>(null);

  // Realtime チャンネルの参照（クリーンアップ用）
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // debounce タイマー（room_state 汎用）
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // personal_expenses 専用 debounce タイマー（debounceRef と共用すると相互 clearTimeout で書き込み消失するため分離）
  const personalExpensesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // refetch 用に roomId を ref でも持つ
  const roomIdRef = useRef<string | null>(null);

  // -------------------------------------------------------
  // 全テーブルを再取得して GameState を再構築
  // -------------------------------------------------------
  const refetchAll = useCallback(async (roomId: string): Promise<GameState | null> => {
    if (!supabase) return null;

    const [rsRes, plRes, hcRes] = await Promise.all([
      supabase.from('room_state').select('*').eq('room_id', roomId).single(),
      supabase.from('players').select('*').eq('room_id', roomId),
      supabase.from('hanchans').select('*').eq('room_id', roomId),
    ]);

    if (rsRes.error || plRes.error || hcRes.error) {
      return null;
    }

    const roomState = rsRes.data as DbRoomState;
    const players = plRes.data as DbPlayer[];
    const hanchans = hcRes.data as DbHanchan[];
    const draft = loadDraft(roomId);

    return buildGameState(roomState, players, hanchans, draft);
  }, []);

  // -------------------------------------------------------
  // Realtime 購読の開始
  // -------------------------------------------------------
  const subscribeRealtime = useCallback(
    (roomId: string) => {
      if (!supabase) return;

      // 既存チャンネルがあれば削除
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_state',
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            // 300ms debounce で refetch
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
              const gs = await refetchAll(roomId);
              if (gs) setGameState(gs);
            }, 300);
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
              const gs = await refetchAll(roomId);
              if (gs) setGameState(gs);
            }, 300);
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'hanchans',
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
              const gs = await refetchAll(roomId);
              if (gs) setGameState(gs);
            }, 300);
          },
        )
        .subscribe();

      channelRef.current = channel;
    },
    [refetchAll],
  );

  // -------------------------------------------------------
  // 初期化: localStorage に接続情報があれば再接続
  // -------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const stored = loadRoomInfo();
    if (!stored) return;

    roomIdRef.current = stored.roomId;

    (async () => {
      setStatus('connecting');
      const gs = await refetchAll(stored.roomId);
      if (!gs) {
        setStatus('error');
        setErrorMessage('前回の卓の情報を取得できませんでした。');
        clearRoomInfo();
        return;
      }
      setRoomInfo(stored);
      setGameState(gs);
      setStatus('connected');
      subscribeRealtime(stored.roomId);
    })();

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------
  // createRoom
  // -------------------------------------------------------
  const createRoom = useCallback(
    async (
      names: string[],
      settings: RuleSettings,
      totalFee: number,
      feeMode: FeeSplitMode,
    ): Promise<boolean> => {
      if (!supabase) {
        setStatus('error');
        setErrorMessage('Supabase が設定されていません。');
        return false;
      }

      setStatus('connecting');
      setErrorMessage(null);

      const { data, error } = await supabase.rpc('create_room', {
        p_settings: settings,
        p_total_fee: totalFee,
        p_fee_mode: feeMode,
        p_names: names,
      });

      if (error || !data) {
        setStatus('error');
        setErrorMessage('卓の作成に失敗しました。接続を確認してください。');
        return false;
      }

      const result = data as RpcCreateRoomResult;
      const { room_id: roomId, invite_code: inviteCode, players } = result;

      const draft = loadDraft(roomId);
      const roomState: DbRoomState = {
        room_id: roomId,
        settings,
        total_fee: totalFee,
        fee_mode: feeMode,
        fee_payer_id: null,
        personal_expenses: [],
        updated_at: new Date().toISOString(),
      };
      const dbPlayers: DbPlayer[] = players.map((p) => ({
        id: p.id,
        room_id: roomId,
        name: p.name,
        seat_order: p.seat_order,
        personal_yen: 0,
      }));

      const gs = buildGameState(roomState, dbPlayers, [], draft);

      const info = { roomId, inviteCode };
      saveRoomInfo(info);
      roomIdRef.current = roomId;
      setRoomInfo(info);
      setGameState(gs);
      setStatus('connected');
      subscribeRealtime(roomId);

      return true;
    },
    [subscribeRealtime],
  );

  // -------------------------------------------------------
  // joinRoom
  // -------------------------------------------------------
  const joinRoom = useCallback(
    async (code: string): Promise<boolean> => {
      if (!supabase) {
        setStatus('error');
        setErrorMessage('Supabase が設定されていません。');
        return false;
      }

      setStatus('connecting');
      setErrorMessage(null);

      const { data, error } = await supabase.rpc('get_room_by_invite', { code });

      if (error || !data) {
        setStatus('idle');
        setErrorMessage('その合言葉の卓が見つかりません');
        return false;
      }

      const result = data as RpcGetRoomResult;
      const { room_id: roomId, invite_code: inviteCode } = result;

      const gs = await refetchAll(roomId);
      if (!gs) {
        setStatus('error');
        setErrorMessage('卓の情報を取得できませんでした。');
        return false;
      }

      const info = { roomId, inviteCode };
      saveRoomInfo(info);
      roomIdRef.current = roomId;
      setRoomInfo(info);
      setGameState(gs);
      setStatus('connected');
      subscribeRealtime(roomId);

      return true;
    },
    [refetchAll, subscribeRealtime],
  );

  // -------------------------------------------------------
  // addHanchan（楽観的更新 → DB書込）
  // -------------------------------------------------------
  const addHanchan = useCallback(
    (scores: HanchanScores) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新
      setGameState((prev) => {
        if (!prev) return prev;
        const draft = loadDraft(roomId);
        return { ...prev, hanchans: [...prev.hanchans, scores], draft };
      });

      // DB 書込（hanchan_no = 現在の最大+1）
      (async () => {
        const { data: existing } = await supabase
          .from('hanchans')
          .select('hanchan_no')
          .eq('room_id', roomId)
          .order('hanchan_no', { ascending: false })
          .limit(1);

        const maxNo =
          existing && existing.length > 0
            ? (existing[0] as { hanchan_no: number }).hanchan_no
            : 0;

        await supabase.from('hanchans').insert({
          room_id: roomId,
          hanchan_no: maxNo + 1,
          scores,
        });
      })();
    },
    [],
  );

  // -------------------------------------------------------
  // updateHanchan（楽観的更新 → DB書込）
  // -------------------------------------------------------
  const updateHanchan = useCallback(
    (index: number, scores: HanchanScores) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新
      setGameState((prev) => {
        if (!prev) return prev;
        const hanchans = prev.hanchans.map((h, i) => (i === index ? scores : h));
        return { ...prev, hanchans };
      });

      // DB 書込（index → hanchan_no = index+1）
      (async () => {
        await supabase
          .from('hanchans')
          .update({ scores })
          .eq('room_id', roomId)
          .eq('hanchan_no', index + 1);
      })();
    },
    [],
  );

  // -------------------------------------------------------
  // removeHanchan（楽観的更新 → DB書込）
  // -------------------------------------------------------
  const removeHanchan = useCallback(
    (index: number) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新
      setGameState((prev) => {
        if (!prev) return prev;
        const hanchans = prev.hanchans.filter((_, i) => i !== index);
        return { ...prev, hanchans };
      });

      // DB 書込
      (async () => {
        await supabase
          .from('hanchans')
          .delete()
          .eq('room_id', roomId)
          .eq('hanchan_no', index + 1);

        // hanchan_no を詰め直す（削除後の番号を連番に修正）
        const { data } = await supabase
          .from('hanchans')
          .select('id, hanchan_no')
          .eq('room_id', roomId)
          .order('hanchan_no', { ascending: true });

        if (data) {
          for (let i = 0; i < data.length; i++) {
            const row = data[i] as { id: string; hanchan_no: number };
            if (row.hanchan_no !== i + 1) {
              await supabase
                .from('hanchans')
                .update({ hanchan_no: i + 1 })
                .eq('id', row.id);
            }
          }
        }
      })();
    },
    [],
  );

  // -------------------------------------------------------
  // setTotalFee
  // -------------------------------------------------------
  const setTotalFee = useCallback(
    (fee: number) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, totalFee: fee };
      });

      (async () => {
        await supabase
          .from('room_state')
          .update({ total_fee: fee, updated_at: new Date().toISOString() })
          .eq('room_id', roomId);
      })();
    },
    [],
  );

  // -------------------------------------------------------
  // setFeePayerId
  // -------------------------------------------------------
  const setFeePayerId = useCallback(
    (id: string | null) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新
      setFeePayerSaveError(null);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, feePayerId: id };
      });

      (async () => {
        const { error } = await supabase
          .from('room_state')
          .update({ fee_payer_id: id, updated_at: new Date().toISOString() })
          .eq('room_id', roomId);

        if (error) {
          console.error('場代立替者の保存に失敗:', error.message);
          setFeePayerSaveError(
            '場代を払う人を保存できませんでした。サーバー側の更新（fee_payer_id 列の追加）が済んでいるか確認してください。',
          );
          // ロールバック: DB 最新値で上書き
          const gs = await refetchAll(roomId);
          if (gs) setGameState(gs);
        }
      })();
    },
    [refetchAll],
  );

  // -------------------------------------------------------
  // updateSettings
  // -------------------------------------------------------
  const updateSettings = useCallback(
    (settings: RuleSettings, feeMode: FeeSplitMode) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, settings, feeMode };
      });

      (async () => {
        const { error } = await supabase
          .from('room_state')
          .update({ settings, fee_mode: feeMode, updated_at: new Date().toISOString() })
          .eq('room_id', roomId);

        if (error) {
          // ロールバック: DB 最新値で上書き
          const gs = await refetchAll(roomId);
          if (gs) setGameState(gs);
        }
      })();
    },
    [refetchAll],
  );

  // -------------------------------------------------------
  // setPersonalExpenseItems
  // -------------------------------------------------------
  const setPersonalExpenseItems = useCallback(
    (items: PersonalExpenseItem[]) => {
      if (!supabase || !roomIdRef.current) return;
      const roomId = roomIdRef.current;

      // 楽観的更新: 即時反映
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, personalExpenseItems: items };
      });

      // 400ms debounce で DB UPDATE（専用 ref を使用）
      if (personalExpensesDebounceRef.current) clearTimeout(personalExpensesDebounceRef.current);
      personalExpensesDebounceRef.current = setTimeout(async () => {
        if (!supabase) return;
        const { error } = await supabase
          .from('room_state')
          .update({
            personal_expenses: items,
            updated_at: new Date().toISOString(),
          })
          .eq('room_id', roomId);

        if (error) {
          console.error('個人分費用の保存に失敗:', error.message);
          // ロールバック: DB 最新値で上書き
          const gs = await refetchAll(roomId);
          if (gs) setGameState(gs);
        }
      }, 400);
    },
    [refetchAll],
  );

  // -------------------------------------------------------
  // setDraft（ローカルのみ）
  // -------------------------------------------------------
  const setDraft = useCallback(
    (draft: Record<string, number | null>) => {
      if (!roomIdRef.current) return;
      saveDraft(roomIdRef.current, draft);
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, draft };
      });
    },
    [],
  );

  // -------------------------------------------------------
  // leaveRoom
  // -------------------------------------------------------
  const leaveRoom = useCallback(() => {
    clearRoomInfo();
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    roomIdRef.current = null;
    setRoomInfo(null);
    setGameState(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return {
    status,
    errorMessage,
    roomInfo,
    gameState,
    createRoom,
    joinRoom,
    addHanchan,
    updateHanchan,
    removeHanchan,
    setTotalFee,
    setFeePayerId,
    feePayerSaveError,
    setPersonalExpenseItems,
    setDraft,
    updateSettings,
    leaveRoom,
  };
}
