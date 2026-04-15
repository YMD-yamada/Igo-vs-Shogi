import type { Coord, IgoBoard, IgoMoveOutcome, IgoStone } from "./types";

const neighbors = (size: number, point: Coord): Coord[] => {
  const steps: Coord[] = [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ];
  return steps.filter(
    (p) => p.row >= 0 && p.row < size && p.col >= 0 && p.col < size,
  );
};

const cloneBoard = (board: IgoBoard): IgoBoard =>
  board.map((row) => [...row]) as IgoBoard;

const groupAndLiberties = (
  board: IgoBoard,
  point: Coord,
): { group: Coord[]; liberties: number } => {
  const color = board[point.row][point.col];
  if (!color) {
    return { group: [], liberties: 0 };
  }

  const seen = new Set<string>();
  const group: Coord[] = [];
  const libertySet = new Set<string>();
  const queue: Coord[] = [point];

  while (queue.length > 0) {
    const current = queue.pop() as Coord;
    const key = `${current.row},${current.col}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    group.push(current);

    for (const next of neighbors(board.length, current)) {
      const cell = board[next.row][next.col];
      if (cell === null) {
        libertySet.add(`${next.row},${next.col}`);
      } else if (cell === color) {
        const nextKey = `${next.row},${next.col}`;
        if (!seen.has(nextKey)) {
          queue.push(next);
        }
      }
    }
  }

  return { group, liberties: libertySet.size };
};

export const createIgoBoard = (size: number): IgoBoard =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null));

export const placeStone = (
  board: IgoBoard,
  point: Coord,
  stone: IgoStone,
): IgoMoveOutcome => {
  if (!stone) {
    return { ok: false, board, captured: 0, reason: "石の色が不正です。" };
  }
  if (board[point.row][point.col] !== null) {
    return { ok: false, board, captured: 0, reason: "既に石があります。" };
  }

  const nextBoard = cloneBoard(board);
  nextBoard[point.row][point.col] = stone;

  let captured = 0;
  const enemy: IgoStone = stone === "black" ? "white" : "black";

  for (const adj of neighbors(board.length, point)) {
    if (nextBoard[adj.row][adj.col] !== enemy) {
      continue;
    }
    const enemyGroup = groupAndLiberties(nextBoard, adj);
    if (enemyGroup.liberties === 0) {
      for (const stonePoint of enemyGroup.group) {
        nextBoard[stonePoint.row][stonePoint.col] = null;
        captured += 1;
      }
    }
  }

  const selfGroup = groupAndLiberties(nextBoard, point);
  if (selfGroup.liberties === 0) {
    return {
      ok: false,
      board,
      captured: 0,
      reason: "自殺手は禁止です。",
    };
  }

  return { ok: true, board: nextBoard, captured };
};

export const randomEmptyCells = (
  board: IgoBoard,
  count: number,
): Coord[] => {
  const empties: Coord[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === null) {
        empties.push({ row, col });
      }
    }
  }

  const shuffled = [...empties];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  return shuffled.slice(0, Math.max(0, count));
};
