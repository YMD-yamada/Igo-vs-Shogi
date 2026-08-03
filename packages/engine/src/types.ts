export type Side = "go" | "shogi";
export type Outcome = Side | "draw" | null;

export interface Coord {
  row: number;
  col: number;
}

export type ShogiKind = "king" | "gold" | "silver" | "knight" | "pawn";
export type HandKind = "gold" | "silver" | "knight" | "pawn";

export interface ShogiPiece {
  id: string;
  kind: ShogiKind;
}

/** Shared board cell: Go stone or Shogi piece. */
export type Cell =
  | { type: "stone" }
  | { type: "piece"; piece: ShogiPiece }
  | null;

export type Board = Cell[][];

export type ShogiHand = Record<HandKind, number>;

export interface MatchConfig {
  size: number;
  /** Go wins by capturing this many shogi pieces (King is instant). */
  goWinCaptures: number;
  /** Shogi wins by capturing this many black stones. */
  shogiWinStones: number;
  turnLimit: number;
  onlineMoveMs: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  size: 9,
  goWinCaptures: 5,
  shogiWinStones: 10,
  turnLimit: 100,
  onlineMoveMs: 30_000,
};

export type GameMode = "hotseat" | "online" | "cpu";

export interface GameState {
  config: MatchConfig;
  mode: GameMode;
  turn: number;
  activeSide: Side;
  board: Board;
  shogiHand: ShogiHand;
  goCaptures: number;
  shogiStoneCaptures: number;
  lastGoMove: Coord | null;
  koPoint: Coord | null;
  selectedShogi: Coord | null;
  selectedHand: HandKind | null;
  legalShogiTargets: Coord[];
  winner: Outcome;
  log: string[];
  seed: number;
  rngState: number;
  passCurtain: boolean;
  cpuSide: Side | null;
}

export type Action =
  | { type: "go_place"; at: Coord }
  | { type: "go_pass" }
  | { type: "shogi_select"; at: Coord }
  | { type: "shogi_select_hand"; kind: HandKind }
  | { type: "shogi_move"; to: Coord }
  | { type: "shogi_drop"; to: Coord }
  | { type: "clear_selection" }
  | { type: "dismiss_curtain" }
  | { type: "resign"; side: Side };

export interface ApplyResult {
  state: GameState;
  message: string;
  ok: boolean;
}
