import { useState } from 'react';
import type { GameState } from '../types.ts';
import { calcHanchan, sumResults, validateScores } from '../lib/settlement.ts';

interface HomeScreenProps {
  roomInfo: { roomId: string; inviteCode: string } | null;
  gameState: GameState | null;
  supabaseConfigured: boolean;
  joinError: string | null;
  onNewGame: () => void;
  onResume: () => void;
  onJoinRoom: (code: string) => Promise<boolean>;
}

export function HomeScreen({
  roomInfo,
  gameState,
  supabaseConfigured,
  joinError,
  onNewGame,
  onResume,
  onJoinRoom,
}: HomeScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [localJoinError, setLocalJoinError] = useState<string | null>(null);

  // 進行中ゲームの局数・収支幅を算出
  const resumeInfo = (() => {
    if (!gameState) return null;
    const { players, settings, hanchans } = gameState;
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

  const playerNames = gameState ? gameState.players.map((p) => p.name).join('・') : '';

  const handleJoinSubmit = async () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      setLocalJoinError('合言葉を入力してください');
      return;
    }
    setIsJoining(true);
    setLocalJoinError(null);
    const ok = await onJoinRoom(trimmed);
    setIsJoining(false);
    if (!ok) {
      setLocalJoinError('その合言葉の卓が見つかりません');
    }
  };

  const displayJoinError = localJoinError ?? joinError;

  return (
    <div className='screen home-screen'>
      {/* タイトルバー */}
      <div className='home-title-row'>
        <div className='mahjong-tile mahjong-tile-sm'>麻</div>
        <h1 className='app-title'>麻雀清算</h1>
      </div>
      <div className='home-title-rule' />

      {/* Supabase 未設定の警告 */}
      {!supabaseConfigured && (
        <div className='home-config-warning' role='alert'>
          サーバー未設定のため卓を立てられません（.env.local を設定してください）
        </div>
      )}

      {/* 前回の卓カード（roomInfo が存在する場合） */}
      {roomInfo && gameState && resumeInfo && (
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
          <p className='home-resume-invite'>合言葉: {roomInfo.inviteCode}</p>
          <button className='btn btn-secondary home-resume-btn' onClick={onResume}>
            つづきを開く
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
      <button
        className='btn btn-primary btn-full home-new-btn'
        onClick={onNewGame}
        disabled={!supabaseConfigured}
      >
        卓を立てる
      </button>

      {/* 合言葉で入る */}
      <div className='home-join-section'>
        <p className='home-join-label'>合言葉で入る</p>
        <div className='home-join-row'>
          <input
            className='text-input home-join-input'
            type='text'
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setLocalJoinError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoinSubmit();
            }}
            maxLength={6}
            placeholder='AX7K2R'
            aria-label='合言葉（6文字）'
            disabled={!supabaseConfigured || isJoining}
          />
          <button
            className='btn btn-secondary home-join-btn'
            onClick={handleJoinSubmit}
            disabled={!supabaseConfigured || isJoining}
          >
            {isJoining ? '接続中…' : '入る'}
          </button>
        </div>
        {displayJoinError && (
          <p className='home-join-error' role='alert'>
            {displayJoinError}
          </p>
        )}
      </div>
    </div>
  );
}
