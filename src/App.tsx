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
  // setup 画面のモード: 新規作成 or ゲーム中のルール設定変更
  const [setupMode, setSetupMode] = useState<'create' | 'edit'>('create');

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
    setPersonalExpenseItems,
    setFeePayerId,
    feePayerSaveError,
    updateSettings,
    setDraft,
    leaveRoom,
  } = useRoom();

  // 接続済みなら game 画面へ自動遷移（再接続時）
  const handleNewGame = () => {
    setSetupMode('create');
    setScreen('setup');
  };

  const handleOpenSettings = () => {
    setSetupMode('edit');
    setScreen('setup');
  };

  const handleSaveSettings = (settings: RuleSettings, feeMode: FeeSplitMode) => {
    updateSettings(settings, feeMode);
    setScreen('game');
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
          onBack={() => setScreen(setupMode === 'edit' && gameState ? 'game' : 'home')}
          editMode={setupMode === 'edit' && !!gameState}
          initialSettings={setupMode === 'edit' ? gameState?.settings : undefined}
          initialFeeMode={setupMode === 'edit' ? gameState?.feeMode : undefined}
          onSaveSettings={handleSaveSettings}
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
          onSetPersonalExpenseItems={setPersonalExpenseItems}
          onSetDraft={setDraft}
          onSettle={() => setScreen('settlement')}
          onLeaveRoom={handleLeaveRoom}
          onOpenSettings={handleOpenSettings}
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
          onSetFeePayerId={setFeePayerId}
          feePayerSaveError={feePayerSaveError}
        />
      )}
    </div>
  );
}

export default App;
