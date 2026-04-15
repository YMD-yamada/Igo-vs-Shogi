export type Player = "igo" | "shogi";

export interface Coord {
  row: number;
  col: number;
}

export type IgoStone = "black" | "white";
export type IgoBoard = (IgoStone | null)[][];

export type ShogiOwner = "shogi" | "invader";
export type ShogiPieceKind = "king" | "gold" | "silver" | "pawn" | "invader";

export interface ShogiPiece {
  id: string;
  owner: ShogiOwner;
  kind: ShogiPieceKind;
}

export type ShogiCell = ShogiPiece | null;
export type ShogiBoard = ShogiCell[][];

export interface IgoMoveOutcome {
  ok: boolean;
  board: IgoBoard;
  captured: number;
  reason?: string;
}

export interface ShogiMoveOutcome {
  ok: boolean;
  board: ShogiBoard;
  capturedInvader: boolean;
  reason?: string;
}

export interface GameState {
  turn: number;
  activePlayer: Player;
  igoBoard: IgoBoard;
  shogiBoard: ShogiBoard;
  igoCaptures: number;
  shogiCaptures: number;
  pendingIgoHazards: number;
  pendingShogiHazards: number;
  sentToIgo: number;
  sentToShogi: number;
  receivedByIgo: number;
  receivedByShogi: number;
  selectedShogiCell: Coord | null;
  winner: Player | "draw" | null;
  log: string[];
}

export interface ScoreBoard {
  igo: {
    stones: number;
    captures: number;
    sentHazards: number;
    receivedHazards: number;
    total: number;
  };
  shogi: {
    pieces: number;
    captures: number;
    sentHazards: number;
    receivedHazards: number;
    total: number;
  };
}
