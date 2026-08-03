import type { MatchConfig, ShogiHand } from "./types.js";

export type HandicapId =
  | "even"
  | "go_slight"
  | "go_strong"
  | "shogi_slight"
  | "shogi_strong";

export interface HandicapPreset {
  id: HandicapId;
  label: string;
  description: string;
  config: Partial<MatchConfig>;
  startingHand?: Partial<ShogiHand>;
  removeStartingPieces?: Array<"pawn" | "gold" | "silver" | "knight">;
}

/** CPU↔CPU（scripts/balance-sim.mjs）で調整。互角 ≈ 囲碁45%／将棋52%。 */
export const HANDICAP_PRESETS: Record<HandicapId, HandicapPreset> = {
  even: {
    id: "even",
    label: "互角",
    description: "標準（駒2／石6）",
    config: {},
  },
  go_slight: {
    id: "go_slight",
    label: "囲碁やや有利",
    description: "石7必要",
    config: { shogiWinStones: 7 },
  },
  go_strong: {
    id: "go_strong",
    label: "囲碁有利",
    description: "石9必要",
    config: { shogiWinStones: 9 },
  },
  shogi_slight: {
    id: "shogi_slight",
    label: "将棋やや有利",
    description: "石5必要",
    config: { shogiWinStones: 5 },
  },
  shogi_strong: {
    id: "shogi_strong",
    label: "将棋有利",
    description: "石4＋歩1持ち",
    config: { shogiWinStones: 4 },
    startingHand: { pawn: 1 },
  },
};

export const handicapOptions = (): HandicapPreset[] =>
  Object.values(HANDICAP_PRESETS);
