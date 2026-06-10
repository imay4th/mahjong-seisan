import { useState } from 'react';
import type { Player, RuleSettings, HanchanScores } from '../types.ts';
import { validateScores } from '../lib/settlement.ts';

interface HanchanFormProps {
  players: Player[];
  settings: RuleSettings;
  onSubmit: (scores: HanchanScores) => void;
  onCancel: () => void;
}

export function HanchanForm({ players, settings, onSubmit, onCancel }: HanchanFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleChange = (id: string, raw: string) => {
    setValues((prev) => ({ ...prev, [id]: raw }));
    setError(null);
  };

  const filledCount = players.filter((p) => {
    const v = values[p.id];
    return v !== undefined && v !== '' && !isNaN(Number(v));
  }).length;

  const canAutoFill = filledCount === players.length - 1;

  const handleAutoFill = () => {
    const emptyPlayer = players.find((p) => {
      const v = values[p.id];
      return v === undefined || v === '' || isNaN(Number(v));
    });
    if (!emptyPlayer) return;

    const filledSum = players
      .filter((p) => p.id !== emptyPlayer.id)
      .reduce((sum, p) => sum + (Number(values[p.id]) || 0), 0);

    const remaining = settings.startingPoints * players.length - filledSum;
    setValues((prev) => ({ ...prev, [emptyPlayer.id]: String(remaining) }));
  };

  const handleSubmit = () => {
    const scores: HanchanScores = {};
    for (const p of players) {
      const v = Number(values[p.id] ?? '');
      if (isNaN(v) || values[p.id] === '') {
        setError(`${p.name}の持ち点を入力してください。`);
        return;
      }
      scores[p.id] = v;
    }
    const validationError = validateScores(scores, settings);
    if (validationError) {
      // エラーメッセージをプレイヤーIDから名前に変換
      let msg = validationError;
      for (const p of players) {
        msg = msg.replace(p.id, p.name);
      }
      setError(msg);
      return;
    }
    onSubmit(scores);
  };

  const totalEntered = players.reduce((sum, p) => {
    const v = Number(values[p.id] ?? '');
    return isNaN(v) ? sum : sum + v;
  }, 0);
  const expected = settings.startingPoints * players.length;

  return (
    <div className='hanchan-form'>
      <h3 className='form-title'>持ち点入力</h3>

      <div className='score-inputs'>
        {players.map((p) => (
          <div key={p.id} className='input-group'>
            <label className='input-label'>{p.name}</label>
            <div className='score-input-row'>
              <input
                className='text-input num-input'
                type='number'
                inputMode='numeric'
                value={values[p.id] ?? ''}
                onChange={(e) => handleChange(p.id, e.target.value)}
                step='100'
                placeholder='例: 32500'
              />
              <span className='score-unit'>点</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`score-total${totalEntered === expected ? ' ok' : ''}`}>
        合計: <span className='score-total-val'>{totalEntered.toLocaleString()}</span>
        <span className='score-total-expected'>/ {expected.toLocaleString()}点</span>
      </div>

      {canAutoFill && (
        <button className='btn btn-secondary btn-sm auto-fill-btn' onClick={handleAutoFill}>
          残り1人を自動補完
        </button>
      )}

      {error && (
        <p className='error-msg' role='alert'>
          {error}
        </p>
      )}

      <div className='form-actions'>
        <button className='btn btn-ghost' onClick={onCancel}>
          キャンセル
        </button>
        <button className='btn btn-primary' onClick={handleSubmit}>
          追加
        </button>
      </div>
    </div>
  );
}
