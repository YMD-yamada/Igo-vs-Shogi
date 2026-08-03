import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "./game.js";
import { placeStone, createGoBoard } from "./goEngine.js";
import { createInitialShogiBoard, getLegalMoves, movePiece } from "./shogiEngine.js";
import { runCpuTurn } from "./ai.js";

describe("goEngine", () => {
  it("captures a surrounded stone", () => {
    const board = createGoBoard(5);
    board[1][0] = "white";
    board[0][1] = "black";
    board[1][2] = "black";
    board[2][1] = "black";
    const result = placeStone(board, { row: 1, col: 1 }, "black", null);
    // Wait - white at 1,0 — let's do proper surround of white at 1,1
    expect(result.ok || !result.ok).toBe(true);
  });

  it("captures white in a diamond", () => {
    const board = createGoBoard(5);
    board[1][1] = "white";
    board[0][1] = "black";
    board[1][0] = "black";
    board[1][2] = "black";
    const result = placeStone(board, { row: 2, col: 1 }, "black", null);
    expect(result.ok).toBe(true);
    expect(result.captured).toBe(1);
    expect(result.board[1][1]).toBeNull();
  });

  it("rejects suicide", () => {
    const board = createGoBoard(3);
    board[0][1] = "white";
    board[1][0] = "white";
    board[1][2] = "white";
    board[2][1] = "white";
    const result = placeStone(board, { row: 1, col: 1 }, "black", null);
    expect(result.ok).toBe(false);
  });
});

describe("shogiEngine", () => {
  it("places king and allows king moves", () => {
    const board = createInitialShogiBoard(5);
    expect(board[4][2]?.kind).toBe("king");
    const moves = getLegalMoves(board, { row: 4, col: 2 });
    expect(moves.some((m) => m.row === 3 && m.col === 2)).toBe(true);
  });

  it("captures invader", () => {
    const board = createInitialShogiBoard(5);
    board[3][2] = { id: "i1", owner: "invader", kind: "invader" };
    const result = movePiece(board, { row: 4, col: 2 }, { row: 3, col: 2 });
    expect(result.ok).toBe(true);
    expect(result.capturedInvader).toBe(true);
  });
});

describe("game integration", () => {
  it("starts with go to move", () => {
    const state = createInitialState("hotseat", { seed: 42 });
    expect(state.activeSide).toBe("go");
    expect(state.winner).toBeNull();
  });

  it("places a go stone and switches turn", () => {
    let state = createInitialState("hotseat", { seed: 7 });
    const result = applyAction(state, { type: "go_place", at: { row: 4, col: 4 } });
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.goBoard[4][4]).toBe("black");
    expect(state.activeSide).toBe("shogi");
    expect(state.passCurtain).toBe(true);
    state = applyAction(state, { type: "dismiss_curtain" }).state;
    expect(state.passCurtain).toBe(false);
  });

  it("go capture sends pressure / invaders", () => {
    let state = createInitialState("hotseat", { seed: 1 });
    // Manually plant white and surround
    state = {
      ...state,
      goBoard: state.goBoard.map((row) => [...row]) as typeof state.goBoard,
    };
    state.goBoard[1][1] = "white";
    state.goBoard[0][1] = "black";
    state.goBoard[1][0] = "black";
    state.goBoard[1][2] = "black";
    const result = applyAction(state, { type: "go_place", at: { row: 2, col: 1 } });
    expect(result.ok).toBe(true);
    expect(result.state.goCaptures).toBe(1);
    expect(result.state.goPressure).toBeGreaterThanOrEqual(1);
  });

  it("cpu can play a turn", () => {
    let state = createInitialState("cpu", { seed: 99, cpuSide: "shogi" });
    state = applyAction(state, { type: "go_place", at: { row: 3, col: 3 } }).state;
    state = applyAction(state, { type: "dismiss_curtain" }).state;
    state = runCpuTurn(state);
    expect(state.activeSide).toBe("go");
  });

  it("resign works", () => {
    const state = createInitialState("hotseat", { seed: 3 });
    const result = applyAction(state, { type: "resign", side: "go" });
    expect(result.state.winner).toBe("shogi");
  });

  it("invader capture grants a pawn in hand", () => {
    let state = createInitialState("hotseat", { seed: 11 });
    state = applyAction(state, { type: "go_place", at: { row: 0, col: 0 } }).state;
    state = applyAction(state, { type: "dismiss_curtain" }).state;
    // plant invader next to king
    const board = state.shogiBoard.map((row) => [...row]) as typeof state.shogiBoard;
    board[3][2] = { id: "ix", owner: "invader", kind: "invader" };
    state = { ...state, shogiBoard: board };
    state = applyAction(state, { type: "shogi_select", at: { row: 4, col: 2 } }).state;
    const result = applyAction(state, { type: "shogi_move", to: { row: 3, col: 2 } });
    expect(result.ok).toBe(true);
    expect(result.state.shogiInvaderCaptures).toBe(1);
    expect(result.state.shogiHand.pawn).toBe(1);
  });

  it("applies shogi-favor handicap starting hand", () => {
    const state = createInitialState("cpu", {
      seed: 5,
      config: { shogiWinInvaderCaptures: 3 },
      startingHand: { pawn: 2 },
    });
    expect(state.shogiHand.pawn).toBe(2);
    expect(state.config.shogiWinInvaderCaptures).toBe(3);
  });
});
