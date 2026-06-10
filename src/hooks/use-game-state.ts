import { useState, useCallback } from 'react';
import type { GameState, HanchanScores, Player, RuleSettings, FeeSplitMode } from '../types.ts';

const STORAGE_KEY = 'mahjong-settlement-v1';

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
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
      const next: GameState = { players, settings, totalFee, feeMode, hanchans: [] };
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

  const clearGame = useCallback(() => {
    clearState();
    setGameState(null);
  }, []);

  return { gameState, startGame, addHanchan, removeHanchan, clearGame };
}
