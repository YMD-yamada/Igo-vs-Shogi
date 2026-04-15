import type {
  Coord,
  Player,
  ShogiBoard,
  ShogiMoveOutcome,
  ShogiPiece,
  ShogiPieceKind,
} from "./types";

const SHOGI_SIZE = 5;

const inside = (coord: Coord): boolean =>
  coord.row >= 0 &&
  coord.row < SHOGI_SIZE &&
  coord.col >= 0 &&
  coord.col < SHOGI_SIZE;

const cloneBoard = (board: ShogiBoard): ShogiBoard =>
  board.map((row) => [...row]) as ShogiBoard;

const DIRECTIONS: Record<ShogiPieceKind, Coord[]> = {
  king: [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
  gold: [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ],
  silver: [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 },
  ],
  pawn: [{ row: -1, col: 0 }],
  invader: [],
};

const playerPiece = (
  id: string,
  kind: "king" | "gold" | "silver" | "pawn",
): ShogiPiece => ({ id, owner: "shogi", kind });

const invaderPiece = (id: string): ShogiPiece => ({
  id,
  owner: "invader",
  kind: "invader",
});

export const createInitialShogiBoard = (): ShogiBoard => {
  const board: ShogiBoard = Array.from({ length: SHOGI_SIZE }, () =>
    Array.from({ length: SHOGI_SIZE }, () => null),
  );

  board[4][2] = playerPiece("k1", "king");
  board[4][1] = playerPiece("g1", "gold");
  board[4][3] = playerPiece("g2", "gold");
  board[3][1] = playerPiece("s1", "silver");
  board[3][3] = playerPiece("s2", "silver");
  board[4][0] = playerPiece("p1", "pawn");
  board[4][4] = playerPiece("p2", "pawn");
  board[3][2] = playerPiece("p3", "pawn");

  board[0][0] = invaderPiece("e1");
  board[0][1] = invaderPiece("e2");
  board[0][2] = invaderPiece("e3");
  board[0][3] = invaderPiece("e4");
  board[0][4] = invaderPiece("e5");
  board[1][1] = invaderPiece("e6");
  board[1][3] = invaderPiece("e7");

  return board;
};

const legalMovesForPiece = (board: ShogiBoard, from: Coord): Coord[] => {
  const cell = board[from.row][from.col];
  if (!cell || cell.owner !== "shogi") {
    return [];
  }

  const moves = DIRECTIONS[cell.kind].map((dir) => ({
    row: from.row + dir.row,
    col: from.col + dir.col,
  }));

  return moves.filter((coord) => {
    if (!inside(coord)) {
      return false;
    }
    const target = board[coord.row][coord.col];
    if (target && target.owner === "shogi") {
      return false;
    }
    return true;
  });
};

export const getLegalShogiMoves = (board: ShogiBoard, from: Coord): Coord[] =>
  legalMovesForPiece(board, from);

export const moveShogiPiece = (
  board: ShogiBoard,
  from: Coord,
  to: Coord,
): ShogiMoveOutcome => {
  const source = board[from.row][from.col];
  if (!source || source.owner !== "shogi") {
    return {
      ok: false,
      board,
      capturedInvader: false,
      reason: "自分の駒を選択してください。",
    };
  }

  const legal = legalMovesForPiece(board, from);
  if (!legal.some((move) => move.row === to.row && move.col === to.col)) {
    return {
      ok: false,
      board,
      capturedInvader: false,
      reason: "その移動はできません。",
    };
  }

  const nextBoard = cloneBoard(board);
  const target = nextBoard[to.row][to.col];
  nextBoard[to.row][to.col] = source;
  nextBoard[from.row][from.col] = null;

  return {
    ok: true,
    board: nextBoard,
    capturedInvader: !!target && target.owner === "invader",
  };
};

export const hasShogiFriendlyPiece = (board: ShogiBoard): boolean =>
  board.some((row) =>
    row.some((cell) => !!cell && cell.owner === "shogi"),
  );

export const randomFriendlyPieceCells = (
  board: ShogiBoard,
  owner: Player,
  count: number,
): Coord[] => {
  const cells: Coord[] = [];
  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell && cell.owner === owner) {
        cells.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, count);
};

