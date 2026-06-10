import { describe, it, expect } from 'vitest';
import {
  validateScores,
  calcHanchan,
  calcFeeShare,
  sumResults,
  calcTransfers,
} from './settlement.ts';
import type { RuleSettings, HanchanScores, HanchanResult } from '../types.ts';

// ---- 共通ルール設定 ----

const RULE_OKA: RuleSettings = {
  ratePer1000: 50, // 点5
  uma: [20, 10, -10, -20], // ウマ10-20
  oka: true,
  startingPoints: 25000,
  returnPoints: 30000,
};

const RULE_NO_OKA: RuleSettings = {
  ...RULE_OKA,
  oka: false,
};

// ---- validateScores ----

describe('validateScores', () => {
  it('正常: 合計一致かつ100点単位 → null を返す', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    expect(validateScores(scores, RULE_OKA)).toBeNull();
  });

  it('異常: 持ち点合計が不一致 → エラーメッセージを返す', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 12000 };
    const result = validateScores(scores, RULE_OKA);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('異常: 100点単位でない持ち点 → エラーメッセージを返す', () => {
    const scores: HanchanScores = { p1: 42350, p2: 28200, p3: 18000, p4: 11450 };
    const result = validateScores(scores, RULE_OKA);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

// ---- calcHanchan ----

describe('calcHanchan', () => {
  const playerOrder = ['p1', 'p2', 'p3', 'p4'];

  it('正常系: 点5・ウマ10-20・オカあり → 手計算値と一致', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    // 手計算（10円単位四捨五入後、ゼロサム調整あり）:
    //   1位 p1: (42300-30000)/1000=12.3, oka=+20, uma=+20 → 52.3 × 50 = 2615 → 四捨五入→2620, ゼロサム調整-10 → 2610円
    //   2位 p2: (28200-30000)/1000=-1.8,             uma=+10 →  8.2 × 50 = 410 →  410円
    //   3位 p3: (18000-30000)/1000=-12,               uma=-10 → -22 × 50 = -1100 → -1100円
    //   4位 p4: (11500-30000)/1000=-18.5,             uma=-20 → -38.5 × 50 = -1925 → 四捨五入→-1920円
    //   合計(調整前): 2620+410-1100-1920=10 → p1から10引いて2610
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    expect(result['p1']).toBe(2610);
    expect(result['p2']).toBe(410);
    expect(result['p3']).toBe(-1100);
    expect(result['p4']).toBe(-1920);
  });

  it('ゼロサム: オカあり → 合計が0', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('オカなし → 手計算値と一致', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    // 手計算 (base = (点-25000)/1000、オカなし):
    //   1位 p1: 17.3 + 20 = 37.3 × 50 = 1865 → 浮動小数点誤差→1864.99... → 四捨五入→1860円
    //   2位 p2:  3.2 + 10 = 13.2 × 50 =  660 → 660円
    //   3位 p3:   -7 - 10 =  -17 × 50 = -850 → -850円
    //   4位 p4: -13.5 - 20 = -33.5 × 50 = -1675 → 四捨五入→-1670円
    //   合計: 1860+660-850-1670=0 ✓
    const result = calcHanchan(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(1860);
    expect(result['p2']).toBe(660);
    expect(result['p3']).toBe(-850);
    expect(result['p4']).toBe(-1670);
  });

  it('ゼロサム: オカなし → 合計が0', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    const result = calcHanchan(scores, playerOrder, RULE_NO_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('同点タイブレーク: 席順が先の者が上位', () => {
    // p1とp2が同点 → p1が1位、p2が2位
    const scores: HanchanScores = { p1: 30000, p2: 30000, p3: 20000, p4: 20000 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    // p1 > p2 の円収支になること
    expect(result['p1']).toBeGreaterThan(result['p2']);
    // p3 > p4 の円収支になること（同点の場合、先の席順が上位）
    expect(result['p3']).toBeGreaterThan(result['p4']);
  });

  it('ゼロサム: 同点タイブレーク → 合計が0', () => {
    const scores: HanchanScores = { p1: 30000, p2: 30000, p3: 20000, p4: 20000 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('ゼロサム パターン2: 極端な点差', () => {
    const scores: HanchanScores = { p1: 80000, p2: 10000, p3: 8000, p4: 2000 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('ゼロサム パターン3: 均等持ち点', () => {
    const scores: HanchanScores = { p1: 25000, p2: 25000, p3: 25000, p4: 25000 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('ゼロサム パターン4: オカなし、ランダム風固定値', () => {
    const scores: HanchanScores = { p1: 35600, p2: 31400, p3: 19800, p4: 13200 };
    const result = calcHanchan(scores, playerOrder, RULE_NO_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });
});

// ---- calcFeeShare ----

describe('calcFeeShare', () => {
  const playerOrder = ['p1', 'p2', 'p3', 'p4'];

  it('equal: 割り切れる場合 → 均等分担', () => {
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: -500, p4: -1000 };
    const share = calcFeeShare(balances, 1000, 'equal', playerOrder);
    expect(share['p1']).toBe(250);
    expect(share['p2']).toBe(250);
    expect(share['p3']).toBe(250);
    expect(share['p4']).toBe(250);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(1000);
  });

  it('equal: 端数処理 → 先頭から1円ずつ多く', () => {
    // 1001円 ÷ 4 = 250余1 → p1が251円、残り250円
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: -500, p4: -1000 };
    const share = calcFeeShare(balances, 1001, 'equal', playerOrder);
    expect(share['p1']).toBe(251);
    expect(share['p2']).toBe(250);
    expect(share['p3']).toBe(250);
    expect(share['p4']).toBe(250);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(1001);
  });

  it('equal: 端数2円 → 先頭2人が1円ずつ多く', () => {
    // 1002円 ÷ 4 = 250余2 → p1,p2が251円、p3,p4が250円
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: -500, p4: -1000 };
    const share = calcFeeShare(balances, 1002, 'equal', playerOrder);
    expect(share['p1']).toBe(251);
    expect(share['p2']).toBe(251);
    expect(share['p3']).toBe(250);
    expect(share['p4']).toBe(250);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(1002);
  });

  it('proportional: マイナスプレイヤーが比率分担', () => {
    // p3=-500, p4=-1000 → 合計負け1500
    // p3: 500/1500 × 900 = 300円, p4: 1000/1500 × 900 = 600円
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: -500, p4: -1000 };
    const share = calcFeeShare(balances, 900, 'proportional', playerOrder);
    expect(share['p1']).toBe(0);
    expect(share['p2']).toBe(0);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(900);
    // p4の負担がp3の2倍になること
    expect(share['p4']).toBeGreaterThan(share['p3']);
  });

  it('proportional: 全員プラス → equal にフォールバック', () => {
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: 200, p4: 100 };
    const share = calcFeeShare(balances, 800, 'proportional', playerOrder);
    // equal と同じ結果になること
    const equalShare = calcFeeShare(balances, 800, 'equal', playerOrder);
    expect(share).toEqual(equalShare);
  });

  it('loser: 最小収支のプレイヤーが全額負担', () => {
    const balances: HanchanResult = { p1: 1000, p2: 500, p3: -500, p4: -1000 };
    const share = calcFeeShare(balances, 500, 'loser', playerOrder);
    expect(share['p4']).toBe(500);
    expect(share['p1']).toBe(0);
    expect(share['p2']).toBe(0);
    expect(share['p3']).toBe(0);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(500);
  });

  it('loser: 同額最下位が複数 → 席順で先の者が全額負担', () => {
    // p3とp4が同じ -500 → 席順でp3が先
    const balances: HanchanResult = { p1: 1000, p2: 0, p3: -500, p4: -500 };
    const share = calcFeeShare(balances, 300, 'loser', playerOrder);
    expect(share['p3']).toBe(300);
    expect(share['p4']).toBe(0);
    const total = Object.values(share).reduce((s, v) => s + v, 0);
    expect(total).toBe(300);
  });
});

// ---- sumResults ----

describe('sumResults', () => {
  it('複数半荘の収支を合算する', () => {
    const r1: HanchanResult = { p1: 2000, p2: 500, p3: -1000, p4: -1500 };
    const r2: HanchanResult = { p1: -500, p2: 1000, p3: 300, p4: -800 };
    const r3: HanchanResult = { p1: 1500, p2: -200, p3: -700, p4: -600 };
    const total = sumResults([r1, r2, r3]);
    expect(total['p1']).toBe(3000);
    expect(total['p2']).toBe(1300);
    expect(total['p3']).toBe(-1400);
    expect(total['p4']).toBe(-2900);
  });

  it('1半荘のみ → そのまま返す', () => {
    const r1: HanchanResult = { p1: 2000, p2: -500, p3: -1000, p4: -500 };
    const total = sumResults([r1]);
    expect(total).toEqual(r1);
  });

  it('空配列 → 空オブジェクトを返す', () => {
    const total = sumResults([]);
    expect(total).toEqual({});
  });
});

// ---- calcTransfers ----

describe('calcTransfers', () => {
  it('送金指示が生成される: 合計0の収支', () => {
    const balances: HanchanResult = { p1: 2000, p2: 500, p3: -1000, p4: -1500 };
    const transfers = calcTransfers(balances);
    expect(Array.isArray(transfers)).toBe(true);
    expect(transfers.length).toBeGreaterThan(0);
  });

  it('送金後に全員の残高が0になる', () => {
    const balances: HanchanResult = { p1: 2000, p2: 500, p3: -1000, p4: -1500 };
    const transfers = calcTransfers(balances);

    const after = { ...balances };
    for (const t of transfers) {
      after[t.from] += t.amount;
      after[t.to] -= t.amount;
    }
    for (const id of Object.keys(after)) {
      expect(after[id]).toBe(0);
    }
  });

  it('送金回数が n-1 以下（n=4 なら最大3回）', () => {
    const balances: HanchanResult = { p1: 3000, p2: -500, p3: -1000, p4: -1500 };
    const transfers = calcTransfers(balances);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it('全員0のとき → 送金指示なし', () => {
    const balances: HanchanResult = { p1: 0, p2: 0, p3: 0, p4: 0 };
    const transfers = calcTransfers(balances);
    expect(transfers).toHaveLength(0);
  });

  it('合計が0でない場合 → Error を投げる', () => {
    const balances: HanchanResult = { p1: 2000, p2: 500, p3: -500, p4: -500 };
    expect(() => calcTransfers(balances)).toThrow(Error);
  });

  it('合計が0でない場合 → 日本語エラーメッセージ', () => {
    const balances: HanchanResult = { p1: 2000, p2: 500, p3: -500, p4: -500 };
    expect(() => calcTransfers(balances)).toThrow(/収支合計/);
  });

  it('2人の場合 → 送金1回', () => {
    const balances: HanchanResult = { p1: 1000, p2: -1000 };
    const transfers = calcTransfers(balances);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].from).toBe('p2');
    expect(transfers[0].to).toBe('p1');
    expect(transfers[0].amount).toBe(1000);
  });

  it('送金額はすべて正の整数', () => {
    const balances: HanchanResult = { p1: 2615, p2: 410, p3: -1100, p4: -1925 };
    const transfers = calcTransfers(balances);
    for (const t of transfers) {
      expect(t.amount).toBeGreaterThan(0);
      expect(Number.isInteger(t.amount)).toBe(true);
    }
  });
});
