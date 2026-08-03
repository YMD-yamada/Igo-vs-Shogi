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

export const chooseCpuActionSequence = (state: GameState): Action[] => {
  if (state.winner || state.passCurtain) return [];

  if (state.activeSide === "go") {
    let rngState = state.rngState;
    if (state.goPressure >= state.config.pressureReleaseAt) {
      const roll = nextRng(rngState);
      rngState = roll.state;
      if (roll.value < 0.45) return [{ type: "go_release" }];
    }

    const empties = emptyCells(state.goBoard);
    let best: Coord | null = null;
    let bestScore = -999;

    for (const at of empties) {
      const captured = captureCountIfPlace(state, at);
      if (captured < 0) continue;
      let score = captured * 10;
      const center = (state.config.goSize - 1) / 2;
      score -= Math.abs(at.row - center) + Math.abs(at.col - center);
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

    if (best) return [{ type: "go_place", at: best }];
    return [{ type: "go_pass" }];
  }

  // Shogi CPU
  let rngState = state.rngState;
  if (state.shogiPressure >= state.config.pressureReleaseAt) {
    const empties = emptyCells(state.goBoard).length;
    if (empties >= 3) {
      const roll = nextRng(rngState);
      rngState = roll.state;
      if (roll.value < 0.4) return [{ type: "shogi_release" }];
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

  for (const kind of ["gold", "silver", "knight", "pawn"] as HandKind[]) {
    const drops = getLegalDrops(state.shogiBoard, state.shogiHand, kind);
    if (drops.length > 0) {
      return [
        { type: "shogi_select_hand", kind },
        { type: "shogi_drop", to: drops[0] },
      ];
    }
  }

  // Last resort: spend pressure if any
  if (state.shogiPressure >= state.config.pressureReleaseAt) {
    return [{ type: "shogi_release" }];
  }

  return [];
};

export const chooseCpuAction = (state: GameState): Action | null => {
  const seq = chooseCpuActionSequence(state);
  return seq[0] ?? null;
};

export const runCpuTurn = (state: GameState): GameState => {
  let current = state;
  if (current.passCurtain) {
    current = applyAction(current, { type: "dismiss_curtain" }).state;
  }
  const side = current.activeSide;
  let seq = chooseCpuActionSequence(current);
  if (seq.length === 0 && side === "shogi") {
    if (current.shogiPressure >= current.config.pressureReleaseAt) {
      seq = [{ type: "shogi_release" }];
    } else {
      // Immobilized — resign as CPU
      return applyAction(current, { type: "resign", side: "shogi" }).state;
    }
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
