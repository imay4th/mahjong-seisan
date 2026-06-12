/** ルール設定 */
export interface RuleSettings {
  /** レート: 1000点あたりの円（点5なら50） */
  ratePer1000: number;
  /** ウマ: 1位→4位の順の千点単位ポイント（例 10-20 なら [20, 10, -10, -20]） */
  uma: [number, number, number, number];
  /** オカの有無 */
  oka: boolean;
  /** 配給原点（通常 25000） */
  startingPoints: number;
  /** 返し点（通常 30000） */
  returnPoints: number;
}

/** 場代の分担方式 */
export type FeeSplitMode = 'equal' | 'proportional' | 'loser';

/** プレイヤー */
export interface Player {
  id: string;
  name: string;
}

/** 1半荘の結果: playerId → 持ち点（100点単位） */
export type HanchanScores = Record<string, number>;

/** 1半荘の清算結果: playerId → 円収支 */
export type HanchanResult = Record<string, number>;

/** 送金指示 */
export interface Transfer {
  from: string; // playerId
  to: string;   // playerId
  amount: number; // 円（正の整数）
}

/**
 * 個人分費用の明細1件。
 * id: crypto.randomUUID() で生成する一意識別子
 * memo: 摘要（例: 昼食代）
 * amounts: playerId → 円（そのプレイヤーの負担額）
 */
export interface PersonalExpenseItem {
  id: string;
  memo: string;
  amounts: Record<string, number>;
}

// ---- 状態管理型 ----

/** 画面識別子 */
export type Screen = 'home' | 'setup' | 'game' | 'settlement';

/** ゲーム状態（localStorage に保存される） */
export interface GameState {
  players: Player[];
  settings: RuleSettings;
  totalFee: number;
  feeMode: FeeSplitMode;
  hanchans: HanchanScores[];
  /** 個人分費用明細リスト（複数明細対応） */
  personalExpenseItems: PersonalExpenseItem[];
  /** 編集中のドラフト行: playerId → 持ち点（null = 未入力） */
  draft: Record<string, number | null>;
  /** 場代立替者のプレイヤーID（未選択なら null） */
  feePayerId: string | null;
}
