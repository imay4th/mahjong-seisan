import type { HanchanResult, HanchanScores, RuleSettings, FeeSplitMode, Transfer, PersonalExpenseItem } from '../types.ts';

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
 * 五捨六入（千点単位）。
 * 百の位が5以下なら絶対値切り捨て、6以上なら絶対値切り上げ。
 * 例: 25500→25000, 25600→26000, -1500→-1000, -1600→-2000
 */
function roundGoshaRokunyu(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const rem = abs % 1000;
  return sign * (rem <= 500 ? abs - rem : abs - rem + 1000);
}

/**
 * 1半荘の清算結果（整数ポイント）を計算する。
 * 各持ち点を五捨六入で千点単位に丸め、ウマ・オカ込みの整数ポイントを返す。
 *
 * @param scores - 持ち点マップ（playerId → 点数）
 * @param playerOrder - 席順（同点時の順位決定に使用）
 * @param settings - ルール設定
 * @returns 各プレイヤーの整数ポイント収支（合計は必ず0）
 */
export function calcHanchanPoints(
  scores: HanchanScores,
  playerOrder: string[],
  settings: RuleSettings
): HanchanResult {
  const { uma, oka, startingPoints, returnPoints } = settings;

  // 順位付け: 持ち点降順、同点は席順（playerOrder内のインデックスが小さい方が上位）
  const sorted = [...playerOrder].sort((a, b) => {
    const scoreDiff = scores[b] - scores[a];
    if (scoreDiff !== 0) return scoreDiff;
    return playerOrder.indexOf(a) - playerOrder.indexOf(b);
  });

  // okaポイント（千点単位整数）: oka有りの場合のみ
  const okaBonus = oka ? ((returnPoints - startingPoints) * 4) / 1000 : 0;

  // 基準点: oka有りなら returnPoints、oka無しなら startingPoints
  const basePoint = oka ? returnPoints : startingPoints;

  // a. 五捨六入で千点単位に丸める
  const rounded: Record<string, number> = {};
  for (const id of playerOrder) {
    rounded[id] = roundGoshaRokunyu(scores[id]);
  }

  // b. base = (丸め後 - basePoint) / 1000
  // c. オカボーナス（トップのみ）・ウマを加算（すべて整数）
  const points: HanchanResult = {};
  for (let rank = 0; rank < sorted.length; rank++) {
    const id = sorted[rank];
    const base = (rounded[id] - basePoint) / 1000;
    const rankBonus = rank === 0 ? okaBonus : 0;
    points[id] = base + rankBonus + uma[rank];
  }

  // d. 合計≠0 ならトップ sorted[0] から差分を引いてゼロサム化
  const total = Object.values(points).reduce((sum, v) => sum + v, 0);
  if (total !== 0) {
    points[sorted[0]] -= total;
  }

  return points;
}

/**
 * 1半荘の清算結果（円収支）を計算する。
 * calcHanchanPoints で整数ポイントを算出し、ratePer1000 で円換算する。
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
  const { ratePer1000 } = settings;

  // ポイントを整数で算出し、円換算する（ポイントが整数ゼロサムなので円も厳密ゼロサム）
  const points = calcHanchanPoints(scores, playerOrder, settings);
  const result: HanchanResult = {};
  for (const id of playerOrder) {
    result[id] = points[id] * ratePer1000;
  }

  return result;
}

/**
 * 場代立替清算を含む最終収支を計算する。
 *
 * @param mahjongYen - 麻雀の円収支（calcHanchan の結果）
 * @param feeShare - 場代の各自負担額（null の場合はゼロ扱い）
 * @param personalExpenses - 個人分費用: playerId → 円
 * @param feePayerId - 場代を立替えたプレイヤーID（未選択なら null）
 * @param totalFee - 場代合計（円）
 * @param playerOrder - 席順
 * @returns 各プレイヤーの最終円収支（合計は必ず0）
 * @throws 合計が0でない場合は Error
 */
export function calcNetBalances(
  mahjongYen: HanchanResult,
  feeShare: Record<string, number> | null,
  personalExpenses: Record<string, number>,
  feePayerId: string | null,
  totalFee: number,
  playerOrder: string[]
): HanchanResult {
  // 個人分合計
  const personalTotal = playerOrder.reduce(
    (sum, id) => sum + (personalExpenses[id] ?? 0),
    0
  );

  // feePayerId が null、または（totalFee===0 かつ 個人分全0）の場合はそのまま返す
  if (feePayerId === null || (totalFee === 0 && personalTotal === 0)) {
    return { ...mahjongYen };
  }

  // 各自: 麻雀収支 - 場代負担 - 個人分費用
  const result: HanchanResult = {};
  for (const id of playerOrder) {
    result[id] =
      (mahjongYen[id] ?? 0) -
      (feeShare?.[id] ?? 0) -
      (personalExpenses[id] ?? 0);
  }

  // 立替者には場代合計と個人分合計を加算（立替分の回収）
  result[feePayerId] += totalFee + personalTotal;

  // ゼロサムガード
  const total = Object.values(result).reduce((sum, v) => sum + v, 0);
  if (total !== 0) {
    throw new Error(
      `最終収支の合計が0ではありません（合計: ${total}円）。入力値を確認してください。`
    );
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
 * 複数の個人分費用明細を合算し、プレイヤーごとの負担額を返す。
 *
 * @param items - 個人分費用明細リスト
 * @param playerOrder - 集計対象のプレイヤーIDリスト（このID以外のキーは結果に含めない）
 * @returns playerId → 合計負担額（playerOrder に含まれるIDのみ。値がなければ0）
 */
export function sumPersonalExpenseItems(
  items: PersonalExpenseItem[],
  playerOrder: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  // playerOrder に含まれるIDのみ初期化
  for (const id of playerOrder) {
    result[id] = 0;
  }
  for (const item of items) {
    for (const id of playerOrder) {
      result[id] += item.amounts[id] ?? 0;
    }
  }
  return result;
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
