import type { GameState } from '../types.ts';
import {
  calcHanchan,
  calcFeeShare,
  sumResults,
  calcTransfers,
} from '../lib/settlement.ts';

interface SettlementScreenProps {
  gameState: GameState;
  onBack: () => void;
  onNewGame: () => void;
}

export function SettlementScreen({
  gameState,
  onBack,
  onNewGame,
}: SettlementScreenProps) {
  const { players, settings, totalFee, feeMode, hanchans } = gameState;
  const playerOrder = players.map((p) => p.id);

  // 麻雀収支（合計0）
  const hanchanResults = hanchans.map((scores) =>
    calcHanchan(scores, playerOrder, settings),
  );
  const mahjongResult = sumResults(hanchanResults);

  // 場代負担（麻雀収支を基準に計算）
  const feeShare =
    totalFee > 0
      ? calcFeeShare(mahjongResult, totalFee, feeMode, playerOrder)
      : null;

  // 最終収支（麻雀収支 − 場代負担）
  const finalResult: Record<string, number> = {};
  for (const p of players) {
    const mahjong = mahjongResult[p.id] ?? 0;
    const fee = feeShare ? (feeShare[p.id] ?? 0) : 0;
    finalResult[p.id] = mahjong - fee;
  }

  // プレイヤー間送金: 麻雀収支（合計0）から計算
  const transfers = calcTransfers(mahjongResult);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  return (
    <div className='screen settlement-screen'>
      <div className='screen-header'>
        <h2 className='screen-title'>清算結果</h2>
      </div>

      {/* 最終結果表 */}
      <div className='result-card'>
        <h3 className='result-card-title'>収支内訳</h3>
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

          <div className='result-row result-final'>
            <span className='result-row-label'>最終収支</span>
            {players.map((p) => {
              const v = finalResult[p.id] ?? 0;
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

      {/* 場代別枠（各自が店に払う額） */}
      {feeShare && totalFee > 0 && (
        <div className='fee-card'>
          <h3 className='fee-card-title'>各自の場代（店に払う額）</h3>
          <div className='fee-list'>
            {players.map((p) => {
              const v = feeShare[p.id] ?? 0;
              return (
                <div key={p.id} className='fee-item'>
                  <span className='fee-name'>{p.name}</span>
                  <span className='fee-amount'>{v.toLocaleString()}円</span>
                </div>
              );
            })}
            <div className='fee-total'>
              <span>合計</span>
              <span>{totalFee.toLocaleString()}円</span>
            </div>
          </div>
        </div>
      )}

      {/* 送金指示 */}
      <div className='transfers-card'>
        <h3 className='transfers-title'>送金指示</h3>
        {transfers.length === 0 ? (
          <p className='transfers-empty'>送金なし（全員±0）</p>
        ) : (
          <div className='transfers-list'>
            {transfers.map((t, i) => (
              <div key={i} className='transfer-item'>
                <span className='transfer-from'>{playerName(t.from)}</span>
                <span className='transfer-arrow'>→</span>
                <span className='transfer-to'>{playerName(t.to)}</span>
                <span className='transfer-amount'>
                  {t.amount.toLocaleString()}円
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='settlement-actions'>
        <button className='btn btn-secondary' onClick={onBack}>
          ゲームに戻る
        </button>
        <button className='btn btn-primary' onClick={onNewGame}>
          新しいゲームを始める
        </button>
      </div>
    </div>
  );
}
