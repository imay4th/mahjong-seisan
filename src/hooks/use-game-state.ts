import { useState, useCallback } from 'react';
import type { GameState, HanchanScores, Player, RuleSettings, FeeSplitMode } from '../types.ts';

const STORAGE_KEY = 'mahjong-settlement-v1';

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // 後方互換: 旧形式に personalExpenses / draft がない場合はデフォルト補完
    return {
      players: parsed.players ?? [],
      settings: parsed.settings ?? {
        ratePer1000: 50,
        uma: [20, 10, -10, -20],
        oka: true,
        startingPoints: 25000,
        returnPoints: 30000,
      },
      totalFee: parsed.totalFee ?? 0,
      feeMode: parsed.feeMode ?? 'equal',
      hanchans: parsed.hanchans ?? [],
      personalExpenses: parsed.personalExpenses ?? {},
      draft: parsed.draft ?? {},
    };
  } catch {
    return null;
  }
}

function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ストレージ書き込み失敗は無視
  }
}

function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface UseGameState {
  gameState: GameState | null;
  startGame: (
    players: Player[],
    settings: RuleSettings,
    totalFee: number,
    feeMode: FeeSplitMode,
  ) => void;
  addHanchan: (scores: HanchanScores) => void;
  removeHanchan: (index: number) => void;
  updateHanchan: (index: number, scores: HanchanScores) => void;
  setTotalFee: (fee: number) => void;
  setPersonalExpense: (playerId: string, amount: number) => void;
  setDraft: (draft: Record<string, number | null>) => void;
  clearGame: () => void;
}

export function useGameState(): UseGameState {
  const [gameState, setGameState] = useState<GameState | null>(loadState);

  const startGame = useCallback(
    (
      players: Player[],
      settings: RuleSettings,
      totalFee: number,
      feeMode: FeeSplitMode,
    ) => {
      const next: GameState = {
        players,
        settings,
        totalFee,
        feeMode,
        hanchans: [],
        personalExpenses: {},
        draft: {},
      };
      saveState(next);
      setGameState(next);
    },
    [],
  );

  const addHanchan = useCallback((scores: HanchanScores) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const next: GameState = { ...prev, hanchans: [...prev.hanchans, scores] };
      saveState(next);
      return next;
    });
  }, []);

  const removeHanchan = useCallback((index: number) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const hanchans = prev.hanchans.filter((_, i) => i !== index);
      const next: GameState = { ...prev, hanchans };
      saveState(next);
      return next;
    });
  }, []);

  const updateHanchan = useCallback((index: number, scores: HanchanScores) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const hanchans = prev.hanchans.map((h, i) => (i === index ? scores : h));
      const next: GameState = { ...prev, hanchans };
      saveState(next);
      return next;
    });
  }, []);

  const setTotalFee = useCallback((fee: number) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const next: GameState = { ...prev, totalFee: fee };
      saveState(next);
      return next;
    });
  }, []);

  const setPersonalExpense = useCallback((playerId: string, amount: number) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const personalExpenses = { ...prev.personalExpenses, [playerId]: amount };
      const next: GameState = { ...prev, personalExpenses };
      saveState(next);
      return next;
    });
  }, []);

  const setDraft = useCallback((draft: Record<string, number | null>) => {
    setGameState((prev) => {
      if (!prev) return prev;
      const next: GameState = { ...prev, draft };
      saveState(next);
      return next;
    });
  }, []);

  const clearGame = useCallback(() => {
    clearState();
    setGameState(null);
  }, []);

  return {
    gameState,
    startGame,
    addHanchan,
    removeHanchan,
    updateHanchan,
    setTotalFee,
    setPersonalExpense,
    setDraft,
    clearGame,
  };
}
