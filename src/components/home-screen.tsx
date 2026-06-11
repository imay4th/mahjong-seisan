import type { GameState } from '../types.ts';
import { calcHanchan, sumResults, validateScores } from '../lib/settlement.ts';

interface HomeScreenProps {
  savedGame: GameState | null;
  onNewGame: () => void;
  onResume: () => void;
}

export function HomeScreen({ savedGame, onNewGame, onResume }: HomeScreenProps) {
  // 進行中ゲームの局数・収支幅を算出（既存関数のみ使用）
  const resumeInfo = (() => {
    if (!savedGame) return null;
    const { players, settings, hanchans } = savedGame;
    const playerOrder = players.map((p) => p.id);
    const validResults = hanchans
      .filter((scores) => validateScores(scores, settings) === null)
      .map((scores) => calcHanchan(scores, playerOrder, settings));
    const hanchanCount = hanchans.length;
    if (validResults.length === 0) {
      return { hanchanCount, maxPlus: null, maxMinus: null };
    }
    const summed = sumResults(validResults);
    const values = Object.values(summed);
    const maxPlus = Math.max(...values);
    const maxMinus = Math.min(...values);
    return { hanchanCount, maxPlus, maxMinus };
  })();

  const playerNames = savedGame ? savedGame.players.map((p) => p.name).join('・') : '';

  return (
    <div className='screen home-screen'>
      {/* タイトルバー: 麻タイル（小）+ 明朝タイトル + 強罫線 */}
      <div className='home-title-row'>
        <div className='mahjong-tile mahjong-tile-sm'>麻</div>
        <h1 className='app-title'>麻雀清算</h1>
      </div>
      <div className='home-title-rule' />

      {/* 前回の卓カード */}
      {savedGame && resumeInfo && (
        <div className='sheet home-resume-sheet'>
          <p className='home-resume-label'>前回の卓</p>
          <p className='home-resume-players'>{playerNames}</p>
          <p className='home-resume-meta'>
            {resumeInfo.hanchanCount}局
            {resumeInfo.maxPlus !== null && resumeInfo.maxMinus !== null && (
              <>
                {' ／ '}
                <span className='home-resume-plus'>
                  +{resumeInfo.maxPlus.toLocaleString()}
                </span>
                {' 〜 '}
                <span className='home-resume-minus'>
                  {resumeInfo.maxMinus.toLocaleString()}
                </span>
              </>
            )}
          </p>
          <button className='btn btn-secondary home-resume-btn' onClick={onResume}>
            つづきを開く
            {/* CSS三角チェブロン */}
            <svg
              className='btn-chevron'
              width='16'
              height='16'
              viewBox='0 0 16 16'
              fill='none'
              aria-hidden='true'
            >
              <path
                d='M6 3L11 8L6 13'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>
      )}

      {/* 新規開始ボタン */}
      <button className='btn btn-primary btn-full home-new-btn' onClick={onNewGame}>
        卓を立てる
      </button>
    </div>
  );
}
