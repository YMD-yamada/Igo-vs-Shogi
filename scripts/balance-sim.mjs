/**
 * CPU vs CPU balance harness.
 * Usage: npx tsx scripts/balance-sim.mjs
 */
import {
  applyAction,
  createInitialState,
  HANDICAP_PRESETS,
  runCpuTurn,
} from "../packages/engine/src/index.ts";

const GAMES = Number(process.env.BALANCE_GAMES ?? 80);
const MAX_PLIES = 320;

const playOne = (seed, config, startingHand, removeStartingPieces) => {
  let state = createInitialState("cpu", {
    seed,
    cpuSide: null,
    config,
    startingHand,
    removeStartingPieces,
  });
  state = { ...state, passCurtain: false, mode: "hotseat", cpuSide: null };

  let plies = 0;
  while (!state.winner && plies < MAX_PLIES) {
    if (state.passCurtain) {
      state = applyAction(state, { type: "dismiss_curtain" }).state;
    }
    const side = state.activeSide;
    state = runCpuTurn({ ...state, cpuSide: side, mode: "cpu", passCurtain: false });
    state = { ...state, passCurtain: false };
    if (state.activeSide === side && !state.winner) break;
    plies += 1;
  }
  return {
    winner: state.winner ?? "timeout",
    turns: state.turn,
    goCaptures: state.goCaptures,
    shogiStoneCaptures: state.shogiStoneCaptures,
  };
};

const summarize = (label, results) => {
  const tally = { go: 0, shogi: 0, draw: 0, timeout: 0 };
  let turnSum = 0;
  let goCap = 0;
  let shogiCap = 0;
  for (const r of results) {
    tally[r.winner] = (tally[r.winner] ?? 0) + 1;
    turnSum += r.turns;
    goCap += r.goCaptures;
    shogiCap += r.shogiStoneCaptures;
  }
  const n = results.length;
  const goRate = ((tally.go / n) * 100).toFixed(1);
  const shogiRate = ((tally.shogi / n) * 100).toFixed(1);
  console.log(
    `${label}: n=${n} go=${tally.go}(${goRate}%) shogi=${tally.shogi}(${shogiRate}%) draw=${tally.draw} timeout=${tally.timeout} avgTurn=${(turnSum / n).toFixed(1)} avgGoCap=${(goCap / n).toFixed(2)} avgShogiCap=${(shogiCap / n).toFixed(2)}`,
  );
  return { tally, goRate: Number(goRate), shogiRate: Number(shogiRate) };
};

console.log(`Running ${GAMES} games per handicap…`);
for (const id of Object.keys(HANDICAP_PRESETS)) {
  const preset = HANDICAP_PRESETS[id];
  const results = [];
  for (let i = 0; i < GAMES; i += 1) {
    results.push(
      playOne(
        1000 + i * 17,
        preset.config,
        preset.startingHand,
        preset.removeStartingPieces,
      ),
    );
  }
  summarize(id, results);
}

const sweeps = [
  { goWinCaptures: 2, shogiWinStones: 5, turnLimit: 100 },
  { goWinCaptures: 2, shogiWinStones: 6, turnLimit: 100 },
  { goWinCaptures: 2, shogiWinStones: 7, turnLimit: 100 },
  { goWinCaptures: 2, shogiWinStones: 8, turnLimit: 100 },
  { goWinCaptures: 2, shogiWinStones: 9, turnLimit: 100 },
];

console.log("\nConfig sweep:");
for (const cfg of sweeps) {
  const results = [];
  for (let i = 0; i < GAMES; i += 1) {
    results.push(playOne(7000 + i * 13, cfg, undefined, undefined));
  }
  summarize(`g${cfg.goWinCaptures}/s${cfg.shogiWinStones}`, results);
}
