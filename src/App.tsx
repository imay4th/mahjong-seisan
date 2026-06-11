import { useState } from 'react';
import './App.css';
import type { Screen } from './types.ts';
import type { RuleSettings, FeeSplitMode, HanchanScores } from './types.ts';
import { useRoom } from './hooks/use-room.ts';
import { isSupabaseConfigured } from './lib/supabase.ts';
import { HomeScreen } from './components/home-screen.tsx';
import { SetupScreen } from './components/setup-screen.tsx';
import { GameScreen } from './components/game-screen.tsx';
import { SettlementScreen } from './components/settlement-screen.tsx';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [isCreating, setIsCreating] = useState(false);

  const {
    status,
    errorMessage,
    roomInfo,
    gameState,
    createRoom,
    joinRoom,
    addHanchan,
    removeHanchan,
    updateHanchan,
    setTotalFee,
    setPersonalExpense,
    setDraft,
    leaveRoom,
  } = useRoom();

  // 接続済みなら game 画面へ自動遷移（再接続時）
  const handleNewGame = () => {
    setScreen('setup');
  };

  const handleResume = () => {
    setScreen('game');
  };

  const handleStart = async (
    names: string[],
    settings: RuleSettings,
    totalFee: number,
    feeMode: FeeSplitMode,
  ) => {
    setIsCreating(true);
    const ok = await createRoom(names, settings, totalFee, feeMode);
    setIsCreating(false);
    if (ok) {
      setScreen('game');
    }
  };

  const handleNewGameFromSettlement = () => {
    leaveRoom();
    setScreen('home');
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setScreen('home');
  };

  const handleJoinRoom = async (code: string): Promise<boolean> => {
    const ok = await joinRoom(code);
    if (ok) {
      setScreen('game');
    }
    return ok;
  };

  return (
    <div className='app'>
      {screen === 'home' && (
        <HomeScreen
          roomInfo={roomInfo}
          gameState={gameState}
          supabaseConfigured={isSupabaseConfigured()}
          joinError={status === 'idle' ? errorMessage : null}
          onNewGame={handleNewGame}
          onResume={handleResume}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {screen === 'setup' && (
        <SetupScreen
          isCreating={isCreating}
          createError={status === 'error' ? errorMessage : null}
          onStart={handleStart}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'game' && gameState && (
        <GameScreen
          gameState={gameState}
          inviteCode={roomInfo?.inviteCode ?? null}
          onAddHanchan={(scores: HanchanScores) => addHanchan(scores)}
          onRemoveHanchan={removeHanchan}
          onUpdateHanchan={updateHanchan}
          onSetTotalFee={setTotalFee}
          onSetPersonalExpense={setPersonalExpense}
          onSetDraft={setDraft}
          onSettle={() => setScreen('settlement')}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {screen === 'game' && !gameState && (
        <HomeScreen
          roomInfo={null}
          gameState={null}
          supabaseConfigured={isSupabaseConfigured()}
          joinError={null}
          onNewGame={handleNewGame}
          onResume={() => {}}
          onJoinRoom={handleJoinRoom}
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
