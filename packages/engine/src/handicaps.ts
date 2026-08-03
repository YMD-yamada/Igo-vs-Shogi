import type { MatchConfig, ShogiHand } from "./types.js";

export type HandicapId = "even" | "go_favor" | "shogi_favor";

export interface HandicapPreset {
  id: HandicapId;
  label: string;
  description: string;
  config: Partial<MatchConfig>;
  startingHand?: Partial<ShogiHand>;
}

export const HANDICAP_PRESETS: Record<HandicapId, HandicapPreset> = {
  even: {
    id: "even",
    label: "互角",
    description: "標準の勝利条件（駒5／石10）",
    config: {},
  },
  go_favor: {
    id: "go_favor",
    label: "囲碁有利",
    description: "駒4枚で勝ち。将棋ハンデ向き",
    config: { goWinCaptures: 4 },
  },
  shogi_favor: {
    id: "shogi_favor",
    label: "将棋有利",
    description: "石8個で勝ち＋歩2枚持ち。囲碁ハンデ向き",
    config: { shogiWinStones: 8 },
    startingHand: { pawn: 2 },
  },
};

export const handicapOptions = (): HandicapPreset[] =>
  Object.values(HANDICAP_PRESETS);
