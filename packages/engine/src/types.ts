export type Side = "go" | "shogi";
export type Outcome = Side | "draw" | null;

export interface Coord {
  row: number;
  col: number;
}

export type GoStone = "black" | "white";
export type GoBoard = (GoStone | null)[][];

export type ShogiOwner = "shogi" | "invader";
export type ShogiKind = "king" | "gold" | "silver" | "knight" | "pawn" | "invader";

export interface ShogiPiece {
  id: string;
  owner: ShogiOwner;
  kind: ShogiKind;
}

export type ShogiBoard = (ShogiPiece | null)[][];

export type HandKind = "gold" | "silver" | "knight" | "pawn";

export type ShogiHand = Record<HandKind, number>;

export interface MatchConfig {
  goSize: number;
  shogiSize: number;
  goWinCaptures: number;
  shogiWinInvaderCaptures: number;
  dropPerInvader: number;
  pressureReleaseAt: number;
  pressureMax: number;
  turnLimit: number;
  blackStoneFloor: number;
  maxInvaderDropPerMove: number;
  maxErosionDropPerMove: number;
  onlineMoveMs: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  goSize: 9,
  shogiSize: 5,
  goWinCaptures: 6,
  shogiWinInvaderCaptures: 4,
  dropPerInvader: 2,
  pressureReleaseAt: 3,
  pressureMax: 5,
  turnLimit: 80,
  blackStoneFloor: 8,
  maxInvaderDropPerMove: 2,
  maxErosionDropPerMove: 5,
  onlineMoveMs: 30_000,
};

export type GameMode = "hotseat" | "online" | "cpu";

export interface GameState {
  config: MatchConfig;
  mode: GameMode;
  turn: number;
  activeSide: Side;
  goBoard: GoBoard;
  shogiBoard: ShogiBoard;
  shogiHand: ShogiHand;
  goCaptures: number;
  shogiInvaderCaptures: number;
  goPressure: number;
  shogiPressure: number;
  /** Peak black stone count — used for black-floor win fairness */
  peakBlackStones: number;
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
  | { type: "go_release" }
  | { type: "shogi_select"; at: Coord }
  | { type: "shogi_select_hand"; kind: HandKind }
  | { type: "shogi_move"; to: Coord }
  | { type: "shogi_drop"; to: Coord }
  | { type: "shogi_release" }
  | { type: "clear_selection" }
  | { type: "dismiss_curtain" }
  | { type: "resign"; side: Side };

export interface ApplyResult {
  state: GameState;
  message: string;
  ok: boolean;
}
