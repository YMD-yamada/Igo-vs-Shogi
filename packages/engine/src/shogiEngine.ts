import type {
  Coord,
  HandKind,
  ShogiBoard,
  ShogiHand,
  ShogiKind,
  ShogiPiece,
} from "./types.js";

export const SHOGI_SIZE = 5;

const inside = (size: number, c: Coord): boolean =>
  c.row >= 0 && c.row < size && c.col >= 0 && c.col < size;

const cloneBoard = (board: ShogiBoard): ShogiBoard =>
  board.map((row) => [...row]) as ShogiBoard;

let idSeq = 0;
const pid = (prefix: string): string => {
  idSeq += 1;
  return `${prefix}${idSeq}`;
};

export const resetPieceIds = (): void => {
  idSeq = 0;
};

const piece = (kind: Exclude<ShogiKind, "invader">): ShogiPiece => ({
  id: pid(kind[0]),
  owner: "shogi",
  kind,
});

export const createInvader = (): ShogiPiece => ({
  id: pid("i"),
  owner: "invader",
  kind: "invader",
});

export const emptyHand = (): ShogiHand => ({
  gold: 0,
  silver: 0,
  knight: 0,
  pawn: 0,
});

/**
 * Initial setup (shogi side at bottom / high rows):
 * 桂 銀 王 銀 桂
 * 歩 金 ・ 金 歩
 */
export const createInitialShogiBoard = (size = SHOGI_SIZE): ShogiBoard => {
  resetPieceIds();
  const board: ShogiBoard = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const back = size - 1;
  const mid = size - 2;

  board[back][0] = piece("knight");
  board[back][1] = piece("silver");
  board[back][2] = piece("king");
  board[back][3] = piece("silver");
  board[back][4] = piece("knight");
  board[mid][0] = piece("pawn");
  board[mid][1] = piece("gold");
  board[mid][3] = piece("gold");
  board[mid][4] = piece("pawn");

  return board;
};

const STEP: Record<Exclude<ShogiKind, "invader" | "knight">, Coord[]> = {
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
};

export const getLegalMoves = (board: ShogiBoard, from: Coord): Coord[] => {
  const size = board.length;
  const cell = board[from.row]?.[from.col];
  if (!cell || cell.owner !== "shogi") return [];

  if (cell.kind === "knight") {
    return [
      { row: from.row - 2, col: from.col - 1 },
      { row: from.row - 2, col: from.col + 1 },
    ].filter((c) => {
      if (!inside(size, c)) return false;
      const t = board[c.row][c.col];
      return !t || t.owner === "invader";
    });
  }

  if (cell.kind === "invader") return [];

  return STEP[cell.kind]
    .map((d) => ({ row: from.row + d.row, col: from.col + d.col }))
    .filter((c) => {
      if (!inside(size, c)) return false;
      const t = board[c.row][c.col];
      return !t || t.owner === "invader";
    });
};

export const findKing = (board: ShogiBoard): Coord | null => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const cell = board[row][col];
      if (cell?.owner === "shogi" && cell.kind === "king") {
        return { row, col };
      }
    }
  }
  return null;
};

export const emptyShogiCells = (board: ShogiBoard): Coord[] => {
  const cells: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (!board[row][col]) cells.push({ row, col });
    }
  }
  return cells;
};

/** Drop priority: c3 center-ish, then ring, then rest */
export const rankInvaderDropTargets = (board: ShogiBoard): Coord[] => {
  const size = board.length;
  const empties = emptyShogiCells(board);
  const center = { row: Math.floor(size / 2), col: Math.floor(size / 2) };
  const ring: Coord[] = [
    { row: center.row, col: center.col - 1 },
    { row: center.row, col: center.col + 1 },
    { row: center.row - 1, col: center.col },
    { row: center.row + 1, col: center.col },
  ];

  const score = (c: Coord): number => {
    if (c.row === center.row && c.col === center.col) return 0;
    if (ring.some((r) => r.row === c.row && r.col === c.col)) return 1;
    return 2 + Math.abs(c.row - center.row) + Math.abs(c.col - center.col);
  };

  return [...empties].sort((a, b) => score(a) - score(b));
};

export const canDropPawn = (board: ShogiBoard, col: number): boolean => {
  for (let row = 0; row < board.length; row += 1) {
    const cell = board[row][col];
    if (cell?.owner === "shogi" && cell.kind === "pawn") return false;
  }
  return true;
};

export const getLegalDrops = (
  board: ShogiBoard,
  hand: ShogiHand,
  kind: HandKind,
): Coord[] => {
  if (hand[kind] <= 0) return [];
  const size = board.length;
  const cells = emptyShogiCells(board);

  return cells.filter((c) => {
    if (kind === "pawn") {
      if (c.row === 0) return false; // cannot drop on last rank
      if (!canDropPawn(board, c.col)) return false;
    }
    if (kind === "knight" && c.row < 2) return false;
    return inside(size, c);
  });
};

export interface MoveResult {
  ok: boolean;
  board: ShogiBoard;
  capturedInvader: boolean;
  reason?: string;
}

export const movePiece = (
  board: ShogiBoard,
  from: Coord,
  to: Coord,
): MoveResult => {
  const source = board[from.row]?.[from.col];
  if (!source || source.owner !== "shogi") {
    return { ok: false, board, capturedInvader: false, reason: "自分の駒を選んでください。" };
  }
  const legal = getLegalMoves(board, from);
  if (!legal.some((m) => m.row === to.row && m.col === to.col)) {
    return { ok: false, board, capturedInvader: false, reason: "その移動はできません。" };
  }

  const next = cloneBoard(board);
  const target = next[to.row][to.col];
  next[to.row][to.col] = source;
  next[from.row][from.col] = null;
  return {
    ok: true,
    board: next,
    capturedInvader: !!target && target.owner === "invader",
  };
};

export const dropPiece = (
  board: ShogiBoard,
  hand: ShogiHand,
  kind: HandKind,
  to: Coord,
): { ok: boolean; board: ShogiBoard; hand: ShogiHand; reason?: string } => {
  const legal = getLegalDrops(board, hand, kind);
  if (!legal.some((m) => m.row === to.row && m.col === to.col)) {
    return { ok: false, board, hand, reason: "そこに打てません。" };
  }
  const nextBoard = cloneBoard(board);
  nextBoard[to.row][to.col] = {
    id: pid(kind[0]),
    owner: "shogi",
    kind,
  };
  const nextHand = { ...hand, [kind]: hand[kind] - 1 };
  return { ok: true, board: nextBoard, hand: nextHand };
};

export const hasLegalShogiAction = (
  board: ShogiBoard,
  hand: ShogiHand,
): boolean => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (getLegalMoves(board, { row, col }).length > 0) return true;
    }
  }
  for (const kind of ["gold", "silver", "knight", "pawn"] as HandKind[]) {
    if (getLegalDrops(board, hand, kind).length > 0) return true;
  }
  return false;
};

export const randomFriendlyCells = (
  board: ShogiBoard,
  count: number,
  preferNonKing = true,
): Coord[] => {
  const cells: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const cell = board[row][col];
      if (cell?.owner === "shogi") {
        if (preferNonKing && cell.kind === "king") continue;
        cells.push({ row, col });
      }
    }
  }
  // fallback include king if needed
  if (cells.length === 0) {
    const k = findKing(board);
    if (k) cells.push(k);
  }
  return cells.slice(0, count);
};

export const pieceLabel = (kind: ShogiKind): string => {
  switch (kind) {
    case "king":
      return "王";
    case "gold":
      return "金";
    case "silver":
      return "銀";
    case "knight":
      return "桂";
    case "pawn":
      return "歩";
    case "invader":
      return "侵";
  }
};
