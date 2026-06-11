import { useState } from 'react';
import type { Player, RuleSettings, FeeSplitMode } from '../types.ts';

interface SetupScreenProps {
  onStart: (
    players: Player[],
    settings: RuleSettings,
    totalFee: number,
    feeMode: FeeSplitMode,
  ) => void;
  onBack: () => void;
}

type RatePreset = '50' | '100' | 'custom';
type UmaPreset = '5-10' | '10-20' | '10-30' | '20-30';

const UMA_MAP: Record<UmaPreset, [number, number, number, number]> = {
  '5-10': [10, 5, -5, -10],
  '10-20': [20, 10, -10, -20],
  '10-30': [30, 10, -10, -30],
  '20-30': [30, 20, -20, -30],
};

const FEE_MODE_LABELS: Record<FeeSplitMode, string> = {
  equal: '均等割り',
  proportional: '負け額に応じて',
  loser: '最下位負担',
};

export function SetupScreen({ onStart, onBack }: SetupScreenProps) {
  const [names, setNames] = useState(['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4']);
  const [ratePreset, setRatePreset] = useState<RatePreset>('50');
  const [customRate, setCustomRate] = useState('');
  const [umaPreset, setUmaPreset] = useState<UmaPreset>('10-20');
  const [oka, setOka] = useState(true);
  const [feeMode, setFeeMode] = useState<FeeSplitMode>('equal');
  const [errors, setErrors] = useState<string[]>([]);

  const handleNameChange = (index: number, value: string) => {
    const next = [...names];
    next[index] = value;
    setNames(next);
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    const trimmed = names.map((n) => n.trim());
    trimmed.forEach((n, i) => {
      if (!n) errs.push(`${i + 1}席の名前が空です`);
    });
    const unique = new Set(trimmed.filter(Boolean));
    if (unique.size < trimmed.filter(Boolean).length) {
      errs.push('同じ名前が2人います');
    }
    if (ratePreset === 'custom') {
      const v = Number(customRate);
      if (!customRate || isNaN(v) || v <= 0) {
        errs.push('レートは1以上で');
      }
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const players: Player[] = names.map((name, i) => ({
      id: `p${i + 1}`,
      name: name.trim() || `プレイヤー${i + 1}`,
    }));

    const ratePer1000 =
      ratePreset === '50' ? 50 : ratePreset === '100' ? 100 : Number(customRate);

    const settings: RuleSettings = {
      ratePer1000,
      uma: UMA_MAP[umaPreset],
      oka,
      startingPoints: 25000,
      returnPoints: 30000,
    };

    onStart(players, settings, 0, feeMode);
  };

  return (
    <div className='screen setup-screen'>
      <div className='screen-header'>
        <button className='btn-back' onClick={onBack} aria-label='戻る'>
          <svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true'>
            <path
              d='M12 4L7 10L12 16'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </button>
        <h2 className='screen-title'>卓の設定</h2>
      </div>

      <div className='setup-body'>
        {/* ── 必須項目グループ（強罫線見出し） ── */}
        {/* プレイヤー名 */}
        <section className='setup-section setup-section-primary'>
          <h3 className='setup-section-title setup-section-title-strong'>プレイヤー名</h3>
          <div className='player-inputs'>
            {names.map((name, i) => (
              <div key={i} className='input-group'>
                <label className='input-label'>{i + 1}席</label>
                <input
                  className='text-input'
                  type='text'
                  value={name}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  maxLength={10}
                  placeholder={`プレイヤー${i + 1}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* レート */}
        <section className='setup-section setup-section-primary'>
          <h3 className='setup-section-title setup-section-title-strong'>レート</h3>
          <div className='segment-group'>
            {(['50', '100', 'custom'] as const).map((preset) => (
              <button
                key={preset}
                className={`segment-btn${ratePreset === preset ? ' active' : ''}`}
                onClick={() => setRatePreset(preset)}
              >
                {preset === '50' ? '点5' : preset === '100' ? '点10' : 'カスタム'}
              </button>
            ))}
          </div>
          {ratePreset === 'custom' && (
            <div className='input-group mt-sm'>
              <label className='input-label'>円/千点</label>
              <input
                className='text-input num-input'
                type='number'
                inputMode='numeric'
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                min='1'
                placeholder='例: 30'
              />
            </div>
          )}
        </section>

        {/* ── ルール詳細グループ（弱罫線・インデント） ── */}
        <div className='setup-rule-details'>
          <h3 className='setup-rule-details-heading'>ルール詳細</h3>

          {/* ウマ */}
          <section className='setup-section setup-section-sub'>
            <h4 className='setup-section-title'>ウマ</h4>
            <div className='segment-group'>
              {(['5-10', '10-20', '10-30', '20-30'] as const).map((preset) => (
                <button
                  key={preset}
                  className={`segment-btn${umaPreset === preset ? ' active' : ''}`}
                  onClick={() => setUmaPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </section>

          {/* オカ */}
          <section className='setup-section setup-section-sub'>
            <h4 className='setup-section-title'>オカ</h4>
            <div className='segment-group'>
              <button
                className={`segment-btn${oka ? ' active' : ''}`}
                onClick={() => setOka(true)}
              >
                あり
              </button>
              <button
                className={`segment-btn${!oka ? ' active' : ''}`}
                onClick={() => setOka(false)}
              >
                なし
              </button>
            </div>
            <p className='setup-section-note'>25000持ち30000返し</p>
          </section>

          {/* 場代分担方式 */}
          <section className='setup-section setup-section-sub'>
            <h4 className='setup-section-title'>場代の分担方式</h4>
            <p className='setup-section-note'>場代金額はゲーム画面の点数表で入力します</p>
            <div className='fee-mode-group'>
              {(['equal', 'proportional', 'loser'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`segment-btn${feeMode === mode ? ' active' : ''}`}
                  onClick={() => setFeeMode(mode)}
                >
                  {FEE_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </section>
        </div>

        {errors.length > 0 && (
          <div className='error-list' role='alert'>
            {errors.map((e, i) => (
              <p key={i} className='error-msg'>
                {e}
              </p>
            ))}
          </div>
        )}

        <button className='btn btn-primary btn-full' onClick={handleSubmit}>
          この設定ではじめる
        </button>
      </div>
    </div>
  );
}
