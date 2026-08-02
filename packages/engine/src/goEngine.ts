import type { Coord, GoBoard, GoStone } from "./types.js";

export const createGoBoard = (size: number): GoBoard =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null));

export const neighbors = (size: number, point: Coord): Coord[] =>
  [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((p) => p.row >= 0 && p.row < size && p.col >= 0 && p.col < size);

const cloneBoard = (board: GoBoard): GoBoard =>
  board.map((row) => [...row]) as GoBoard;

export const groupAndLiberties = (
  board: GoBoard,
  point: Coord,
): { group: Coord[]; liberties: Set<string> } => {
  const color = board[point.row][point.col];
  if (!color) {
    return { group: [], liberties: new Set() };
  }

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
      const cell = board[next.row][next.col];
      if (cell === null) {
        liberties.add(`${next.row},${next.col}`);
      } else if (cell === color) {
        queue.push(next);
      }
    }
  }

  return { group, liberties };
};

export const countStones = (board: GoBoard, color: GoStone): number => {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === color) n += 1;
    }
  }
  return n;
};

export const emptyCells = (board: GoBoard): Coord[] => {
  const cells: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === null) cells.push({ row, col });
    }
  }
  return cells;
};

export interface PlaceStoneResult {
  ok: boolean;
  board: GoBoard;
  captured: number;
  capturedPoints: Coord[];
  koPoint: Coord | null;
  reason?: string;
}

export const placeStone = (
  board: GoBoard,
  point: Coord,
  stone: GoStone,
  koPoint: Coord | null,
): PlaceStoneResult => {
  if (
    point.row < 0 ||
    point.col < 0 ||
    point.row >= board.length ||
    point.col >= board.length
  ) {
    return { ok: false, board, captured: 0, capturedPoints: [], koPoint: null, reason: "盤外です。" };
  }
  if (board[point.row][point.col] !== null) {
    return { ok: false, board, captured: 0, capturedPoints: [], koPoint: null, reason: "既に石があります。" };
  }
  if (koPoint && koPoint.row === point.row && koPoint.col === point.col) {
    return { ok: false, board, captured: 0, capturedPoints: [], koPoint: null, reason: "コウのため打てません。" };
  }

  const next = cloneBoard(board);
  next[point.row][point.col] = stone;
  const enemy: GoStone = stone === "black" ? "white" : "black";
  const capturedPoints: Coord[] = [];

  for (const adj of neighbors(board.length, point)) {
    if (next[adj.row][adj.col] !== enemy) continue;
    const { group, liberties } = groupAndLiberties(next, adj);
    if (liberties.size === 0) {
      for (const g of group) {
        next[g.row][g.col] = null;
        capturedPoints.push(g);
      }
    }
  }

  const self = groupAndLiberties(next, point);
  if (self.liberties.size === 0) {
    return { ok: false, board, captured: 0, capturedPoints: [], koPoint: null, reason: "自殺手は禁止です。" };
  }

  // Simple ko: single-stone capture that recreates previous shape at that point
  let nextKo: Coord | null = null;
  if (capturedPoints.length === 1 && self.group.length === 1) {
    nextKo = capturedPoints[0];
  }

  return {
    ok: true,
    board: next,
    captured: capturedPoints.length,
    capturedPoints,
    koPoint: nextKo,
  };
};

/** Prefer empties adjacent to black, then outer ring, then rest. */
export const rankErosionTargets = (board: GoBoard): Coord[] => {
  const size = board.length;
  const empties = emptyCells(board);
  const adjBlack: Coord[] = [];
  const outer: Coord[] = [];
  const rest: Coord[] = [];

  for (const cell of empties) {
    const touchesBlack = neighbors(size, cell).some(
      (n) => board[n.row][n.col] === "black",
    );
    if (touchesBlack) {
      adjBlack.push(cell);
    } else if (
      cell.row === 0 ||
      cell.col === 0 ||
      cell.row === size - 1 ||
      cell.col === size - 1
    ) {
      outer.push(cell);
    } else {
      rest.push(cell);
    }
  }

  return [...adjBlack, ...outer, ...rest];
};

export const removeDeadGroups = (
  board: GoBoard,
  color: GoStone,
): { board: GoBoard; removed: number } => {
  const next = cloneBoard(board);
  let removed = 0;
  const visited = new Set<string>();

  for (let row = 0; row < next.length; row += 1) {
    for (let col = 0; col < next.length; col += 1) {
      if (next[row][col] !== color) continue;
      const key = `${row},${col}`;
      if (visited.has(key)) continue;
      const { group, liberties } = groupAndLiberties(next, { row, col });
      for (const g of group) visited.add(`${g.row},${g.col}`);
      if (liberties.size === 0) {
        for (const g of group) {
          next[g.row][g.col] = null;
          removed += 1;
        }
      }
    }
  }

  return { board: next, removed };
};
