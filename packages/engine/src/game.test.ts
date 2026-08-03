import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "./game.js";
import { createInitialBoard, placeStone, movePiece, findKing } from "./board.js";
import { runCpuTurn } from "./ai.js";
import {
  createMatchRecorder,
  encodeAction,
  finalizeMatchLog,
  recordAction,
} from "./matchLog.js";

describe("board", () => {
  it("starts with a king", () => {
    const board = createInitialBoard(9);
    expect(findKing(board)?.row).toBe(8);
    expect(findKing(board)?.col).toBe(4);
  });

  it("captures a surrounded piece group", () => {
    const board = createInitialBoard(9);
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) board[r][c] = null;
    }
    board[4][4] = { type: "piece", piece: { id: "p", kind: "pawn" } };
    board[3][4] = { type: "stone" };
    board[5][4] = { type: "stone" };
    board[4][3] = { type: "stone" };
    const result = placeStone(board, { row: 4, col: 5 }, null);
    expect(result.ok).toBe(true);
    expect(result.capturedPieces.length).toBe(1);
    expect(result.board[4][4]).toBeNull();
  });

  it("connected pieces share liberties", () => {
    const board = createInitialBoard(9);
    const result = placeStone(board, { row: 2, col: 2 }, null);
    expect(result.ok).toBe(true);
    expect(result.capturedPieces.length).toBe(0);
    expect(findKing(board)).not.toBeNull();
  });

  it("shogi captures a stone by landing", () => {
    const board = createInitialBoard(9);
    board[7][4] = { type: "stone" };
    const result = movePiece(board, { row: 8, col: 4 }, { row: 7, col: 4 });
    expect(result.ok).toBe(true);
    expect(result.capturedStone).toBe(true);
  });
});

describe("game", () => {
  it("places stone and switches to shogi", () => {
    let state = createInitialState("hotseat", { seed: 1 });
    const result = applyAction(state, {
      type: "go_place",
      at: { row: 2, col: 4 },
    });
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.board[2][4]?.type).toBe("stone");
    expect(state.activeSide).toBe("shogi");
    expect(state.passCurtain).toBe(true);
  });

  it("cpu can answer", () => {
    let state = createInitialState("cpu", { seed: 9, cpuSide: "shogi" });
    state = applyAction(state, {
      type: "go_place",
      at: { row: 3, col: 3 },
    }).state;
    state = runCpuTurn(state);
    expect(state.activeSide).toBe("go");
  });

  it("resign works", () => {
    const state = createInitialState("hotseat", { seed: 2 });
    expect(
      applyAction(state, { type: "resign", side: "go" }).state.winner,
    ).toBe("shogi");
  });
});

describe("matchLog", () => {
  it("encodes and finalizes a short match", () => {
    let state = createInitialState("cpu", { seed: 42, cpuSide: "shogi" });
    const rec = createMatchRecorder({
      state,
      handicapId: "even",
      humanSide: "go",
    });
    const action = { type: "go_place" as const, at: { row: 2, col: 2 } };
    const placed = applyAction(state, action);
    recordAction(rec, action, placed.state, "go");
    state = placed.state;
    state = runCpuTurn(state, rec);
    const resigned = applyAction(state, { type: "resign", side: "go" });
    recordAction(rec, { type: "resign", side: "go" }, resigned.state, "go");
    const log = finalizeMatchLog(rec, resigned.state);
    expect(log).not.toBeNull();
    expect(log!.winner).toBe("shogi");
    expect(log!.plies.length).toBeGreaterThan(0);
    expect(encodeAction(action)).toBe("g:2,2");
  });
});
