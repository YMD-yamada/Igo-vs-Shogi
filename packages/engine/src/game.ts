import {
  countStones,
  createInitialBoard,
  dropPiece,
  emptyHand,
  findKing,
  getLegalDrops,
  getLegalMoves,
  hasLegalShogiAction,
  movePiece,
  placeStone,
} from "./board.js";
import type {
  Action,
  ApplyResult,
  GameMode,
  GameState,
  HandKind,
  MatchConfig,
  Outcome,
  ShogiHand,
  Side,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const MAX_LOG = 16;

const pushLog = (state: GameState, text: string): string[] =>
  [text, ...state.log].slice(0, MAX_LOG);

const clearSelection = (state: GameState): GameState => ({
  ...state,
  selectedShogi: null,
  selectedHand: null,
  legalShogiTargets: [],
});

const shogiIsImmobilized = (state: GameState): boolean =>
  !hasLegalShogiAction(state.board, state.shogiHand);

const endTurn = (state: GameState): GameState => {
  const nextSide: Side = state.activeSide === "go" ? "shogi" : "go";
  const advanced = clearSelection({
    ...state,
    activeSide: nextSide,
    turn: state.turn + 1,
    passCurtain: state.mode === "hotseat",
  });

  if (nextSide === "shogi" && shogiIsImmobilized(advanced)) {
    return {
      ...advanced,
      passCurtain: false,
      winner: "go",
      log: pushLog(advanced, "将棋に合法手なし — 囲碁側の勝利"),
    };
  }
  return advanced;
};

const resolveWinner = (state: GameState): Outcome => {
  if (!findKing(state.board)) return "go";
  if (state.goCaptures >= state.config.goWinCaptures) return "go";
  if (state.shogiStoneCaptures >= state.config.shogiWinStones) return "shogi";

  if (state.turn > state.config.turnLimit) {
    // Prefer draw unless one side clearly led without finishing
    const goScore = state.goCaptures * 3;
    const shogiScore = state.shogiStoneCaptures;
    const diff = Math.abs(goScore - shogiScore);
    if (diff < 4) return "draw";
    return goScore > shogiScore ? "go" : "shogi";
  }
  return null;
};

const withWinner = (state: GameState): GameState => {
  let winner = resolveWinner(state);
  if (!winner && state.activeSide === "shogi" && shogiIsImmobilized(state)) {
    winner = "go";
  }
  if (!winner) return state;
  const label =
    winner === "draw" ? "引き分け" : winner === "go" ? "囲碁側の勝利" : "将棋側の勝利";
  return { ...state, winner, log: pushLog(state, label) };
};

export const createInitialState = (
  mode: GameMode = "hotseat",
  options?: {
    config?: Partial<MatchConfig>;
    seed?: number;
    cpuSide?: Side | null;
    startingHand?: Partial<ShogiHand>;
    removeStartingPieces?: Array<"pawn" | "gold" | "silver" | "knight">;
  },
): GameState => {
  const seed = options?.seed ?? (Date.now() >>> 0);
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  const hand = { ...emptyHand(), ...options?.startingHand };
  const board = createInitialBoard(config.size);

  if (options?.removeStartingPieces?.length) {
    for (const kind of options.removeStartingPieces) {
      outer: for (let row = 0; row < board.length; row += 1) {
        for (let col = 0; col < board.length; col += 1) {
          const cell = board[row][col];
          if (cell?.type === "piece" && cell.piece.kind === kind) {
            board[row][col] = null;
            break outer;
          }
        }
      }
    }
  }

  return {
    config,
    mode,
    turn: 1,
    activeSide: "go",
    board,
    shogiHand: hand,
    goCaptures: 0,
    shogiStoneCaptures: 0,
    lastGoMove: null,
    koPoint: null,
    selectedShogi: null,
    selectedHand: null,
    legalShogiTargets: [],
    winner: null,
    log: ["黒白侵攻 — 一盤戦開始。先手は囲碁（黒）。"],
    seed,
    rngState: seed || 1,
    passCurtain: false,
    cpuSide: mode === "cpu" ? (options?.cpuSide ?? "shogi") : null,
  };
};

const finishGo = (state: GameState, message: string): ApplyResult => {
  const ended = withWinner(state);
  if (ended.winner) return { state: ended, message, ok: true };
  return { state: endTurn(ended), message, ok: true };
};

const finishShogi = (state: GameState, message: string): ApplyResult => {
  const ended = withWinner(state);
  if (ended.winner) return { state: ended, message, ok: true };
  return { state: endTurn(ended), message, ok: true };
};

export const applyAction = (state: GameState, action: Action): ApplyResult => {
  if (action.type === "dismiss_curtain") {
    return { state: { ...state, passCurtain: false }, message: "手番交代", ok: true };
  }

  if (state.passCurtain) {
    return { state, message: "端末を渡してから続行してください。", ok: false };
  }

  if (state.winner) {
    return { state, message: "対局は終了しています。", ok: false };
  }

  if (action.type === "resign") {
    const winner: Side = action.side === "go" ? "shogi" : "go";
    return {
      state: {
        ...state,
        winner,
        log: pushLog(state, `${action.side === "go" ? "囲碁" : "将棋"}が投了`),
      },
      message: "投了しました。",
      ok: true,
    };
  }

  if (action.type === "clear_selection") {
    return { state: clearSelection(state), message: "選択を解除", ok: true };
  }

  if (action.type === "go_place" || action.type === "go_pass") {
    if (state.activeSide !== "go") {
      return { state, message: "将棋側の手番です。", ok: false };
    }

    if (action.type === "go_pass") {
      const next = {
        ...state,
        koPoint: null,
        lastGoMove: null,
        log: pushLog(state, "囲碁: パス"),
      };
      return finishGo(next, "パスしました。");
    }

    const placed = placeStone(state.board, action.at, state.koPoint);
    if (!placed.ok) {
      return {
        state: { ...state, log: pushLog(state, `囲碁: ${placed.reason}`) },
        message: placed.reason ?? "不正な手",
        ok: false,
      };
    }

    const kingTaken = placed.capturedPieces.some((p) => p.kind === "king");
    const next: GameState = {
      ...state,
      board: placed.board,
      goCaptures: state.goCaptures + placed.capturedPieces.length,
      koPoint: placed.koPoint,
      lastGoMove: action.at,
      log: pushLog(
        state,
        `囲碁: (${action.at.row + 1},${action.at.col + 1}) 着手` +
          (placed.capturedPieces.length
            ? ` / 駒取 ${placed.capturedPieces.length}`
            : ""),
      ),
    };
    if (kingTaken) {
      return {
        state: withWinner({ ...next, winner: "go" }),
        message: "王将を捕獲！",
        ok: true,
      };
    }
    return finishGo(
      next,
      placed.capturedPieces.length > 0
        ? `駒を ${placed.capturedPieces.length} 枚捕獲`
        : "着手完了",
    );
  }

  if (state.activeSide !== "shogi") {
    return { state, message: "囲碁側の手番です。", ok: false };
  }

  if (action.type === "shogi_select") {
    const cell = state.board[action.at.row][action.at.col];
    if (cell?.type !== "piece") {
      return { state, message: "自分の駒を選んでください。", ok: false };
    }
    return {
      state: {
        ...state,
        selectedShogi: action.at,
        selectedHand: null,
        legalShogiTargets: getLegalMoves(state.board, action.at),
      },
      message: "移動先を選んでください。",
      ok: true,
    };
  }

  if (action.type === "shogi_select_hand") {
    if (state.shogiHand[action.kind] <= 0) {
      return { state, message: "その持ち駒はありません。", ok: false };
    }
    return {
      state: {
        ...state,
        selectedShogi: null,
        selectedHand: action.kind,
        legalShogiTargets: getLegalDrops(state.board, state.shogiHand, action.kind),
      },
      message: "打ち場所を選んでください。",
      ok: true,
    };
  }

  if (action.type === "shogi_move") {
    if (!state.selectedShogi) {
      return { state, message: "駒を選んでください。", ok: false };
    }
    const moved = movePiece(state.board, state.selectedShogi, action.to);
    if (!moved.ok) {
      return { state, message: moved.reason ?? "不正な手", ok: false };
    }
    // Fresh stone still scores full point, but grants no hand (anti-snowball)
    const fresh =
      moved.capturedStone &&
      state.lastGoMove &&
      state.lastGoMove.row === action.to.row &&
      state.lastGoMove.col === action.to.col;
    const next: GameState = {
      ...clearSelection(state),
      board: moved.board,
      lastGoMove: null,
      shogiStoneCaptures:
        state.shogiStoneCaptures + (moved.capturedStone ? 1 : 0),
      shogiHand:
        moved.capturedStone && !fresh
          ? { ...state.shogiHand, pawn: state.shogiHand.pawn + 1 }
          : state.shogiHand,
      log: pushLog(
        state,
        `将棋: (${state.selectedShogi.row + 1},${state.selectedShogi.col + 1})→(${action.to.row + 1},${action.to.col + 1})` +
          (moved.capturedStone
            ? fresh
              ? " 石取（直後・歩なし）"
              : " 石取（歩入手）"
            : ""),
      ),
    };
    return finishShogi(next, moved.capturedStone ? "黒石を捕獲" : "指し完了");
  }

  if (action.type === "shogi_drop") {
    if (!state.selectedHand) {
      return { state, message: "持ち駒を選んでください。", ok: false };
    }
    const dropped = dropPiece(
      state.board,
      state.shogiHand,
      state.selectedHand,
      action.to,
    );
    if (!dropped.ok) {
      return { state, message: dropped.reason ?? "不正な手", ok: false };
    }
    const next: GameState = {
      ...clearSelection(state),
      board: dropped.board,
      shogiHand: dropped.hand,
      lastGoMove: null,
      log: pushLog(
        state,
        `将棋: 持ち駒 ${state.selectedHand} を (${action.to.row + 1},${action.to.col + 1}) に打つ`,
      ),
    };
    return finishShogi(next, "打ちました。");
  }

  return { state, message: "未知の操作です。", ok: false };
};

export const serializeState = (state: GameState): string => JSON.stringify(state);
export const deserializeState = (raw: string): GameState => JSON.parse(raw) as GameState;
export const sideLabel = (side: Side): string => (side === "go" ? "囲碁" : "将棋");
export type { HandKind };
