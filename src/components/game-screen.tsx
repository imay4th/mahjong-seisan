import { useState } from 'react';
import type { GameState, HanchanScores } from '../types.ts';
import { calcHanchan, sumResults } from '../lib/settlement.ts';
import { HanchanForm } from './hanchan-form.tsx';

interface GameScreenProps {
  gameState: GameState;
  onAddHanchan: (scores: HanchanScores) => void;
  onRemoveHanchan: (index: number) => void;
  onSettle: () => void;
}

export function GameScreen({
  gameState,
  onAddHanchan,
  onRemoveHanchan,
  onSettle,
}: GameScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { players, settings, hanchans } = gameState;
  const playerOrder = players.map((p) => p.id);

  // 累計収支（円）
  const hanchanResults = hanchans.map((scores) =>
    calcHanchan(scores, playerOrder, settings),
  );
  const cumulativeResult = hanchans.length > 0 ? sumResults(hanchanResults) : null;

  const handleFormSubmit = (scores: HanchanScores) => {
    onAddHanchan(scores);
    setShowForm(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget !== null) {
      onRemoveHanchan(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className='screen game-screen'>
      {/* 累計収支カード */}
      <div className='cumulative-card'>
        <h2 className='cumulative-title'>累計収支</h2>
        <div className='cumulative-grid'>
          {players.map((p) => {
            const amount = cumulativeResult ? (cumulativeResult[p.id] ?? 0) : 0;
            const sign = amount > 0 ? 'plus' : amount < 0 ? 'minus' : 'zero';
            return (
              <div key={p.id} className={`cumulative-item cumulative-${sign}`}>
                <span className='cumulative-name'>{p.name}</span>
                <span className='cumulative-amount'>
                  {amount >= 0 ? '+' : ''}
                  {amount.toLocaleString()}円
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 半荘履歴 */}
      <div className='hanchan-list'>
        <h3 className='list-title'>半荘履歴</h3>
        {hanchans.length === 0 ? (
          <p className='empty-msg'>まだ半荘が記録されていません</p>
        ) : (
          hanchans.map((scores, idx) => {
            const result = hanchanResults[idx];
            return (
              <div key={idx} className='hanchan-item'>
                <div className='hanchan-item-header'>
                  <span className='hanchan-label'>第{idx + 1}半荘</span>
                  <button
                    className='btn-delete'
                    onClick={() => setDeleteTarget(idx)}
                    aria-label={`第${idx + 1}半荘を削除`}
                  >
                    ×
                  </button>
                </div>
                <div className='hanchan-scores'>
                  {players.map((p) => {
                    const score = scores[p.id] ?? 0;
                    const yen = result ? (result[p.id] ?? 0) : 0;
                    const sign = yen > 0 ? 'plus' : yen < 0 ? 'minus' : 'zero';
                    return (
                      <div key={p.id} className='hanchan-score-item'>
                        <span className='player-name-sm'>{p.name}</span>
                        <span className='score-val'>{score.toLocaleString()}</span>
                        <span className={`yen-val yen-${sign}`}>
                          {yen >= 0 ? '+' : ''}
                          {yen.toLocaleString()}円
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 半荘追加フォーム */}
      {showForm ? (
        <div className='form-overlay'>
          <div className='form-modal'>
            <HanchanForm
              players={players}
              settings={settings}
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      ) : (
        <button className='btn btn-secondary btn-full' onClick={() => setShowForm(true)}>
          半荘を追加
        </button>
      )}

      {hanchans.length > 0 && !showForm && (
        <button className='btn btn-primary btn-full mt-md' onClick={onSettle}>
          清算する
        </button>
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget !== null && (
        <div className='dialog-overlay'>
          <div className='dialog'>
            <p className='dialog-msg'>
              第{deleteTarget + 1}半荘を削除しますか？
            </p>
            <div className='dialog-actions'>
              <button className='btn btn-ghost' onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button className='btn btn-danger' onClick={handleDeleteConfirm}>
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
