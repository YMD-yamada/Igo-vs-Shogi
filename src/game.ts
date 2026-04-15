import { createIgoBoard, placeStone, randomEmptyCells } from "./igoEngine";
import {
  createInitialShogiBoard,
  moveShogiPiece,
  randomFriendlyPieceCells,
} from "./shogiEngine";
import type { Coord, GameState, Player, ScoreBoard } from "./types";

const IGO_SIZE = 9;
const IGO_CAPTURE_TO_WIN = 5;
const SHOGI_CAPTURE_TO_WIN = 3;
const MAX_LOG_LINES = 12;

const logLine = (state: GameState, text: string): string[] =>
  [text, ...state.log].slice(0, MAX_LOG_LINES);

const nextTurn = (state: GameState): GameState => {
  const nextPlayer: Player = state.activePlayer === "igo" ? "shogi" : "igo";
  return {
    ...state,
    activePlayer: nextPlayer,
    turn: nextPlayer === "igo" ? state.turn + 1 : state.turn,
    selectedShogiCell: null,
  };
};

const resolveWinner = (state: GameState): Player | "draw" | null => {
  if (state.igoCaptures >= IGO_CAPTURE_TO_WIN) {
    return "igo";
  }
  if (state.shogiCaptures >= SHOGI_CAPTURE_TO_WIN) {
    return "shogi";
  }
  return null;
};

export const createInitialState = (): GameState => ({
  turn: 1,
  activePlayer: "igo",
  igoBoard: createIgoBoard(IGO_SIZE),
  shogiBoard: createInitialShogiBoard(),
  igoCaptures: 0,
  shogiCaptures: 0,
  pendingIgoHazards: 0,
  pendingShogiHazards: 0,
  sentToIgo: 0,
  sentToShogi: 0,
  receivedByIgo: 0,
  receivedByShogi: 0,
  selectedShogiCell: null,
  winner: null,
  log: ["新しい対戦を開始しました。先手は囲碁です。"],
});

export const resetGame = (): GameState => createInitialState();

const applyHazardToIgo = (state: GameState): GameState => {
  if (state.pendingIgoHazards <= 0) {
    return state;
  }

  const targets = randomEmptyCells(state.igoBoard, state.pendingIgoHazards);
  if (targets.length === 0) {
    return {
      ...state,
      pendingIgoHazards: 0,
      log: logLine(state, "将棋妨害は不発（囲碁盤に空きなし）"),
    };
  }

  const board = state.igoBoard.map((row) => [...row]) as typeof state.igoBoard;
  for (const target of targets) {
    board[target.row][target.col] = "white";
  }

  return {
    ...state,
    igoBoard: board,
    pendingIgoHazards: 0,
    receivedByIgo: state.receivedByIgo + targets.length,
    log: logLine(state, `将棋妨害: 白石 ${targets.length} 個を落下`),
  };
};

const applyHazardToShogi = (state: GameState): GameState => {
  if (state.pendingShogiHazards <= 0) {
    return state;
  }

  const targets = randomFriendlyPieceCells(
    state.shogiBoard,
    "shogi",
    state.pendingShogiHazards,
  );

  if (targets.length === 0) {
    return {
      ...state,
      pendingShogiHazards: 0,
      log: logLine(state, "囲碁妨害は不発（将棋駒なし）"),
    };
  }

  const board = state.shogiBoard.map((row) => [...row]) as typeof state.shogiBoard;
  for (const target of targets) {
    board[target.row][target.col] = null;
  }

  return {
    ...state,
    shogiBoard: board,
    pendingShogiHazards: 0,
    receivedByShogi: state.receivedByShogi + targets.length,
    log: logLine(state, `囲碁妨害: 将棋駒 ${targets.length} 枚を消去`),
  };
};

export const playIgoMove = (
  state: GameState,
  to: Coord,
): { state: GameState; message: string } => {
  if (state.winner) {
    return { state, message: "対局は終了しています。" };
  }
  if (state.activePlayer !== "igo") {
    return { state, message: "将棋側の手番です。" };
  }

  const afterHazard = applyHazardToIgo(state);
  const move = placeStone(afterHazard.igoBoard, to, "black");
  if (!move.ok) {
    const nextState = {
      ...afterHazard,
      log: logLine(afterHazard, `囲碁: ${move.reason ?? "不正な手"}`),
    };
    return { state: nextState, message: move.reason ?? "不正な手です。" };
  }

  const progressed = {
    ...afterHazard,
    igoBoard: move.board,
    igoCaptures: afterHazard.igoCaptures + move.captured,
    pendingShogiHazards: afterHazard.pendingShogiHazards + move.captured,
    sentToShogi: afterHazard.sentToShogi + move.captured,
    log: logLine(
      afterHazard,
      `囲碁: (${to.row + 1},${to.col + 1}) に着手 / 捕獲 ${move.captured}`,
    ),
  };

  const winner = resolveWinner(progressed);
  const ended = { ...progressed, winner };
  return {
    state: winner ? ended : nextTurn(ended),
    message: winner ? "勝敗が決まりました。" : "囲碁の手を完了しました。",
  };
};

export const playShogiMove = (
  state: GameState,
  from: Coord,
  to: Coord,
): { state: GameState; message: string } => {
  if (state.winner) {
    return { state, message: "対局は終了しています。" };
  }
  if (state.activePlayer !== "shogi") {
    return { state, message: "囲碁側の手番です。" };
  }

  const afterHazard = applyHazardToShogi(state);
  const move = moveShogiPiece(afterHazard.shogiBoard, from, to);
  if (!move.ok) {
    const nextState = {
      ...afterHazard,
      log: logLine(afterHazard, `将棋: ${move.reason ?? "不正な手"}`),
    };
    return { state: nextState, message: move.reason ?? "不正な手です。" };
  }

  const capturedInvader = move.capturedInvader ? 1 : 0;
  const progressed = {
    ...afterHazard,
    shogiBoard: move.board,
    shogiCaptures: afterHazard.shogiCaptures + capturedInvader,
    pendingIgoHazards: afterHazard.pendingIgoHazards + capturedInvader,
    sentToIgo: afterHazard.sentToIgo + capturedInvader,
    log: logLine(
      afterHazard,
      `将棋: (${from.row + 1},${from.col + 1}) -> (${to.row + 1},${to.col + 1})${capturedInvader ? " / 侵入駒を捕獲" : ""}`,
    ),
  };

  const winner = resolveWinner(progressed);
  const ended = { ...progressed, winner };
  return {
    state: winner ? ended : nextTurn(ended),
    message: winner ? "勝敗が決まりました。" : "将棋の手を完了しました。",
  };
};

export const getScores = (state: GameState): ScoreBoard => {
  const igoStones = state.igoBoard.flat().filter((cell) => cell === "black").length;
  const shogiPieces = state.shogiBoard
    .flat()
    .filter((cell) => cell && cell.owner === "shogi").length;

  return {
    igo: {
      stones: igoStones,
      captures: state.igoCaptures,
      sentHazards: state.sentToShogi,
      receivedHazards: state.receivedByIgo,
      total: igoStones + state.igoCaptures * 2 - state.receivedByIgo,
    },
    shogi: {
      pieces: shogiPieces,
      captures: state.shogiCaptures,
      sentHazards: state.sentToIgo,
      receivedHazards: state.receivedByShogi,
      total: shogiPieces + state.shogiCaptures * 2 - state.receivedByShogi,
    },
  };
};
