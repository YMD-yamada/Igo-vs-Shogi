import type { Board, Cell, Coord, HandKind, ShogiHand, ShogiKind, ShogiPiece } from "./types.js";

export const createEmptyBoard = (size: number): Board =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null));

export const neighbors = (size: number, point: Coord): Coord[] =>
  [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((p) => p.row >= 0 && p.row < size && p.col >= 0 && p.col < size);

const cloneBoard = (board: Board): Board => board.map((row) => [...row]) as Board;

let idSeq = 0;
export const resetPieceIds = (): void => {
  idSeq = 0;
};
const pid = (prefix: string): string => {
  idSeq += 1;
  return `${prefix}${idSeq}`;
};

const piece = (kind: ShogiKind): ShogiPiece => ({ id: pid(kind[0]), kind });

/**
 * Initial shogi camp with breathing room (no instant atari):
 *   · · · 銀 王 銀 · · ·
 *   · · 桂 · · · 桂 · ·
 *   · · · 金 · 金 · · ·
 *   · · · · 歩 · · · ·
 */
export const createInitialBoard = (size = 9): Board => {
  resetPieceIds();
  const board = createEmptyBoard(size);
  const r8 = size - 1;
  const r7 = size - 2;
  const r6 = size - 3;
  const r5 = size - 4;

  board[r8][3] = { type: "piece", piece: piece("silver") };
  board[r8][4] = { type: "piece", piece: piece("king") };
  board[r8][5] = { type: "piece", piece: piece("silver") };

  board[r7][2] = { type: "piece", piece: piece("knight") };
  board[r7][6] = { type: "piece", piece: piece("knight") };

  board[r6][3] = { type: "piece", piece: piece("gold") };
  board[r6][5] = { type: "piece", piece: piece("gold") };

  board[r5][4] = { type: "piece", piece: piece("pawn") };

  return board;
};

export const emptyHand = (): ShogiHand => ({
  gold: 0,
  silver: 0,
  knight: 0,
  pawn: 0,
});

export const countStones = (board: Board): number => {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell?.type === "stone") n += 1;
    }
  }
  return n;
};

export const findKing = (board: Board): Coord | null => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const cell = board[row][col];
      if (cell?.type === "piece" && cell.piece.kind === "king") {
        return { row, col };
      }
    }
  }
  return null;
};

/**
 * Capture groups:
 * - Pieces orthogonally connected to the King share liberties (royal camp).
 * - Pieces cut off from the King are solo (1-piece groups).
 */
export const pieceGroupAndLiberties = (
  board: Board,
  point: Coord,
): { group: Coord[]; liberties: Set<string> } => {
  const cell = board[point.row][point.col];
  if (cell?.type !== "piece") return { group: [], liberties: new Set() };

  const king = findKing(board);
  const royal = new Set<string>();
  if (king) {
    const q: Coord[] = [king];
    const seen = new Set<string>([`${king.row},${king.col}`]);
    while (q.length > 0) {
      const cur = q.pop()!;
      royal.add(`${cur.row},${cur.col}`);
      for (const n of neighbors(board.length, cur)) {
        const key = `${n.row},${n.col}`;
        if (seen.has(key)) continue;
        if (board[n.row][n.col]?.type === "piece") {
          seen.add(key);
          q.push(n);
        }
      }
    }
  }

  const pointKey = `${point.row},${point.col}`;
  const useRoyal = royal.has(pointKey);

  const seen = new Set<string>();
  const group: Coord[] = [];
  const liberties = new Set<string>();
  const queue: Coord[] = [point];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const key = `${current.row},${current.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    group.push(current);

    for (const next of neighbors(board.length, current)) {
      const n = board[next.row][next.col];
      if (n === null) {
        liberties.add(`${next.row},${next.col}`);
      } else if (n.type === "piece") {
        const nKey = `${next.row},${next.col}`;
        if (useRoyal) {
          if (royal.has(nKey)) queue.push(next);
        }
        // solo: do not expand
      }
    }
  }

  return { group, liberties };
};

/** Liberties of the connected piece group containing `at`. */
export const pieceLiberties = (board: Board, at: Coord): Coord[] => {
  const { liberties } = pieceGroupAndLiberties(board, at);
  return [...liberties].map((k) => {
    const [row, col] = k.split(",").map(Number);
    return { row, col };
  });
};

/** Connected black stone group + liberty set. */
export const stoneGroupAndLiberties = (
  board: Board,
  point: Coord,
): { group: Coord[]; liberties: Set<string> } => {
  const cell = board[point.row][point.col];
  if (cell?.type !== "stone") return { group: [], liberties: new Set() };

  const seen = new Set<string>();
  const group: Coord[] = [];
  const liberties = new Set<string>();
  const queue: Coord[] = [point];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const key = `${current.row},${current.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    group.push(current);

    for (const next of neighbors(board.length, current)) {
      const n = board[next.row][next.col];
      if (n === null) {
        liberties.add(`${next.row},${next.col}`);
      } else if (n.type === "stone") {
        queue.push(next);
      }
    }
  }

  return { group, liberties };
};

export interface PlaceStoneResult {
  ok: boolean;
  board: Board;
  capturedPieces: ShogiPiece[];
  capturedPoints: Coord[];
  koPoint: Coord | null;
  reason?: string;
}

/** Place a black stone; surround-capture any shogi pieces with 0 liberties. */
export const placeStone = (
  board: Board,
  point: Coord,
  koPoint: Coord | null,
): PlaceStoneResult => {
  const size = board.length;
  if (
    point.row < 0 ||
    point.col < 0 ||
    point.row >= size ||
    point.col >= size
  ) {
    return {
      ok: false,
      board,
      capturedPieces: [],
      capturedPoints: [],
      koPoint: null,
      reason: "盤外です。",
    };
  }
  if (board[point.row][point.col] !== null) {
    return {
      ok: false,
      board,
      capturedPieces: [],
      capturedPoints: [],
      koPoint: null,
      reason: "既に石または駒があります。",
    };
  }
  if (koPoint && koPoint.row === point.row && koPoint.col === point.col) {
    return {
      ok: false,
      board,
      capturedPieces: [],
      capturedPoints: [],
      koPoint: null,
      reason: "コウのため打てません。",
    };
  }

  const next = cloneBoard(board);
  next[point.row][point.col] = { type: "stone" };

  const capturedPieces: ShogiPiece[] = [];
  const capturedPoints: Coord[] = [];
  const removed = new Set<string>();

  for (const adj of neighbors(size, point)) {
    const cell = next[adj.row][adj.col];
    if (cell?.type !== "piece") continue;
    const adjKey = `${adj.row},${adj.col}`;
    if (removed.has(adjKey)) continue;

    const { group, liberties } = pieceGroupAndLiberties(next, adj);
    if (liberties.size === 0) {
      for (const g of group) {
        const gCell = next[g.row][g.col];
        if (gCell?.type === "piece") {
          capturedPieces.push(gCell.piece);
          capturedPoints.push(g);
          next[g.row][g.col] = null;
          removed.add(`${g.row},${g.col}`);
        }
      }
    }
  }

  const self = stoneGroupAndLiberties(next, point);
  if (self.liberties.size === 0) {
    return {
      ok: false,
      board,
      capturedPieces: [],
      capturedPoints: [],
      koPoint: null,
      reason: "自殺手は禁止です。",
    };
  }

  let nextKo: Coord | null = null;
  if (capturedPoints.length === 1 && self.group.length === 1) {
    nextKo = capturedPoints[0];
  }

  return {
    ok: true,
    board: next,
    capturedPieces,
    capturedPoints,
    koPoint: nextKo,
  };
};

const STEP: Record<Exclude<ShogiKind, "knight">, Coord[]> = {
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

const inside = (size: number, c: Coord): boolean =>
  c.row >= 0 && c.row < size && c.col >= 0 && c.col < size;

const canLand = (board: Board, to: Coord, kind: ShogiKind): boolean => {
  const t = board[to.row][to.col];
  if (!t) return true;
  if (t.type === "stone") return kind !== "knight";
  return false;
};

export const getLegalMoves = (board: Board, from: Coord): Coord[] => {
  const size = board.length;
  const cell = board[from.row]?.[from.col];
  if (cell?.type !== "piece") return [];

  if (cell.piece.kind === "knight") {
    return [
      { row: from.row - 2, col: from.col - 1 },
      { row: from.row - 2, col: from.col + 1 },
    ].filter((c) => inside(size, c) && canLand(board, c, "knight"));
  }

  return STEP[cell.piece.kind]
    .map((d) => ({ row: from.row + d.row, col: from.col + d.col }))
    .filter((c) => inside(size, c) && canLand(board, c, cell.piece.kind));
};

export const canDropPawn = (board: Board, col: number): boolean => {
  for (let row = 0; row < board.length; row += 1) {
    const cell = board[row][col];
    if (cell?.type === "piece" && cell.piece.kind === "pawn") return false;
  }
  return true;
};

export const getLegalDrops = (
  board: Board,
  hand: ShogiHand,
  kind: HandKind,
): Coord[] => {
  if (hand[kind] <= 0) return [];
  const size = board.length;
  const cells: Coord[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] !== null) continue;
      if (kind === "pawn") {
        if (row === 0) continue;
        if (!canDropPawn(board, col)) continue;
      }
      if (kind === "knight" && row < 2) continue;
      cells.push({ row, col });
    }
  }
  return cells;
};

export interface MoveResult {
  ok: boolean;
  board: Board;
  capturedStone: boolean;
  reason?: string;
}

export const movePiece = (
  board: Board,
  from: Coord,
  to: Coord,
): MoveResult => {
  const source = board[from.row]?.[from.col];
  if (source?.type !== "piece") {
    return { ok: false, board, capturedStone: false, reason: "自分の駒を選んでください。" };
  }
  const legal = getLegalMoves(board, from);
  if (!legal.some((m) => m.row === to.row && m.col === to.col)) {
    return { ok: false, board, capturedStone: false, reason: "その移動はできません。" };
  }

  const next = cloneBoard(board);
  const target = next[to.row][to.col];
  next[to.row][to.col] = source;
  next[from.row][from.col] = null;
  return {
    ok: true,
    board: next,
    capturedStone: target?.type === "stone",
  };
};

export const dropPiece = (
  board: Board,
  hand: ShogiHand,
  kind: HandKind,
  to: Coord,
): { ok: boolean; board: Board; hand: ShogiHand; reason?: string } => {
  const legal = getLegalDrops(board, hand, kind);
  if (!legal.some((m) => m.row === to.row && m.col === to.col)) {
    return { ok: false, board, hand, reason: "そこに打てません。" };
  }
  const nextBoard = cloneBoard(board);
  nextBoard[to.row][to.col] = {
    type: "piece",
    piece: { id: pid(kind[0]), kind },
  };
  return {
    ok: true,
    board: nextBoard,
    hand: { ...hand, [kind]: hand[kind] - 1 },
  };
};

export const hasLegalShogiAction = (board: Board, hand: ShogiHand): boolean => {
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

export const emptyCells = (board: Board): Coord[] => {
  const cells: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === null) cells.push({ row, col });
    }
  }
  return cells;
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
  }
};

export const cellAt = (board: Board, at: Coord): Cell => board[at.row]?.[at.col] ?? null;
