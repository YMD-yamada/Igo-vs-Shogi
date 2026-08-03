import type {
  Action,
  GameMode,
  GameState,
  MatchConfig,
  Outcome,
  Side,
} from "./types.js";
import type { HandicapId } from "./handicaps.js";

/** Compact plies for long-term balance / feedback analysis. */
export type MatchPly = {
  t: number;
  s: Side;
  a: string;
};

export type MatchLogV1 = {
  v: 1;
  id: string;
  startedAt: number;
  endedAt: number;
  mode: GameMode;
  handicapId?: HandicapId;
  config: Pick<MatchConfig, "goWinCaptures" | "shogiWinStones" | "turnLimit">;
  seed: number;
  humanSide?: Side | null;
  cpuSide?: Side | null;
  roomId?: string;
  winner: Outcome;
  turns: number;
  goCaptures: number;
  shogiStoneCaptures: number;
  plyCount: number;
  plies: MatchPly[];
  tags?: string[];
  appVersion?: string;
};

export const makeMatchId = (seed: number, startedAt: number): string =>
  `m_${startedAt.toString(36)}_${(seed >>> 0).toString(36)}`;

export interface MatchRecorder {
  startedAt: number;
  plies: MatchPly[];
  mode: GameMode;
  handicapId?: HandicapId;
  humanSide?: Side | null;
  cpuSide?: Side | null;
  roomId?: string;
  seed: number;
  config: MatchConfig;
  tags?: string[];
  appVersion?: string;
}

export const createMatchRecorder = (opts: {
  state: GameState;
  handicapId?: HandicapId;
  humanSide?: Side | null;
  roomId?: string;
  tags?: string[];
  appVersion?: string;
}): MatchRecorder => ({
  startedAt: Date.now(),
  plies: [],
  mode: opts.state.mode,
  handicapId: opts.handicapId,
  humanSide: opts.humanSide ?? null,
  cpuSide: opts.state.cpuSide,
  roomId: opts.roomId,
  seed: opts.state.seed,
  config: opts.state.config,
  tags: opts.tags,
  appVersion: opts.appVersion,
});

/** Encode a resolved action. Pass handKind when recording a drop. */
export const encodeAction = (
  action: Action,
  opts?: { handKind?: string; from?: { row: number; col: number } },
): string | null => {
  switch (action.type) {
    case "go_place":
      return `g:${action.at.row},${action.at.col}`;
    case "go_pass":
      return "gp";
    case "shogi_move": {
      const from = opts?.from;
      return from
        ? `m:${from.row},${from.col}:${action.to.row},${action.to.col}`
        : `m:${action.to.row},${action.to.col}`;
    }
    case "shogi_drop": {
      const k = (opts?.handKind ?? "?")[0];
      return `d:${k}:${action.to.row},${action.to.col}`;
    }
    case "resign":
      return `R:${action.side[0]}`;
    default:
      return null;
  }
};

export const recordEncodedPly = (
  recorder: MatchRecorder,
  code: string,
  stateAfter: GameState,
  side: Side,
): void => {
  recorder.plies.push({ t: stateAfter.turn, s: side, a: code });
};

export const recordAction = (
  recorder: MatchRecorder,
  action: Action,
  stateAfter: GameState,
  side: Side,
  opts?: { handKind?: string; from?: { row: number; col: number } },
): void => {
  const code = encodeAction(action, opts);
  if (!code) return;
  recordEncodedPly(recorder, code, stateAfter, side);
};

export const finalizeMatchLog = (
  recorder: MatchRecorder,
  state: GameState,
): MatchLogV1 | null => {
  if (!state.winner) return null;
  return {
    v: 1,
    id: makeMatchId(recorder.seed, recorder.startedAt),
    startedAt: recorder.startedAt,
    endedAt: Date.now(),
    mode: recorder.mode,
    handicapId: recorder.handicapId,
    config: {
      goWinCaptures: recorder.config.goWinCaptures,
      shogiWinStones: recorder.config.shogiWinStones,
      turnLimit: recorder.config.turnLimit,
    },
    seed: recorder.seed,
    humanSide: recorder.humanSide,
    cpuSide: recorder.cpuSide,
    roomId: recorder.roomId,
    winner: state.winner,
    turns: state.turn,
    goCaptures: state.goCaptures,
    shogiStoneCaptures: state.shogiStoneCaptures,
    plyCount: recorder.plies.length,
    plies: recorder.plies,
    tags: recorder.tags,
    appVersion: recorder.appVersion,
  };
};
