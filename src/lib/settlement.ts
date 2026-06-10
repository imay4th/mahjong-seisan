import type { HanchanResult, HanchanScores, RuleSettings, FeeSplitMode, Transfer } from '../types.ts';

/**
 * 持ち点の合計と100点単位を検証する。
 * 問題があれば日本語エラーメッセージを返し、問題なければ null を返す。
 */
export function validateScores(
  scores: HanchanScores,
  settings: RuleSettings
): string | null {
  const playerIds = Object.keys(scores);
  const playerCount = playerIds.length;

  for (const id of playerIds) {
    const score = scores[id];
    if (score % 100 !== 0) {
      return `${id} の持ち点 ${score} が100点単位ではありません。`;
    }
  }

  const total = playerIds.reduce((sum, id) => sum + scores[id], 0);
  const expected = settings.startingPoints * playerCount;
  if (total !== expected) {
    return `持ち点の合計 ${total} が基準値 ${expected}（${settings.startingPoints} × ${playerCount}人）と一致しません。`;
  }

  return null;
}

/**
 * 1半荘の清算結果（円収支）を計算する。
 *
 * @param scores - 持ち点マップ（playerId → 点数）
 * @param playerOrder - 席順（同点時の順位決定に使用）
 * @param settings - ルール設定
 * @returns 各プレイヤーの円収支（合計は必ず0）
 */
export function calcHanchan(
  scores: HanchanScores,
  playerOrder: string[],
  settings: RuleSettings
): HanchanResult {
  const { ratePer1000, uma, oka, startingPoints, returnPoints } = settings;

  // 順位付け: 持ち点降順、同点は席順（playerOrder内のインデックスが小さい方が上位）
  const sorted = [...playerOrder].sort((a, b) => {
    const scoreDiff = scores[b] - scores[a];
    if (scoreDiff !== 0) return scoreDiff;
    return playerOrder.indexOf(a) - playerOrder.indexOf(b);
  });

  // okaポイント（千点単位）: oka有りの場合のみ
  const okaBonus = oka ? ((returnPoints - startingPoints) * 4) / 1000 : 0;

  // 基準点: oka有りなら returnPoints、oka無しなら startingPoints
  const basePoint = oka ? returnPoints : startingPoints;

  // 各プレイヤーのポイント（千点単位、小数あり）を計算
  const points: Record<string, number> = {};
  for (let rank = 0; rank < sorted.length; rank++) {
    const id = sorted[rank];
    const base = (scores[id] - basePoint) / 1000;
    const rankBonus = rank === 0 ? okaBonus : 0;
    points[id] = base + rankBonus + uma[rank];
  }

  // 円換算（10円未満は四捨五入）
  const result: HanchanResult = {};
  for (const id of playerOrder) {
    const yen = points[id] * ratePer1000;
    result[id] = Math.round(yen / 10) * 10;
  }

  // ゼロサム保証: 合計が0でない場合は差分を1位の収支で調整
  const total = Object.values(result).reduce((sum, v) => sum + v, 0);
  if (total !== 0) {
    result[sorted[0]] -= total;
  }

  return result;
}

/**
 * 場代の分担額を計算する。
 *
 * @param finalBalances - 各プレイヤーの最終円収支
 * @param totalFee - 場代合計（円）
 * @param mode - 分担方式
 * @param playerOrder - 席順（端数処理・最下位判定に使用）
 * @returns 各プレイヤーの場代負担額（正の整数円、合計は totalFee）
 */
export function calcFeeShare(
  finalBalances: HanchanResult,
  totalFee: number,
  mode: FeeSplitMode,
  playerOrder: string[]
): Record<string, number> {
  const playerCount = playerOrder.length;
  const share: Record<string, number> = {};

  if (mode === 'equal') {
    const base = Math.floor(totalFee / playerCount);
    const remainder = totalFee - base * playerCount;
    for (let i = 0; i < playerCount; i++) {
      share[playerOrder[i]] = base + (i < remainder ? 1 : 0);
    }
    return share;
  }

  if (mode === 'proportional') {
    // マイナス収支のプレイヤーを抽出
    const losers = playerOrder.filter((id) => finalBalances[id] < 0);

    if (losers.length === 0) {
      // 全員0以上 → equal にフォールバック
      return calcFeeShare(finalBalances, totalFee, 'equal', playerOrder);
    }

    const totalLoss = losers.reduce((sum, id) => sum + Math.abs(finalBalances[id]), 0);

    // 比率に応じて分担（小数点以下切り捨て）
    let assigned = 0;
    const loserShares: Record<string, number> = {};
    for (const id of losers) {
      const portion = Math.floor((Math.abs(finalBalances[id]) / totalLoss) * totalFee);
      loserShares[id] = portion;
      assigned += portion;
    }

    // 端数を最大負け額の人が吸収
    const remainder = totalFee - assigned;
    const biggestLoser = losers.reduce((a, b) =>
      Math.abs(finalBalances[a]) >= Math.abs(finalBalances[b]) ? a : b
    );
    loserShares[biggestLoser] += remainder;

    // プラス・ゼロのプレイヤーは0
    for (const id of playerOrder) {
      share[id] = loserShares[id] ?? 0;
    }
    return share;
  }

  // loser: 最小収支のプレイヤーが全額負担（同額なら席順で先の者）
  let loser = playerOrder[0];
  for (const id of playerOrder) {
    if (finalBalances[id] < finalBalances[loser]) {
      loser = id;
    }
  }
  for (const id of playerOrder) {
    share[id] = id === loser ? totalFee : 0;
  }
  return share;
}

/**
 * 複数半荘の収支を合算する。
 */
export function sumResults(results: HanchanResult[]): HanchanResult {
  const total: HanchanResult = {};
  for (const result of results) {
    for (const [id, amount] of Object.entries(result)) {
      total[id] = (total[id] ?? 0) + amount;
    }
  }
  return total;
}

/**
 * 最終収支から最小回数の送金指示を生成する（貪欲法）。
 *
 * @param finalBalances - 各プレイヤーの最終円収支（合計が0であること）
 * @returns 送金指示の配列
 * @throws 合計が0でない場合は Error
 */
export function calcTransfers(finalBalances: HanchanResult): Transfer[] {
  const total = Object.values(finalBalances).reduce((sum, v) => sum + v, 0);
  if (total !== 0) {
    throw new Error(`収支合計が0ではありません（合計: ${total}円）。送金指示を計算できません。`);
  }

  // 可変な残高コピー
  const balances: Record<string, number> = { ...finalBalances };
  const transfers: Transfer[] = [];

  const getMaxDebtor = () =>
    Object.keys(balances).reduce((a, b) => (balances[a] < balances[b] ? a : b));
  const getMaxCreditor = () =>
    Object.keys(balances).reduce((a, b) => (balances[a] > balances[b] ? a : b));

  while (true) {
    const debtor = getMaxDebtor();
    const creditor = getMaxCreditor();

    if (balances[debtor] >= 0) break; // 全員が0以上 → 完了

    const amount = Math.min(Math.abs(balances[debtor]), balances[creditor]);
    if (amount <= 0) break;

    transfers.push({ from: debtor, to: creditor, amount });
    balances[debtor] += amount;
    balances[creditor] -= amount;
  }

  return transfers;
}
