import { applyAction } from "./game.js";
import {
  emptyCells,
  getLegalDrops,
  getLegalMoves,
  neighbors,
  pieceLiberties,
  placeStone,
  stoneGroupAndLiberties,
} from "./board.js";
import { nextRng } from "./rng.js";
import type { Action, Coord, GameState, HandKind } from "./types.js";

export const chooseCpuActionSequence = (state: GameState): Action[] => {
  if (state.winner || state.passCurtain) return [];

  if (state.activeSide === "go") {
    const empties = emptyCells(state.board);
    let best: Coord | null = null;
    let bestScore = -999;

    for (const at of empties) {
      const probe = placeStone(state.board, at, state.koPoint);
      if (!probe.ok) continue;
      let score = probe.capturedPieces.length * 20;
      if (probe.capturedPieces.some((p) => p.kind === "king")) score += 1000;
      const center = (state.config.size - 1) / 2;
      score -= (Math.abs(at.row - center) + Math.abs(at.col - center)) * 0.4;
      // Prefer tightening pieces with few liberties
      for (const n of neighbors(state.config.size, at)) {
        const cell = state.board[n.row][n.col];
        if (cell?.type === "piece") {
          const libs = pieceLiberties(state.board, n).length;
          if (libs <= 2) score += 6 - libs;
        }
        if (cell?.type === "stone") {
          const { liberties } = stoneGroupAndLiberties(state.board, n);
          if (liberties.size <= 2) score += 2;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = at;
      }
    }
    if (best) return [{ type: "go_place", at: best }];
    return [{ type: "go_pass" }];
  }

  // Prefer capturing stones
  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board.length; col += 1) {
      const from = { row, col };
      const cell = state.board[row][col];
      if (cell?.type !== "piece") continue;
      for (const to of getLegalMoves(state.board, from)) {
        if (state.board[to.row][to.col]?.type === "stone") {
          return [
            { type: "shogi_select", at: from },
            { type: "shogi_move", to },
          ];
        }
      }
    }
  }

  // Escape low-liberty pieces / improve king safety
  const center = (state.config.size - 1) / 2;
  let bestFrom: Coord | null = null;
  let bestTo: Coord | null = null;
  let best = -999;

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board.length; col += 1) {
      const from = { row, col };
      const cell = state.board[row][col];
      if (cell?.type !== "piece") continue;
      const libs = pieceLiberties(state.board, from).length;
      for (const to of getLegalMoves(state.board, from)) {
        let score = 1;
        if (libs <= 2) score += 5;
        if (cell.piece.kind === "king") {
          score += libs <= 2 ? 8 : -1;
        }
        score -= (Math.abs(to.row - center) + Math.abs(to.col - center)) * 0.15;
        // Prefer moving toward stones to attack
        for (const n of neighbors(state.config.size, to)) {
          if (state.board[n.row][n.col]?.type === "stone") score += 1.5;
        }
        if (score > best) {
          best = score;
          bestFrom = from;
          bestTo = to;
        }
      }
    }
  }

  if (bestFrom && bestTo) {
    return [
      { type: "shogi_select", at: bestFrom },
      { type: "shogi_move", to: bestTo },
    ];
  }

  for (const kind of ["gold", "silver", "knight", "pawn"] as HandKind[]) {
    const drops = getLegalDrops(state.board, state.shogiHand, kind);
    if (drops.length > 0) {
      const roll = nextRng(state.rngState);
      const to = drops[Math.floor(roll.value * drops.length) % drops.length];
      return [
        { type: "shogi_select_hand", kind },
        { type: "shogi_drop", to },
      ];
    }
  }

  return [];
};

export const chooseCpuAction = (state: GameState): Action | null =>
  chooseCpuActionSequence(state)[0] ?? null;

export const runCpuTurn = (state: GameState): GameState => {
  let current = state;
  if (current.passCurtain) {
    current = applyAction(current, { type: "dismiss_curtain" }).state;
  }
  const side = current.activeSide;
  let seq = chooseCpuActionSequence(current);
  if (seq.length === 0 && side === "shogi") {
    return applyAction(current, { type: "resign", side: "shogi" }).state;
  }
  for (const action of seq) {
    const result = applyAction(current, action);
    current = result.state;
    if (!result.ok) break;
  }
  if (!current.winner && current.activeSide === side && side === "go") {
    current = applyAction(current, { type: "go_pass" }).state;
  }
  if (!current.winner && current.activeSide === side && side === "shogi") {
    current = applyAction(current, { type: "resign", side: "shogi" }).state;
  }
  return current;
};
