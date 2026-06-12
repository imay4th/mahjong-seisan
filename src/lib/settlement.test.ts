import { describe, it, expect } from 'vitest';
import {
  validateScores,
  calcHanchan,
  calcHanchanPoints,
  calcNetBalances,
  calcFeeShare,
  sumResults,
  calcTransfers,
  sumPersonalExpenseItems,
} from './settlement.ts';
import type { RuleSettings, HanchanScores, HanchanResult, PersonalExpenseItem } from '../types.ts';

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
    // 五捨六入: 42300→42000, 28200→28000, 18000→18000, 11500→11000
    // base(30000): p1=(42000-30000)/1000=12, p2=-2, p3=-12, p4=-19
    // okaBonus=(30000-25000)*4/1000=20
    // ポイント: p1=12+20+20=52, p2=-2+10=8, p3=-12-10=-22, p4=-19-20=-39
    // 合計=52+8-22-39=-1 → p1から引く: 53/8/-22/-39
    // 円換算(×50): p1=2650, p2=400, p3=-1100, p4=-1950
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    expect(result['p1']).toBe(2650);
    expect(result['p2']).toBe(400);
    expect(result['p3']).toBe(-1100);
    expect(result['p4']).toBe(-1950);
  });

  it('ゼロサム: オカあり → 合計が0', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    const result = calcHanchan(scores, playerOrder, RULE_OKA);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
  });

  it('オカなし → 手計算値と一致', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    // 五捨六入: 42300→42000, 28200→28000, 18000→18000, 11500→11000
    // base(25000): p1=(42000-25000)/1000=17, p2=3, p3=-7, p4=-14
    // ポイント: p1=17+20=37, p2=3+10=13, p3=-7-10=-17, p4=-14-20=-34
    // 合計=37+13-17-34=-1 → p1から引く: 38/13/-17/-34
    // 円換算(×50): p1=1900, p2=650, p3=-850, p4=-1700
    const result = calcHanchan(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(1900);
    expect(result['p2']).toBe(650);
    expect(result['p3']).toBe(-850);
    expect(result['p4']).toBe(-1700);
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

// ---- calcHanchanPoints ----

describe('calcHanchanPoints', () => {
  const playerOrder = ['p1', 'p2', 'p3', 'p4'];

  // P-01: オカあり 42300/28200/18000/11500
  it('P-01: オカあり 42300/28200/18000/11500 → 53/8/-22/-39', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    // 五捨六入: 42300→42000(300≤500切捨), 28200→28000(200≤500切捨),
    //           18000→18000(0≤500切捨), 11500→11000(500≤500切捨)
    // base(30000): p1=12, p2=-2, p3=-12, p4=-19
    // okaBonus=20, ウマ=[20,10,-10,-20]
    // ポイント: p1=12+20+20=52, p2=-2+10=8, p3=-12-10=-22, p4=-19-20=-39
    // 合計=-1 → p1: 52-(-1)=53 → 53/8/-22/-39 合計=0
    const result = calcHanchanPoints(scores, playerOrder, RULE_OKA);
    expect(result['p1']).toBe(53);
    expect(result['p2']).toBe(8);
    expect(result['p3']).toBe(-22);
    expect(result['p4']).toBe(-39);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-02: オカなし 42300/28200/18000/11500
  it('P-02: オカなし 42300/28200/18000/11500 → 38/13/-17/-34', () => {
    const scores: HanchanScores = { p1: 42300, p2: 28200, p3: 18000, p4: 11500 };
    // 五捨六入後: 42000/28000/18000/11000
    // base(25000): p1=17, p2=3, p3=-7, p4=-14
    // ウマ=[20,10,-10,-20]: p1=17+20=37, p2=3+10=13, p3=-7-10=-17, p4=-14-20=-34
    // 合計=-1 → p1: 37-(-1)=38 → 38/13/-17/-34 合計=0
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(38);
    expect(result['p2']).toBe(13);
    expect(result['p3']).toBe(-17);
    expect(result['p4']).toBe(-34);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-03: オカなし 全員25000 → ウマのみ
  it('P-03: オカなし 全員25000 → +20/+10/-10/-20（ウマのみ、席順タイブレーク）', () => {
    const scores: HanchanScores = { p1: 25000, p2: 25000, p3: 25000, p4: 25000 };
    // 五捨六入後: 全員25000 (500≤500 → 切り捨て = 25000)
    // base(25000): 全員0
    // ウマ=[20,10,-10,-20]: 席順タイブレークで p1>p2>p3>p4
    // ポイント: 0+20=20, 0+10=10, 0-10=-10, 0-20=-20 合計=0
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(20);
    expect(result['p2']).toBe(10);
    expect(result['p3']).toBe(-10);
    expect(result['p4']).toBe(-20);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-04: 任意スコアで合計=0
  it('P-04: 35000/30000/20000/15000（合計100000）で合計=0', () => {
    const scores: HanchanScores = { p1: 35000, p2: 30000, p3: 20000, p4: 15000 };
    // 五捨六入後: 35000/30000/20000/15000（端数なし）
    // base(25000,オカなし): 10/5/-5/-10
    // ウマ=[20,10,-10,-20]: p1=30, p2=15, p3=-15, p4=-30 合計=0
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-05: 五捨六入境界テスト（calcHanchanPoints 経由で検証）
  it('P-05: 五捨六入境界 25500→25000, 25600→26000', () => {
    // 25500(rem=500≤500→切捨=25000), 25600(rem=600>500→切上=26000),
    // 22900(rem=900>500→切上=23000), 26000(rem=0→切捨=26000)
    // 合計=25500+25600+22900+26000=100000 ✓
    const scores: HanchanScores = { p1: 25500, p2: 25600, p3: 22900, p4: 26000 };
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    // 順位付けは元のscores（丸め前）で比較: p4=26000 > p2=25600 > p1=25500 > p3=22900
    // sorted=[p4,p2,p1,p3]
    // 丸め後: p4=26000, p2=26000, p1=25000, p3=23000
    // base(25000): p4=1, p2=1, p1=0, p3=-2  合計=0 → 調整なし
    // ウマ=[20,10,-10,-20]: p4=1+20=21, p2=1+10=11, p1=0-10=-10, p3=-2-20=-22 合計=0
    expect(result['p4']).toBe(21);
    expect(result['p2']).toBe(11);
    expect(result['p1']).toBe(-10);
    expect(result['p3']).toBe(-22);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-06: 負の持ち点の五捨六入
  it('P-06: 負の持ち点 −1500→−1000, −1600→−2000 を含むスコアセット', () => {
    // スコア: p1=102000(合計100000に合わせる), p2=1600, p3=1500, p4=-5100
    // 合計=102000+1600+1500-5100=100000 ✓
    // 五捨六入: p1=102000(rem=0→102000), p2=1600(rem=600>500→2000),
    //           p3=1500(rem=500≤500→1000), p4=-5100(abs=5100,rem=100≤500→abs-100=5000,sign*(-5000))
    // 丸め: p1=102000, p2=2000, p3=1000, p4=-5000
    // base(25000,オカなし): p1=77, p2=-23, p3=-24, p4=-30
    // 順位: p1>p2>p3>p4（降順）
    // ウマ: p1=77+20=97, p2=-23+10=-13, p3=-24-10=-34, p4=-30-20=-50
    // 合計=97-13-34-50=0 ✓
    const scores: HanchanScores = { p1: 102000, p2: 1600, p3: 1500, p4: -5100 };
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(97);
    expect(result['p2']).toBe(-13);
    expect(result['p3']).toBe(-34);
    expect(result['p4']).toBe(-50);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-07: トップ調整（丸めで和が+1になるケース）
  it('P-07: 丸めで和が+1になるケースでトップが差分吸収し合計=0', () => {
    // 意図的に +1 になるスコアを作る
    // 全員31600(合計=126400, 4人基準=100000でNG) → 4人合計100000に調整
    // p1=32600(→33000), p2=29400(→29000), p3=21400(→21000), p4=16600(→17000)
    // 合計元: 32600+29400+21400+16600=100000 ✓
    // 丸め後: 33000+29000+21000+17000=100000
    // base(25000,オカなし): 8/4/-4/-8 合計=0 → 調整なし
    // だがこれは和=0なのでトップ調整は起きない
    // 和が+1になるケース: p1=31600(→32000)、残りで合計100000
    // p1=31600, p2=29000, p3=22000, p4=17400
    // 合計=31600+29000+22000+17400=100000 ✓
    // 丸め: p1=32000(600>500→切上), p2=29000, p3=22000, p4=17000(400≤500→切捨)
    // 丸め合計=32000+29000+22000+17000=100000
    // base(25000): 7/4/-3/-8 合計=0
    // ウマ: 27/14/-13/-28 合計=0 → 調整不要
    // 和が-1になるケース: p1=31500(→31000, 500≤500切捨)
    // p1=31500, p2=29000, p3=22000, p4=17500
    // 合計=31500+29000+22000+17500=100000 ✓
    // 丸め: p1=31000, p2=29000, p3=22000, p4=17000(500切捨→17000)
    // base: 6/4/-3/-8 合計=-1 → p1(トップ)から-(-1)=+1: p1=7
    // ウマ: p1=7+20=27, p2=4+10=14, p3=-3-10=-13, p4=-8-20=-28 合計=0
    const scores: HanchanScores = { p1: 31500, p2: 29000, p3: 22000, p4: 17500 };
    const result = calcHanchanPoints(scores, playerOrder, RULE_NO_OKA);
    expect(result['p1']).toBe(27);
    expect(result['p2']).toBe(14);
    expect(result['p3']).toBe(-13);
    expect(result['p4']).toBe(-28);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // P-08: 同点タイブレーク（丸め後同点は playerOrder の席順が先が上位）
  it('P-08: 同点タイブレーク → playerOrder の席順が先のプレイヤーが上位', () => {
    // p1=p2=30000 同点 → p1が1位、p2が2位
    const scores: HanchanScores = { p1: 30000, p2: 30000, p3: 20000, p4: 20000 };
    const result = calcHanchanPoints(scores, playerOrder, RULE_OKA);
    // p1(1位)のポイント > p2(2位)のポイント
    expect(result['p1']).toBeGreaterThan(result['p2']);
    // p3(3位) > p4(4位)
    expect(result['p3']).toBeGreaterThan(result['p4']);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });
});

// ---- calcNetBalances ----

describe('calcNetBalances', () => {
  const playerOrder = ['a', 'b', 'c', 'd'];
  const mahjongYen: HanchanResult = { a: 1000, b: 0, c: -400, d: -600 };

  // B-01: 立替者あり・場代のみ
  it('B-01: 立替者あり・場代のみ → 正しい最終収支', () => {
    const feeShare: Record<string, number> = { a: 500, b: 500, c: 500, d: 500 };
    // a=1000-500-0+2000+0=2500, b=0-500=−500, c=−400-500=−900, d=−600-500=−1100
    // 合計=2500-500-900-1100=0 ✓
    const result = calcNetBalances(mahjongYen, feeShare, {}, 'a', 2000, playerOrder);
    expect(result['a']).toBe(2500);
    expect(result['b']).toBe(-500);
    expect(result['c']).toBe(-900);
    expect(result['d']).toBe(-1100);
  });

  // B-02: 立替者あり・場代＋個人分
  it('B-02: 立替者あり・場代＋個人分 → 正しい最終収支', () => {
    const feeShare: Record<string, number> = { a: 500, b: 500, c: 500, d: 500 };
    const personal: Record<string, number> = { a: 300, b: 700, c: 0, d: 0 };
    // personalTotal=300+700=1000
    // a=1000-500-300+2000+1000=3200, b=0-500-700=−1200, c=−400-500=−900, d=−600-500=−1100
    // 合計=3200-1200-900-1100=0 ✓
    const result = calcNetBalances(mahjongYen, feeShare, personal, 'a', 2000, playerOrder);
    expect(result['a']).toBe(3200);
    expect(result['b']).toBe(-1200);
    expect(result['c']).toBe(-900);
    expect(result['d']).toBe(-1100);
  });

  // B-03: feePayerId=null → mahjongYen と同値
  it('B-03: feePayerId=null → mahjongYen と同値を返す', () => {
    const result = calcNetBalances(mahjongYen, null, {}, null, 2000, playerOrder);
    expect(result).toEqual(mahjongYen);
  });

  // B-04: totalFee=0 かつ個人分全0（payerあり）→ mahjongYen と同値
  it('B-04: totalFee=0 かつ個人分全0 → mahjongYen と同値を返す', () => {
    const result = calcNetBalances(mahjongYen, null, {}, 'a', 0, playerOrder);
    expect(result).toEqual(mahjongYen);
  });

  // Z-01: B-01 のゼロサム明示検証
  it('Z-01: B-01 の合計が0', () => {
    const feeShare: Record<string, number> = { a: 500, b: 500, c: 500, d: 500 };
    const result = calcNetBalances(mahjongYen, feeShare, {}, 'a', 2000, playerOrder);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // Z-02: B-02 のゼロサム明示検証
  it('Z-02: B-02 の合計が0', () => {
    const feeShare: Record<string, number> = { a: 500, b: 500, c: 500, d: 500 };
    const personal: Record<string, number> = { a: 300, b: 700, c: 0, d: 0 };
    const result = calcNetBalances(mahjongYen, feeShare, personal, 'a', 2000, playerOrder);
    expect(Object.values(result).reduce((s, v) => s + v, 0)).toBe(0);
  });

  // E-01: feeShare 合計≠totalFee の不正入力で throw
  it('E-01: feeShare 合計≠totalFee の不正入力 → Error を投げる', () => {
    // feeShare合計=400, totalFee=2000 → 立替者の加算後に合計が崩れる
    // a=1000-100+2000+0=2900, b=0-100=−100, c=−400-100=−500, d=−600-100=−700
    // 合計=2900-100-500-700=1600≠0 → throw
    const badShare: Record<string, number> = { a: 100, b: 100, c: 100, d: 100 };
    expect(() =>
      calcNetBalances(mahjongYen, badShare, {}, 'a', 2000, playerOrder)
    ).toThrow(Error);
  });

  // 統合: B-02 の結果を calcTransfers に渡し送金が成立すること
  it('統合: B-02 の結果を calcTransfers に渡すと送金が成立する', () => {
    const feeShare: Record<string, number> = { a: 500, b: 500, c: 500, d: 500 };
    const personal: Record<string, number> = { a: 300, b: 700, c: 0, d: 0 };
    const netBalances = calcNetBalances(mahjongYen, feeShare, personal, 'a', 2000, playerOrder);

    // calcTransfers は合計0 の収支を受け取り送金指示を返す
    const transfers = calcTransfers(netBalances);

    // 送金後に全員の残高が0になること
    const after = { ...netBalances };
    for (const t of transfers) {
      after[t.from] += t.amount;
      after[t.to] -= t.amount;
    }
    for (const id of Object.keys(after)) {
      expect(after[id]).toBe(0);
    }

    // 全送金額は正の整数
    for (const t of transfers) {
      expect(t.amount).toBeGreaterThan(0);
      expect(Number.isInteger(t.amount)).toBe(true);
    }
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

// ---- sumPersonalExpenseItems ----

describe('sumPersonalExpenseItems', () => {
  const playerOrder = ['p1', 'p2', 'p3', 'p4'];

  // S-01: 複数明細合算
  it('S-01: 複数明細合算 → 各プレイヤーの合計を返す', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'x', memo: '昼食', amounts: { p1: 500, p2: 1000 } },
      { id: 'y', memo: '飲み物', amounts: { p1: 200, p3: 300 } },
    ];
    const result = sumPersonalExpenseItems(items, playerOrder);
    expect(result['p1']).toBe(700);
    expect(result['p2']).toBe(1000);
    expect(result['p3']).toBe(300);
    expect(result['p4']).toBe(0);
  });

  // S-02: 空配列 → 全員0
  it('S-02: 空配列 → 全員0', () => {
    const result = sumPersonalExpenseItems([], playerOrder);
    expect(result).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
  });

  // S-03: amounts欠損プレイヤー → 0
  it('S-03: amounts に一部プレイヤーが存在しない → 欠損は0', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'a', memo: 'test', amounts: { p1: 100 } },
    ];
    const result = sumPersonalExpenseItems(items, playerOrder);
    expect(result['p1']).toBe(100);
    expect(result['p2']).toBe(0);
    expect(result['p3']).toBe(0);
    expect(result['p4']).toBe(0);
  });

  // S-04: 全員0の明細 → 全員0
  it('S-04: 全員0の明細 → 全員0', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'b', memo: 'ゼロ', amounts: { p1: 0, p2: 0, p3: 0, p4: 0 } },
    ];
    const result = sumPersonalExpenseItems(items, playerOrder);
    expect(result).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
  });

  // S-05: playerOrder=['p1']のみ → p1の合計のみ
  it('S-05: playerOrder が p1 のみ → p1 の合計のみ返す', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'c', memo: '昼食', amounts: { p1: 500, p2: 1000 } },
    ];
    const result = sumPersonalExpenseItems(items, ['p1']);
    expect(Object.keys(result)).toEqual(['p1']);
    expect(result['p1']).toBe(500);
  });

  // S-06: amounts に playerOrder 外キー unknown:9999 → 結果に unknown キーが存在しない
  it('S-06: amounts に playerOrder 外キーがある → 結果に含めない', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'd', memo: 'test', amounts: { p1: 100, unknown: 9999 } },
    ];
    const result = sumPersonalExpenseItems(items, playerOrder);
    expect('unknown' in result).toBe(false);
    expect(result['p1']).toBe(100);
  });

  // S-07: 統合: S-01 の結果を calcNetBalances に渡し合計0
  it('S-07: 統合 — S-01 の結果を calcNetBalances に渡すと合計が0', () => {
    const items: PersonalExpenseItem[] = [
      { id: 'x', memo: '昼食', amounts: { p1: 500, p2: 1000 } },
      { id: 'y', memo: '飲み物', amounts: { p1: 200, p3: 300 } },
    ];
    const personalExpenses = sumPersonalExpenseItems(items, playerOrder);
    const mahjongYen: HanchanResult = { p1: 2000, p2: 500, p3: -1000, p4: -1500 };
    const feeShare: Record<string, number> = { p1: 500, p2: 500, p3: 500, p4: 500 };
    const totalFee = 2000;
    const result = calcNetBalances(mahjongYen, feeShare, personalExpenses, 'p1', totalFee, playerOrder);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(0);
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
