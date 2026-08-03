import type { MatchConfig, ShogiHand } from "./types.js";

export type HandicapId = "even" | "go_favor" | "shogi_favor";

export interface HandicapPreset {
  id: HandicapId;
  label: string;
  description: string;
  config: Partial<MatchConfig>;
  startingHand?: Partial<ShogiHand>;
}

/** Local/CPU handicaps. Online rooms stay even for fairness. */
export const HANDICAP_PRESETS: Record<HandicapId, HandicapPreset> = {
  even: {
    id: "even",
    label: "互角",
    description: "標準の勝利条件",
    config: {},
  },
  go_favor: {
    id: "go_favor",
    label: "囲碁有利",
    description: "白石5で勝ち／侵攻捕4のまま。将棋ハンデ向き",
    config: { goWinCaptures: 5 },
  },
  shogi_favor: {
    id: "shogi_favor",
    label: "将棋有利",
    description: "侵攻捕3で勝ち＋歩2枚持ち。囲碁ハンデ向き",
    config: { shogiWinInvaderCaptures: 3 },
    startingHand: { pawn: 2 },
  },
};

export const handicapOptions = (): HandicapPreset[] =>
  Object.values(HANDICAP_PRESETS);
