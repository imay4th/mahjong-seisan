import { useState } from 'react';
import './App.css';
import type { Screen } from './types.ts';
import type { Player, RuleSettings, FeeSplitMode, HanchanScores } from './types.ts';
import { useGameState } from './hooks/use-game-state.ts';
import { HomeScreen } from './components/home-screen.tsx';
import { SetupScreen } from './components/setup-screen.tsx';
import { GameScreen } from './components/game-screen.tsx';
import { SettlementScreen } from './components/settlement-screen.tsx';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const {
    gameState,
    startGame,
    addHanchan,
    removeHanchan,
    updateHanchan,
    setTotalFee,
    setPersonalExpense,
    setDraft,
    clearGame,
  } = useGameState();

  const handleNewGame = () => {
    setScreen('setup');
  };

  const handleResume = () => {
    setScreen('game');
  };

  const handleStart = (
    players: Player[],
    settings: RuleSettings,
    totalFee: number,
    feeMode: FeeSplitMode,
  ) => {
    startGame(players, settings, totalFee, feeMode);
    setScreen('game');
  };

  const handleNewGameFromSettlement = () => {
    clearGame();
    setScreen('home');
  };

  return (
    <div className='app'>
      {screen === 'home' && (
        <HomeScreen
          savedGame={gameState}
          onNewGame={handleNewGame}
          onResume={handleResume}
        />
      )}

      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} onBack={() => setScreen('home')} />
      )}

      {screen === 'game' && gameState && (
        <GameScreen
          gameState={gameState}
          onAddHanchan={(scores: HanchanScores) => addHanchan(scores)}
          onRemoveHanchan={removeHanchan}
          onUpdateHanchan={updateHanchan}
          onSetTotalFee={setTotalFee}
          onSetPersonalExpense={setPersonalExpense}
          onSetDraft={setDraft}
          onSettle={() => setScreen('settlement')}
        />
      )}

      {screen === 'game' && !gameState && (
        <HomeScreen
          savedGame={null}
          onNewGame={handleNewGame}
          onResume={() => {}}
        />
      )}

      {screen === 'settlement' && gameState && gameState.hanchans.length > 0 && (
        <SettlementScreen
          gameState={gameState}
          onBack={() => setScreen('game')}
          onNewGame={handleNewGameFromSettlement}
        />
      )}
    </div>
  );
}

export default App;
