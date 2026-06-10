import type { GameState } from '../types.ts';

interface HomeScreenProps {
  savedGame: GameState | null;
  onNewGame: () => void;
  onResume: () => void;
}

export function HomeScreen({ savedGame, onNewGame, onResume }: HomeScreenProps) {
  const resumeLabel = savedGame
    ? savedGame.players.map((p) => p.name).join('・')
    : '';

  return (
    <div className='screen home-screen'>
      <div className='home-header'>
        <div className='mahjong-tile'>麻</div>
        <h1 className='app-title'>麻雀清算</h1>
        <p className='app-subtitle'>半荘ごとの収支を自動で計算</p>
      </div>

      <div className='home-actions'>
        <button className='btn btn-primary btn-lg' onClick={onNewGame}>
          新しいゲームを始める
        </button>

        {savedGame && (
          <button className='btn btn-secondary btn-lg' onClick={onResume}>
            <span className='btn-label'>続きから再開</span>
            <span className='btn-sub'>前回: {resumeLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
