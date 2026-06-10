import { useCallback } from 'react';
import type { GameState, HanchanScores } from '../types.ts';
import { calcHanchan, sumResults, validateScores } from '../lib/settlement.ts';

interface GameScreenProps {
  gameState: GameState;
  onAddHanchan: (scores: HanchanScores) => void;
  onRemoveHanchan: (index: number) => void;
  onUpdateHanchan: (index: number, scores: HanchanScores) => void;
  onSetTotalFee: (fee: number) => void;
  onSetPersonalExpense: (playerId: string, amount: number) => void;
  onSetDraft: (draft: Record<string, number | null>) => void;
  onSettle: () => void;
}

export function GameScreen({
  gameState,
  onAddHanchan,
  onRemoveHanchan,
  onUpdateHanchan,
  onSetTotalFee,
  onSetPersonalExpense,
  onSetDraft,
  onSettle,
}: GameScreenProps) {
  const { players, settings, hanchans, totalFee, personalExpenses, draft } = gameState;
  const playerOrder = players.map((p) => p.id);

  // 確定済み半荘の結果（バリデーション失敗行は null）
  const hanchanResults = hanchans.map((scores) => {
    const err = validateScores(scores, settings);
    if (err) return null;
    return calcHanchan(scores, playerOrder, settings);
  });

  // 有効な半荘のみで累計収支を計算
  const validResults = hanchanResults.filter((r): r is NonNullable<typeof r> => r !== null);
  const cumulativeResult = validResults.length > 0 ? sumResults(validResults) : null;

  // ドラフト行の自動入力ロジック（フォーカス時）
  const handleDraftFocus = useCallback(
    (playerId: string) => {
      const currentVal = draft[playerId];
      if (currentVal !== null && currentVal !== undefined) return; // 既に値がある場合はスキップ

      // 他の3人が入力済みか確認
      const others = players.filter((p) => p.id !== playerId);
      const allOthersFilled = others.every((p) => {
        const v = draft[p.id];
        return v !== null && v !== undefined;
      });
      if (!allOthersFilled) return;

      const otherSum = others.reduce((sum, p) => sum + (draft[p.id] ?? 0), 0);
      const remaining = settings.startingPoints * players.length - otherSum;
      onSetDraft({ ...draft, [playerId]: remaining });
    },
    [draft, players, settings.startingPoints, onSetDraft],
  );

  // 確定済み行のセルフォーカス時自動入力
  const handleHanchanCellFocus = useCallback(
    (rowIndex: number, playerId: string) => {
      const scores = hanchans[rowIndex];
      const currentVal = scores[playerId];
      // 値が0の場合は自動入力候補として扱う（空扱い）
      // 他の3人が入力済みで自分だけ0（かつ他全員が非ゼロ or 合計が標準値以外）の場合に自動補完
      const others = players.filter((p) => p.id !== playerId);
      const allOthersFilled = others.every((p) => {
        const v = scores[p.id];
        return v !== undefined;
      });
      if (!allOthersFilled) return;

      // 現在のセルが0で合計が合わない場合のみ自動補完
      const otherSum = others.reduce((sum, p) => sum + (scores[p.id] ?? 0), 0);
      const expected = settings.startingPoints * players.length;
      if (otherSum + (currentVal ?? 0) !== expected && otherSum !== expected) {
        const remaining = expected - otherSum;
        const newScores = { ...scores, [playerId]: remaining };
        onUpdateHanchan(rowIndex, newScores);
      }
    },
    [hanchans, players, settings.startingPoints, onUpdateHanchan],
  );

  // ドラフト行の入力変更
  const handleDraftChange = useCallback(
    (playerId: string, raw: string) => {
      const num = raw === '' ? null : Number(raw);
      onSetDraft({ ...draft, [playerId]: isNaN(num as number) ? null : num });
    },
    [draft, onSetDraft],
  );

  // ドラフト行のblur時に確定判定
  const handleDraftBlur = useCallback(() => {
    const allFilled = players.every((p) => {
      const v = draft[p.id];
      return v !== null && v !== undefined;
    });
    if (!allFilled) return;

    const scores: HanchanScores = {};
    for (const p of players) {
      scores[p.id] = draft[p.id] ?? 0;
    }
    const err = validateScores(scores, settings);
    if (err) return; // バリデーション失敗 → 確定しない

    onAddHanchan(scores);
    // ドラフトをリセット
    const emptyDraft: Record<string, number | null> = {};
    for (const p of players) {
      emptyDraft[p.id] = null;
    }
    onSetDraft(emptyDraft);
  }, [draft, players, settings, onAddHanchan, onSetDraft]);

  // 確定済み行のセル変更
  const handleHanchanCellChange = useCallback(
    (rowIndex: number, playerId: string, raw: string) => {
      const num = raw === '' ? 0 : Number(raw);
      if (isNaN(num)) return;
      const newScores = { ...hanchans[rowIndex], [playerId]: num };
      onUpdateHanchan(rowIndex, newScores);
    },
    [hanchans, onUpdateHanchan],
  );

  // ドラフト行のバリデーションエラー表示
  const draftScores: HanchanScores = {};
  let draftAllFilled = true;
  for (const p of players) {
    const v = draft[p.id];
    if (v === null || v === undefined) {
      draftAllFilled = false;
      draftScores[p.id] = 0;
    } else {
      draftScores[p.id] = v;
    }
  }
  const draftError = draftAllFilled ? validateScores(draftScores, settings) : null;

  // 削除ダイアログ（ステートをローカルで持てないのでconfirmを使う）
  const handleDeleteClick = useCallback(
    (idx: number) => {
      if (window.confirm(`第${idx + 1}半荘を削除しますか？`)) {
        onRemoveHanchan(idx);
      }
    },
    [onRemoveHanchan],
  );

  // 場代入力変更
  const handleFeeChange = useCallback(
    (raw: string) => {
      const num = Number(raw);
      if (!isNaN(num) && num >= 0) {
        onSetTotalFee(num);
      } else if (raw === '') {
        onSetTotalFee(0);
      }
    },
    [onSetTotalFee],
  );

  // 個人分入力変更
  const handlePersonalExpenseChange = useCallback(
    (playerId: string, raw: string) => {
      const num = raw === '' ? 0 : Number(raw);
      if (!isNaN(num) && num >= 0) {
        onSetPersonalExpense(playerId, num);
      }
    },
    [onSetPersonalExpense],
  );

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

      {/* 点数表 */}
      <div className='score-table-wrapper'>
        <table className='score-table'>
          <thead>
            <tr>
              <th className='score-table-th score-table-label-col'></th>
              {players.map((p) => (
                <th key={p.id} className='score-table-th score-table-player-col'>
                  {p.name}
                </th>
              ))}
              <th className='score-table-th score-table-action-col'></th>
            </tr>
          </thead>
          <tbody>
            {/* 確定済み半荘行 */}
            {hanchans.map((scores, idx) => {
              const result = hanchanResults[idx];
              const rowError = result === null ? validateScores(scores, settings) : null;
              return (
                <tr key={idx} className={`score-table-row${rowError ? ' row-invalid' : ''}`}>
                  <td className='score-table-td score-table-label-col score-table-row-label'>
                    第{idx + 1}局
                  </td>
                  {players.map((p) => {
                    const yen = result ? (result[p.id] ?? 0) : null;
                    const yenSign = yen !== null ? (yen > 0 ? 'plus' : yen < 0 ? 'minus' : 'zero') : 'zero';
                    return (
                      <td key={p.id} className='score-table-td score-table-player-col'>
                        <input
                          className='score-cell-input'
                          type='number'
                          inputMode='numeric'
                          step='100'
                          value={scores[p.id] ?? ''}
                          onChange={(e) => handleHanchanCellChange(idx, p.id, e.target.value)}
                          onFocus={() => handleHanchanCellFocus(idx, p.id)}
                          aria-label={`第${idx + 1}局 ${p.name}`}
                        />
                        <span className={`score-cell-yen yen-${yenSign}`}>
                          {yen === null ? '—' : `${yen >= 0 ? '+' : ''}${yen.toLocaleString()}`}
                        </span>
                      </td>
                    );
                  })}
                  <td className='score-table-td score-table-action-col'>
                    <button
                      className='btn-delete'
                      onClick={() => handleDeleteClick(idx)}
                      aria-label={`第${idx + 1}局を削除`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* ドラフト行（常に1行） */}
            <tr className='score-table-row score-table-draft-row'>
              <td className='score-table-td score-table-label-col score-table-row-label'>
                入力中
              </td>
              {players.map((p) => {
                const val = draft[p.id];
                return (
                  <td key={p.id} className='score-table-td score-table-player-col'>
                    <input
                      className='score-cell-input score-cell-draft'
                      type='number'
                      inputMode='numeric'
                      step='100'
                      value={val === null || val === undefined ? '' : String(val)}
                      onChange={(e) => handleDraftChange(p.id, e.target.value)}
                      onFocus={() => handleDraftFocus(p.id)}
                      onBlur={handleDraftBlur}
                      placeholder='—'
                      aria-label={`入力中 ${p.name}`}
                    />
                  </td>
                );
              })}
              <td className='score-table-td score-table-action-col'></td>
            </tr>

            {/* ドラフト行エラー表示 */}
            {draftError && (
              <tr className='score-table-error-row'>
                <td colSpan={players.length + 2} className='score-table-error-cell'>
                  {draftError}
                </td>
              </tr>
            )}

            {/* 場代行 */}
            <tr className='score-table-row score-table-fee-row'>
              <td className='score-table-td score-table-label-col score-table-row-label score-table-fee-label'>
                場代
              </td>
              <td colSpan={players.length} className='score-table-td score-table-fee-input-cell'>
                <div className='score-table-fee-input-wrap'>
                  <input
                    className='score-cell-input score-cell-fee'
                    type='number'
                    inputMode='numeric'
                    min='0'
                    step='100'
                    value={totalFee === 0 ? '' : String(totalFee)}
                    onChange={(e) => handleFeeChange(e.target.value)}
                    placeholder='0'
                    aria-label='場代合計金額'
                  />
                  <span className='score-fee-unit'>円</span>
                </div>
              </td>
              <td className='score-table-td score-table-action-col'></td>
            </tr>

            {/* 個人分行 */}
            <tr className='score-table-row score-table-personal-row'>
              <td className='score-table-td score-table-label-col score-table-row-label score-table-fee-label'>
                個人分
              </td>
              {players.map((p) => {
                const val = personalExpenses[p.id] ?? 0;
                return (
                  <td key={p.id} className='score-table-td score-table-player-col'>
                    <input
                      className='score-cell-input score-cell-personal'
                      type='number'
                      inputMode='numeric'
                      min='0'
                      step='100'
                      value={val === 0 ? '' : String(val)}
                      onChange={(e) => handlePersonalExpenseChange(p.id, e.target.value)}
                      placeholder='0'
                      aria-label={`${p.name} 個人分`}
                    />
                  </td>
                );
              })}
              <td className='score-table-td score-table-action-col'></td>
            </tr>
          </tbody>
        </table>
      </div>

      {hanchans.length > 0 && (
        <button className='btn btn-primary btn-full mt-md' onClick={onSettle}>
          清算する
        </button>
      )}
    </div>
  );
}
