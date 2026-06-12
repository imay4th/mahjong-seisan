import type { GameState } from '../types.ts';
import {
  calcHanchan,
  calcFeeShare,
  sumResults,
  calcTransfers,
  calcNetBalances,
  validateScores,
  sumPersonalExpenseItems,
} from '../lib/settlement.ts';

interface SettlementScreenProps {
  gameState: GameState;
  onBack: () => void;
  onNewGame: () => void;
  /** 場代立替者を選択するコールバック（未指定時は選択UIを非表示） */
  onSetFeePayerId?: (id: string | null) => void;
  /** 場代立替者の保存に失敗したときのエラーメッセージ */
  feePayerSaveError?: string | null;
}

export function SettlementScreen({
  gameState,
  onBack,
  onNewGame,
  onSetFeePayerId,
  feePayerSaveError,
}: SettlementScreenProps) {
  const { players, settings, totalFee, feeMode, hanchans, personalExpenseItems, feePayerId } =
    gameState;
  const playerOrder = players.map((p) => p.id);
  const personalExpenses = sumPersonalExpenseItems(personalExpenseItems, playerOrder);

  // 有効な半荘のみで麻雀収支（円）を計算（バリデーション失敗行は除外）
  const validHanchanResults = hanchans
    .filter((scores) => validateScores(scores, settings) === null)
    .map((scores) => calcHanchan(scores, playerOrder, settings));
  const mahjongResult = sumResults(validHanchanResults);

  // 場代負担（麻雀円収支を基準に計算）
  const feeShare =
    totalFee > 0
      ? calcFeeShare(mahjongResult, totalFee, feeMode, playerOrder)
      : null;

  // 個人分合計
  const personalTotal = playerOrder.reduce(
    (sum, id) => sum + (personalExpenses[id] ?? 0),
    0,
  );

  // 場代・個人分の有無
  const hasFeeOrPersonal = totalFee > 0 || personalTotal > 0;

  // 最終収支: 立替者選択済みかつ場代・個人分あり → calcNetBalances、それ以外は麻雀収支のまま
  const netBalances =
    hasFeeOrPersonal && feePayerId
      ? calcNetBalances(
          mahjongResult,
          feeShare,
          personalExpenses,
          feePayerId,
          totalFee,
          playerOrder,
        )
      : mahjongResult;

  // プレイヤー間送金（最終収支から計算）
  const transfers = calcTransfers(netBalances);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  // 内訳用: 立替者が選択されていない場合の表示用最終収支
  // （従来の 麻雀収支 − 場代負担 − 個人分 を行として見せる）
  const finalResultForBreakdown: Record<string, number> = {};
  for (const p of players) {
    const mahjong = mahjongResult[p.id] ?? 0;
    const fee = feeShare ? (feeShare[p.id] ?? 0) : 0;
    const personal = personalExpenses[p.id] ?? 0;
    finalResultForBreakdown[p.id] = mahjong - fee - personal;
  }
  // 立替者選択済みの場合は netBalances を使う
  const breakdownFinal = hasFeeOrPersonal && feePayerId ? netBalances : finalResultForBreakdown;

  return (
    <div className='screen settlement-screen'>
      <div className='screen-header'>
        <h2 className='screen-title'>清算結果</h2>
      </div>

      {/* 収支のうちわけ: <details> デフォルト展開・最上部配置 */}
      <details className='result-details' open>
        <summary className='result-details-summary'>うちわけ</summary>
        <div className='result-card'>
          <div className='result-table'>
            <div className='result-header'>
              <span></span>
              {players.map((p) => (
                <span key={p.id} className='result-col-head'>
                  {p.name}
                </span>
              ))}
            </div>

            <div className='result-row'>
              <span className='result-row-label'>麻雀収支</span>
              {players.map((p) => {
                const v = mahjongResult[p.id] ?? 0;
                return (
                  <span
                    key={p.id}
                    className={`result-val ${v >= 0 ? 'val-plus' : 'val-minus'}`}
                  >
                    {v >= 0 ? '+' : ''}
                    {v.toLocaleString()}
                  </span>
                );
              })}
            </div>

            {feeShare && (
              <div className='result-row'>
                <span className='result-row-label'>場代負担</span>
                {players.map((p) => {
                  const v = feeShare[p.id] ?? 0;
                  return (
                    <span key={p.id} className='result-val val-fee'>
                      -{v.toLocaleString()}
                    </span>
                  );
                })}
              </div>
            )}

            {players.some((p) => (personalExpenses[p.id] ?? 0) > 0) && (
              <div className='result-row'>
                <span className='result-row-label'>個人分</span>
                {players.map((p) => {
                  const v = personalExpenses[p.id] ?? 0;
                  return (
                    <span key={p.id} className='result-val val-fee'>
                      {v > 0 ? `-${v.toLocaleString()}` : '—'}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 立替者選択済みの場合は立替回収行を表示 */}
            {feePayerId && hasFeeOrPersonal && (
              <div className='result-row'>
                <span className='result-row-label'>立替回収</span>
                {players.map((p) => {
                  const v = p.id === feePayerId ? totalFee + personalTotal : 0;
                  return (
                    <span key={p.id} className='result-val val-plus'>
                      {v > 0 ? `+${v.toLocaleString()}` : '—'}
                    </span>
                  );
                })}
              </div>
            )}

            <div className='result-row result-final'>
              <span className='result-row-label'>最終収支</span>
              {players.map((p) => {
                const v = breakdownFinal[p.id] ?? 0;
                return (
                  <span
                    key={p.id}
                    className={`result-val result-val-final ${v >= 0 ? 'val-plus' : 'val-minus'}`}
                  >
                    {v >= 0 ? '+' : ''}
                    {v.toLocaleString()}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </details>

      {/* 送金（伝票ヒーロー） */}
      <div className='transfers-card transfers-card-hero'>
        <h3 className='transfers-title'>精算 — だれがだれに</h3>
        {transfers.length === 0 ? (
          <p className='transfers-empty'>貸し借りなし。きれいに終局</p>
        ) : (
          <div className='transfers-list'>
            {transfers.map((t, i) => (
              <div key={i} className='transfer-item'>
                {/* 名前行: 送金元 ──→ 受取人 */}
                <div className='transfer-parties'>
                  <span className='transfer-from'>{playerName(t.from)}</span>
                  <span className='transfer-line' aria-hidden='true'>
                    <svg
                      className='transfer-arrow-svg'
                      viewBox='0 0 32 14'
                      fill='none'
                      preserveAspectRatio='none'
                    >
                      <line
                        x1='0'
                        y1='7'
                        x2='26'
                        y2='7'
                        stroke='currentColor'
                        strokeWidth='1.5'
                      />
                      <path
                        d='M22 2L29 7L22 12'
                        stroke='currentColor'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </span>
                  <span className='transfer-to'>{playerName(t.to)}</span>
                </div>
                {/* 金額: 主役・右揃え */}
                <div className='transfer-amount-row'>
                  <span className='transfer-amount transfer-amount-hero'>
                    {t.amount.toLocaleString()}
                    <span className='transfer-amount-unit'>円</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 場代立替者選択（場代・個人分がある場合のみ表示） */}
      {hasFeeOrPersonal && (
        <div className='fee-card'>
          <h3 className='fee-card-title'>店への支払い</h3>

          {/* 立替者選択ボタン群 */}
          {onSetFeePayerId && (
            <div className='fee-payer-select'>
              <p className='fee-payer-label'>場代を払う人</p>
              <div className='fee-payer-btns'>
                {players.map((p) => {
                  const isSelected = feePayerId === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`segment-btn fee-payer-btn${isSelected ? ' active' : ''}`}
                      onClick={() => onSetFeePayerId(isSelected ? null : p.id)}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 保存失敗時のエラー表示 */}
          {feePayerSaveError && (
            <p className='fee-payer-error' role='alert'>
              {feePayerSaveError}
            </p>
          )}

          {/* 未選択時の注記 */}
          {!feePayerId && (
            <p className='fee-payer-note'>
              場代を払う人を選ぶと、立替分を含めた送金額になります（現在は麻雀収支のみ）
            </p>
          )}

          {/* 選択済み: 立替者が店に払う合計カード */}
          {feePayerId && (
            <div className='fee-payer-summary'>
              <span className='fee-payer-summary-name'>{playerName(feePayerId)}さんが店に払う</span>
              <div className='fee-payer-summary-amount'>
                <span className='fee-payer-total'>
                  ¥{(totalFee + personalTotal).toLocaleString()}
                </span>
                <span className='fee-payer-breakdown'>
                  場代 ¥{totalFee.toLocaleString()}
                  {personalTotal > 0 && ` ＋ 飲食 ¥${personalTotal.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className='settlement-actions'>
        <button className='btn btn-secondary' onClick={onBack}>
          ゲームに戻る
        </button>
        <button className='btn btn-primary' onClick={onNewGame}>
          新しい卓へ
        </button>
      </div>
    </div>
  );
}
