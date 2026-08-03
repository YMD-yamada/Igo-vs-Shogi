import { applyAction } from "./game.js";
import {
  emptyCells,
  findKing,
  getLegalDrops,
  getLegalMoves,
  movePiece,
  neighbors,
  pieceGroupAndLiberties,
  placeStone,
  stoneGroupAndLiberties,
} from "./board.js";
import { nextRng } from "./rng.js";
import { recordAction, type MatchRecorder } from "./matchLog.js";
import type { Action, Coord, GameState, HandKind } from "./types.js";

const keyOf = (c: Coord): string => `${c.row},${c.col}`;

const libertyCount = (board: GameState["board"], at: Coord): number =>
  pieceGroupAndLiberties(board, at).liberties.size;

const stoneIsFeed = (board: GameState["board"], at: Coord): boolean => {
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board.length; c += 1) {
      if (board[r][c]?.type !== "piece") continue;
      if (
        getLegalMoves(board, { row: r, col: c }).some(
          (m) => m.row === at.row && m.col === at.col,
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

const pickScored = <T extends { score: number }>(
  items: T[],
  rngState: number,
  margin: number,
): { item: T; rngState: number } | null => {
  if (items.length === 0) return null;
  const best = Math.max(...items.map((i) => i.score));
  const pool = items.filter((i) => i.score >= best - margin);
  const roll = nextRng(rngState);
  const item = pool[Math.floor(roll.value * pool.length) % pool.length];
  return { item, rngState: roll.state };
};

export const chooseCpuActionSequence = (state: GameState): Action[] => {
  if (state.winner || state.passCurtain) return [];

  if (state.activeSide === "go") {
    const empties = emptyCells(state.board);
    const king = findKing(state.board);
    const campLibs = king
      ? pieceGroupAndLiberties(state.board, king).liberties
      : new Set<string>();

    let focusLibs = new Set<string>();
    let focusBonus = 0;
    let bestLibCount = 99;
    for (let r = 0; r < state.board.length; r += 1) {
      for (let c = 0; c < state.board.length; c += 1) {
        if (state.board[r][c]?.type !== "piece") continue;
        const { group, liberties } = pieceGroupAndLiberties(state.board, {
          row: r,
          col: c,
        });
        if (group.length !== 1) continue;
        if (liberties.size < bestLibCount) {
          bestLibCount = liberties.size;
          focusLibs = liberties;
          focusBonus = 22 + Math.max(0, 5 - liberties.size) * 12;
        }
      }
    }

    const scored: { at: Coord; score: number }[] = [];
    for (const at of empties) {
      const probe = placeStone(state.board, at, state.koPoint);
      if (!probe.ok) continue;
      let score = probe.capturedPieces.length * 55;
      if (probe.capturedPieces.some((p) => p.kind === "king")) score += 5000;

      const key = keyOf(at);
      if (focusLibs.has(key)) score += focusBonus;
      if (bestLibCount === 1 && focusLibs.has(key)) score += 35;

      if (campLibs.has(key) && focusLibs.size === 0) {
        if (!stoneIsFeed(probe.board, at)) score += 7;
      }

      let feedHits = 0;
      for (const g of stoneGroupAndLiberties(probe.board, at).group) {
        if (stoneIsFeed(probe.board, g)) feedHits += 1;
      }
      const ownLibs = stoneGroupAndLiberties(probe.board, at).liberties.size;
      if (ownLibs <= 1) score -= 35;
      if (ownLibs === 2 && feedHits > 0) score -= 36;
      else if (feedHits > 0) score -= 5 * feedHits;

      const center = (state.config.size - 1) / 2;
      score -= (Math.abs(at.row - center) + Math.abs(at.col - center)) * 0.2;
      scored.push({ at, score });
    }

    // Keep atari finishes sharp; otherwise soften with temperature
    const atari = scored.filter((s) => {
      const probe = placeStone(state.board, s.at, state.koPoint);
      return probe.ok && probe.capturedPieces.length > 0;
    });
    const pool = atari.length > 0 ? atari : scored;
    const picked = pickScored(pool, state.rngState, atari.length > 0 ? 1 : 4);
    if (picked) return [{ type: "go_place", at: picked.item.at }];
    return [{ type: "go_pass" }];
  }

  type Cand = { from: Coord; to: Coord; score: number };
  const cands: Cand[] = [];
  const kingPos = findKing(state.board);

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board.length; col += 1) {
      const from = { row, col };
      const cell = state.board[row][col];
      if (cell?.type !== "piece") continue;
      const libsBefore = libertyCount(state.board, from);
      const solo =
        pieceGroupAndLiberties(state.board, from).group.length === 1;

      for (const to of getLegalMoves(state.board, from)) {
        const moved = movePiece(state.board, from, to);
        if (!moved.ok) continue;
        const libsAfter = libertyCount(moved.board, to);
        let score = 0;

        if (moved.capturedStone) score += 17;
        if (libsBefore <= 2) score += 22;
        if (libsBefore === 1) score += 18;
        if (libsAfter <= 1) score -= 28;
        if (libsAfter === 0) score -= 120;
        score += libsAfter * 1.4;

        if (cell.piece.kind === "king") {
          score += libsAfter * 2.5;
          if (moved.capturedStone) score -= 8;
        }

        if (kingPos && cell.piece.kind !== "king") {
          const beforeDist =
            Math.abs(from.row - kingPos.row) + Math.abs(from.col - kingPos.col);
          const afterDist =
            Math.abs(to.row - kingPos.row) + Math.abs(to.col - kingPos.col);
          if (afterDist < beforeDist) score += solo ? 5 : 3;
        }

        let friends = 0;
        for (const n of neighbors(state.config.size, to)) {
          if (moved.board[n.row][n.col]?.type === "piece") friends += 1;
          if (state.board[n.row][n.col]?.type === "stone") score += 1.6;
        }
        score += friends * 1.3;

        cands.push({ from, to, score });
      }
    }
  }

  const movePick = pickScored(
    cands.filter((c) => c.score > -50),
    state.rngState,
    5,
  );
  if (movePick) {
    const pick = movePick.item;
    return [
      { type: "shogi_select", at: pick.from },
      { type: "shogi_move", to: pick.to },
    ];
  }

  for (const kind of ["gold", "silver", "knight", "pawn"] as HandKind[]) {
    const drops = getLegalDrops(state.board, state.shogiHand, kind);
    if (drops.length === 0) continue;
    const dropScored = drops.map((to) => {
      let score = 0;
      for (const n of neighbors(state.config.size, to)) {
        const cell = state.board[n.row][n.col];
        if (cell?.type === "piece") {
          const libs = libertyCount(state.board, n);
          if (libs <= 2) score += 14;
          score += 2;
        }
        if (cell?.type === "stone") score += 2;
      }
      return { to, score };
    });
    const bestDrop = Math.max(...dropScored.map((d) => d.score));
    const roll = nextRng(state.rngState);
    const pool =
      bestDrop > 0
        ? dropScored.filter((d) => d.score >= bestDrop - 4)
        : dropScored;
    const to = pool[Math.floor(roll.value * pool.length) % pool.length].to;
    return [
      { type: "shogi_select_hand", kind },
      { type: "shogi_drop", to },
    ];
  }

  if (cands.length > 0) {
    const pick = cands.sort((a, b) => b.score - a.score)[0];
    return [
      { type: "shogi_select", at: pick.from },
      { type: "shogi_move", to: pick.to },
    ];
  }

  return [];
};

export const chooseCpuAction = (state: GameState): Action | null =>
  chooseCpuActionSequence(state)[0] ?? null;

export const runCpuTurn = (
  state: GameState,
  recorder?: MatchRecorder,
): GameState => {
  let current = state;
  if (current.passCurtain) {
    current = applyAction(current, { type: "dismiss_curtain" }).state;
  }
  // Advance RNG so temperature picks diverge across plies
  let rng = nextRng(current.rngState);
  current = { ...current, rngState: rng.state };
  rng = nextRng(current.rngState);
  current = { ...current, rngState: rng.state };

  const side = current.activeSide;
  const seq = chooseCpuActionSequence(current);
  if (seq.length === 0 && side === "shogi") {
    const result = applyAction(current, { type: "resign", side: "shogi" });
    if (recorder) recordAction(recorder, { type: "resign", side: "shogi" }, result.state, side);
    return result.state;
  }
  for (const action of seq) {
    const from = current.selectedShogi ?? undefined;
    const handKind = current.selectedHand ?? undefined;
    const result = applyAction(current, action);
    if (result.ok && recorder) {
      recordAction(recorder, action, result.state, side, {
        from: from ?? undefined,
        handKind: handKind ?? undefined,
      });
    }
    current = result.state;
    if (!result.ok) break;
  }
  if (!current.winner && current.activeSide === side && side === "go") {
    const result = applyAction(current, { type: "go_pass" });
    if (recorder) recordAction(recorder, { type: "go_pass" }, result.state, side);
    current = result.state;
  }
  if (!current.winner && current.activeSide === side && side === "shogi") {
    const result = applyAction(current, { type: "resign", side: "shogi" });
    if (recorder) recordAction(recorder, { type: "resign", side: "shogi" }, result.state, side);
    current = result.state;
  }
  return current;
};
