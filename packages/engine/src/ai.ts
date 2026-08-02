import { applyAction } from "./game.js";
import { emptyCells, groupAndLiberties, neighbors, placeStone } from "./goEngine.js";
import { getLegalDrops, getLegalMoves } from "./shogiEngine.js";
import { nextRng } from "./rng.js";
import type { Action, Coord, GameState, HandKind } from "./types.js";

const captureCountIfPlace = (state: GameState, at: Coord): number => {
  const probe = placeStone(state.goBoard, at, "black", state.koPoint);
  if (!probe.ok) return -1;
  return probe.captured;
};

export const chooseCpuAction = (state: GameState): Action | null => {
  if (state.winner || state.passCurtain) return null;

  if (state.activeSide === "go") {
    if (state.goPressure >= state.config.pressureReleaseAt) {
      const roll = nextRng(state.rngState);
      if (roll.value < 0.45) return { type: "go_release" };
    }

    const empties = emptyCells(state.goBoard);
    let best: Coord | null = null;
    let bestScore = -999;

    for (const at of empties) {
      const captured = captureCountIfPlace(state, at);
      if (captured < 0) continue;
      let score = captured * 10;
      // Prefer center
      const center = (state.config.goSize - 1) / 2;
      score -= Math.abs(at.row - center) + Math.abs(at.col - center);
      // Prefer extending low-liberty groups
      for (const n of neighbors(state.config.goSize, at)) {
        if (state.goBoard[n.row][n.col] === "black") {
          const { liberties } = groupAndLiberties(state.goBoard, n);
          if (liberties.size <= 2) score += 3;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = at;
      }
    }

    if (best) return { type: "go_place", at: best };
    return { type: "go_pass" };
  }

  // Shogi CPU
  if (state.shogiPressure >= state.config.pressureReleaseAt) {
    const empties = emptyCells(state.goBoard).length;
    if (empties >= 3) {
      const roll = nextRng(state.rngState);
      if (roll.value < 0.4) return { type: "shogi_release" };
    }
  }

  // Capture invader if possible
  for (let row = 0; row < state.shogiBoard.length; row += 1) {
    for (let col = 0; col < state.shogiBoard.length; col += 1) {
      const from = { row, col };
      const moves = getLegalMoves(state.shogiBoard, from);
      for (const to of moves) {
        const target = state.shogiBoard[to.row][to.col];
        if (target?.owner === "invader") {
          return { type: "shogi_move", to }; // need select first — handled by packed helper
        }
      }
    }
  }

  return chooseShogiPacked(state);
};

/** Returns a sequence-friendly single action; UI/CPU runner may need select then move. */
export const chooseCpuActionSequence = (state: GameState): Action[] => {
  if (state.winner || state.passCurtain) return [];

  if (state.activeSide === "go") {
    const a = chooseCpuAction(state);
    return a ? [a] : [];
  }

  if (state.shogiPressure >= state.config.pressureReleaseAt) {
    const empties = emptyCells(state.goBoard).length;
    if (empties >= 3 && nextRng(state.rngState).value < 0.4) {
      return [{ type: "shogi_release" }];
    }
  }

  // Prefer capturing invaders
  for (let row = 0; row < state.shogiBoard.length; row += 1) {
    for (let col = 0; col < state.shogiBoard.length; col += 1) {
      const from = { row, col };
      const cell = state.shogiBoard[row][col];
      if (!cell || cell.owner !== "shogi") continue;
      for (const to of getLegalMoves(state.shogiBoard, from)) {
        if (state.shogiBoard[to.row][to.col]?.owner === "invader") {
          return [
            { type: "shogi_select", at: from },
            { type: "shogi_move", to },
          ];
        }
      }
    }
  }

  // Score moves by center control
  const center = (state.config.shogiSize - 1) / 2;
  let bestFrom: Coord | null = null;
  let bestTo: Coord | null = null;
  let best = -999;

  for (let row = 0; row < state.shogiBoard.length; row += 1) {
    for (let col = 0; col < state.shogiBoard.length; col += 1) {
      const from = { row, col };
      const cell = state.shogiBoard[row][col];
      if (!cell || cell.owner !== "shogi") continue;
      for (const to of getLegalMoves(state.shogiBoard, from)) {
        let score = 2 - (Math.abs(to.row - center) + Math.abs(to.col - center)) * 0.3;
        if (cell.kind === "king") score -= 1.5;
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

  // Drop from hand
  for (const kind of ["gold", "silver", "knight", "pawn"] as HandKind[]) {
    const drops = getLegalDrops(state.shogiBoard, state.shogiHand, kind);
    if (drops.length > 0) {
      const to = drops[0];
      return [
        { type: "shogi_select_hand", kind },
        { type: "shogi_drop", to },
      ];
    }
  }

  return [];
};

const chooseShogiPacked = (state: GameState): Action | null => {
  const seq = chooseCpuActionSequence(state);
  return seq[0] ?? null;
};

export const runCpuTurn = (state: GameState): GameState => {
  let current = state;
  if (current.passCurtain) {
    current = applyAction(current, { type: "dismiss_curtain" }).state;
  }
  const side = current.activeSide;
  const seq = chooseCpuActionSequence(current);
  for (const action of seq) {
    const result = applyAction(current, action);
    current = result.state;
    if (!result.ok) break;
  }
  // Safety: if still same side, pass for go
  if (!current.winner && current.activeSide === side && side === "go") {
    current = applyAction(current, { type: "go_pass" }).state;
  }
  return current;
};
