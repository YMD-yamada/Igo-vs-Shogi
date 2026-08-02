import {
  countStones,
  createGoBoard,
  placeStone,
  rankErosionTargets,
  removeDeadGroups,
} from "./goEngine.js";
import { shuffleInPlace } from "./rng.js";
import {
  createInitialShogiBoard,
  createInvader,
  dropPiece,
  emptyHand,
  findKing,
  getLegalDrops,
  getLegalMoves,
  hasLegalShogiAction,
  movePiece,
  rankInvaderDropTargets,
} from "./shogiEngine.js";
import type {
  Action,
  ApplyResult,
  Coord,
  GameMode,
  GameState,
  HandKind,
  MatchConfig,
  Outcome,
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
  !hasLegalShogiAction(state.shogiBoard, state.shogiHand) &&
  state.shogiPressure < state.config.pressureReleaseAt;

const endTurn = (state: GameState): GameState => {
  const nextSide: Side = state.activeSide === "go" ? "shogi" : "go";
  const advanced = clearSelection({
    ...state,
    activeSide: nextSide,
    turn: state.turn + 1,
    passCurtain: state.mode === "hotseat",
  });

  // After Go hands off, Shogi with no moves and no release loses immediately
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

const clampPressure = (value: number, max: number): number =>
  Math.max(0, Math.min(max, value));

const dropInvaders = (
  state: GameState,
  count: number,
): { state: GameState; dropped: number } => {
  const capped = Math.min(count, state.config.maxInvaderDropPerMove);
  if (capped <= 0) return { state, dropped: 0 };

  const preferred = rankInvaderDropTargets(state.shogiBoard);
  const head = preferred.slice(0, 5);
  const tail = preferred.slice(5);
  let rngState = shuffleInPlace(tail, state.rngState);
  const targets = [...head, ...tail];

  const board = state.shogiBoard.map((row) => [...row]) as typeof state.shogiBoard;
  let dropped = 0;
  for (const t of targets) {
    if (dropped >= capped) break;
    if (board[t.row][t.col]) continue;
    board[t.row][t.col] = createInvader();
    dropped += 1;
  }

  return {
    state: {
      ...state,
      shogiBoard: board,
      rngState,
      log:
        dropped > 0
          ? pushLog(state, `侵攻駒 ${dropped} 個が将棋盤に投下`)
          : state.log,
    },
    dropped,
  };
};

const dropErosion = (
  state: GameState,
  count: number,
): { state: GameState; dropped: number; blackRemoved: number } => {
  const capped = Math.min(count, state.config.maxErosionDropPerMove);
  if (capped <= 0) return { state, dropped: 0, blackRemoved: 0 };

  const ranked = rankErosionTargets(state.goBoard);
  const split = Math.min(ranked.length, Math.ceil(ranked.length * 0.4));
  const head = ranked.slice(0, split);
  const tail = ranked.slice(split);
  let rngState = shuffleInPlace(tail, state.rngState);
  const targets = [...head, ...tail];

  const board = state.goBoard.map((row) => [...row]) as typeof state.goBoard;
  let dropped = 0;
  for (const t of targets) {
    if (dropped >= capped) break;
    if (board[t.row][t.col] !== null) continue;
    board[t.row][t.col] = "white";
    dropped += 1;
  }

  // White dead groups vanish without awarding go captures
  const afterWhite = removeDeadGroups(board, "white");
  // Black dead groups removed → shogi pressure
  const afterBlack = removeDeadGroups(afterWhite.board, "black");
  const blackRemoved = afterBlack.removed;

  let next: GameState = {
    ...state,
    goBoard: afterBlack.board,
    rngState,
    shogiPressure: clampPressure(
      state.shogiPressure + blackRemoved,
      state.config.pressureMax,
    ),
    log:
      dropped > 0
        ? pushLog(state, `侵食石 ${dropped} 個が囲碁盤に落下`)
        : state.log,
  };
  if (blackRemoved > 0) {
    next = {
      ...next,
      log: pushLog(next, `黒石 ${blackRemoved} 個が窒息 → 将棋圧力 +${blackRemoved}`),
    };
  }

  return { state: next, dropped, blackRemoved };
};

const applyGoCaptureInterference = (state: GameState, n: number): GameState => {
  if (n <= 0) return state;
  let pressureGain = 0;
  let invaders = 0;
  if (n === 1) {
    pressureGain = 1;
  } else if (n === 2) {
    pressureGain = 2;
    invaders = 1;
  } else {
    pressureGain = 3;
    invaders = 2;
  }

  let next: GameState = {
    ...state,
    goPressure: clampPressure(state.goPressure + pressureGain, state.config.pressureMax),
    log: pushLog(state, `囲碁捕獲 ${n} → 圧力+${pressureGain}${invaders ? ` / 侵攻${invaders}` : ""}`),
  };
  if (invaders > 0) {
    next = dropInvaders(next, invaders).state;
  }
  return next;
};

const applyInvaderCaptureInterference = (state: GameState, m: number): GameState => {
  if (m <= 0) return state;
  const drops = m * state.config.dropPerInvader;
  return dropErosion(state, drops).state;
};

const syncPeakBlack = (state: GameState): GameState => {
  const black = countStones(state.goBoard, "black");
  if (black <= state.peakBlackStones) return state;
  return { ...state, peakBlackStones: black };
};

const resolveWinner = (state: GameState): Outcome => {
  if (state.goCaptures >= state.config.goWinCaptures) return "go";
  if (state.shogiInvaderCaptures >= state.config.shogiWinInvaderCaptures) {
    return "shogi";
  }

  const blackCount = countStones(state.goBoard, "black");
  // Shogi win by attrition: only after Go once built a real presence
  if (
    state.peakBlackStones >= 12 &&
    blackCount <= state.config.blackStoneFloor
  ) {
    return "shogi";
  }

  if (!findKing(state.shogiBoard)) return "go";

  if (state.turn > state.config.turnLimit) {
    const goScore = state.goCaptures;
    const shogiScore = state.shogiInvaderCaptures * 1.5;
    const diff = Math.abs(goScore - shogiScore);
    if (diff < 1) return "draw";
    return goScore > shogiScore ? "go" : "shogi";
  }

  return null;
};

const withWinner = (state: GameState): GameState => {
  const synced = syncPeakBlack(state);
  let winner = resolveWinner(synced);
  if (!winner && synced.activeSide === "shogi" && shogiIsImmobilized(synced)) {
    winner = "go";
  }
  if (!winner) return synced;
  const label =
    winner === "draw" ? "引き分け" : winner === "go" ? "囲碁側の勝利" : "将棋側の勝利";
  return { ...synced, winner, log: pushLog(synced, label) };
};

export const createInitialState = (
  mode: GameMode = "hotseat",
  options?: {
    config?: Partial<MatchConfig>;
    seed?: number;
    cpuSide?: Side | null;
  },
): GameState => {
  const seed = options?.seed ?? (Date.now() >>> 0);
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  return {
    config,
    mode,
    turn: 1,
    activeSide: "go",
    goBoard: createGoBoard(config.goSize),
    shogiBoard: createInitialShogiBoard(config.shogiSize),
    shogiHand: emptyHand(),
    goCaptures: 0,
    shogiInvaderCaptures: 0,
    goPressure: 0,
    shogiPressure: 0,
    peakBlackStones: 0,
    lastGoMove: null,
    koPoint: null,
    selectedShogi: null,
    selectedHand: null,
    legalShogiTargets: [],
    winner: null,
    log: ["黒白侵攻 — 対局開始。先手は囲碁（黒）。"],
    seed,
    rngState: seed || 1,
    passCurtain: false,
    cpuSide: mode === "cpu" ? (options?.cpuSide ?? "shogi") : null,
  };
};

const finishGoAction = (state: GameState, message: string): ApplyResult => {
  const ended = withWinner(state);
  if (ended.winner) return { state: ended, message, ok: true };
  return { state: endTurn(ended), message, ok: true };
};

const finishShogiAction = (state: GameState, message: string): ApplyResult => {
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

  // —— Go actions ——
  if (action.type === "go_place" || action.type === "go_pass" || action.type === "go_release") {
    if (state.activeSide !== "go") {
      return { state, message: "将棋側の手番です。", ok: false };
    }

    if (action.type === "go_release") {
      if (state.goPressure < state.config.pressureReleaseAt) {
        return { state, message: "圧力が足りません。", ok: false };
      }
      const gauge = state.goPressure;
      const invaders = Math.floor(gauge / 2);
      let next: GameState = {
        ...state,
        goPressure: 0,
        log: pushLog(state, `囲碁が圧力解放（${gauge}）`),
      };
      next = dropInvaders(next, invaders).state;
      return finishGoAction(next, "圧力を解放しました。");
    }

    if (action.type === "go_pass") {
      const next = {
        ...state,
        koPoint: null,
        lastGoMove: null,
        log: pushLog(state, "囲碁: パス"),
      };
      return finishGoAction(next, "パスしました。");
    }

    const placed = placeStone(state.goBoard, action.at, "black", state.koPoint);
    if (!placed.ok) {
      return {
        state: { ...state, log: pushLog(state, `囲碁: ${placed.reason}`) },
        message: placed.reason ?? "不正な手",
        ok: false,
      };
    }

    let next: GameState = {
      ...state,
      goBoard: placed.board,
      goCaptures: state.goCaptures + placed.captured,
      koPoint: placed.koPoint,
      lastGoMove: action.at,
      log: pushLog(
        state,
        `囲碁: (${action.at.row + 1},${action.at.col + 1}) 着手 / 捕獲 ${placed.captured}`,
      ),
    };
    next = applyGoCaptureInterference(next, placed.captured);
    return finishGoAction(next, placed.captured > 0 ? `${placed.captured} 個捕獲` : "着手完了");
  }

  // —— Shogi actions ——
  if (state.activeSide !== "shogi") {
    return { state, message: "囲碁側の手番です。", ok: false };
  }

  if (action.type === "shogi_release") {
    if (state.shogiPressure < state.config.pressureReleaseAt) {
      return { state, message: "圧力が足りません。", ok: false };
    }
    const gauge = state.shogiPressure;
    let next: GameState = {
      ...clearSelection(state),
      shogiPressure: 0,
      log: pushLog(state, `将棋が圧力解放（${gauge}）`),
    };
    next = dropErosion(next, gauge).state;
    return finishShogiAction(next, "圧力を解放しました。");
  }

  if (action.type === "shogi_select") {
    const cell = state.shogiBoard[action.at.row][action.at.col];
    if (!cell || cell.owner !== "shogi") {
      return { state, message: "自分の駒を選んでください。", ok: false };
    }
    return {
      state: {
        ...state,
        selectedShogi: action.at,
        selectedHand: null,
        legalShogiTargets: getLegalMoves(state.shogiBoard, action.at),
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
        legalShogiTargets: getLegalDrops(state.shogiBoard, state.shogiHand, action.kind),
      },
      message: "打ち場所を選んでください。",
      ok: true,
    };
  }

  if (action.type === "shogi_move") {
    if (!state.selectedShogi) {
      return { state, message: "駒を選んでください。", ok: false };
    }
    const moved = movePiece(state.shogiBoard, state.selectedShogi, action.to);
    if (!moved.ok) {
      return { state, message: moved.reason ?? "不正な手", ok: false };
    }
    let next: GameState = {
      ...clearSelection(state),
      shogiBoard: moved.board,
      shogiInvaderCaptures:
        state.shogiInvaderCaptures + (moved.capturedInvader ? 1 : 0),
      shogiHand: moved.capturedInvader
        ? { ...state.shogiHand, pawn: state.shogiHand.pawn + 1 }
        : state.shogiHand,
      log: pushLog(
        state,
        `将棋: (${state.selectedShogi.row + 1},${state.selectedShogi.col + 1})→(${action.to.row + 1},${action.to.col + 1})${moved.capturedInvader ? " 侵攻捕獲（歩入手）" : ""}`,
      ),
    };
    if (moved.capturedInvader) {
      next = applyInvaderCaptureInterference(next, 1);
    }
    return finishShogiAction(next, moved.capturedInvader ? "侵攻駒を捕獲" : "指し完了");
  }

  if (action.type === "shogi_drop") {
    if (!state.selectedHand) {
      return { state, message: "持ち駒を選んでください。", ok: false };
    }
    const dropped = dropPiece(
      state.shogiBoard,
      state.shogiHand,
      state.selectedHand,
      action.to,
    );
    if (!dropped.ok) {
      return { state, message: dropped.reason ?? "不正な手", ok: false };
    }
    const next: GameState = {
      ...clearSelection(state),
      shogiBoard: dropped.board,
      shogiHand: dropped.hand,
      log: pushLog(
        state,
        `将棋: 持ち駒 ${state.selectedHand} を (${action.to.row + 1},${action.to.col + 1}) に打つ`,
      ),
    };
    return finishShogiAction(next, "打ちました。");
  }

  return { state, message: "未知の操作です。", ok: false };
};

export const serializeState = (state: GameState): string => JSON.stringify(state);

export const deserializeState = (raw: string): GameState => JSON.parse(raw) as GameState;

export const sideLabel = (side: Side): string => (side === "go" ? "囲碁" : "将棋");

export type { HandKind };
