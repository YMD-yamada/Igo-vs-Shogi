/**
 * Aggregate lightweight match logs for balance / feedback cycles.
 *
 * Reads:
 *   - data/match-logs/*.jsonl  (server + uploaded)
 *   - optional paths as CLI args
 *
 * Usage:
 *   npx tsx scripts/analyze-logs.mjs
 *   npx tsx scripts/analyze-logs.mjs path/to/export.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultDir = path.join(root, "data", "match-logs");

const loadJsonl = (file) => {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
};

const collect = (inputs) => {
  const logs = [];
  for (const input of inputs) {
    const p = path.resolve(input);
    if (!fs.existsSync(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) {
        if (name.endsWith(".jsonl")) logs.push(...loadJsonl(path.join(p, name)));
      }
    } else if (p.endsWith(".jsonl") || p.endsWith(".json")) {
      if (p.endsWith(".jsonl")) logs.push(...loadJsonl(p));
      else {
        const raw = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Array.isArray(raw)) logs.push(...raw);
        else logs.push(raw);
      }
    }
  }
  return logs;
};

const args = process.argv.slice(2);
const inputs = args.length > 0 ? args : [defaultDir];
const logs = collect(inputs);

if (logs.length === 0) {
  console.log(`No match logs found in: ${inputs.join(", ")}`);
  console.log("Play CPU/online games, or drop exported .jsonl into data/match-logs/");
  process.exit(0);
}

const byMode = {};
const byWinner = {};
const byHandicap = {};
const byConfig = {};
let turnSum = 0;
let goCap = 0;
let shogiCap = 0;
let durationSum = 0;
let durationN = 0;

for (const l of logs) {
  byMode[l.mode] = (byMode[l.mode] ?? 0) + 1;
  byWinner[String(l.winner)] = (byWinner[String(l.winner)] ?? 0) + 1;
  const h = l.handicapId ?? "unknown";
  byHandicap[h] = (byHandicap[h] ?? 0) + 1;
  const cfg = `g${l.config?.goWinCaptures}/s${l.config?.shogiWinStones}`;
  byConfig[cfg] = (byConfig[cfg] ?? 0) + 1;
  turnSum += l.turns ?? 0;
  goCap += l.goCaptures ?? 0;
  shogiCap += l.shogiStoneCaptures ?? 0;
  if (l.endedAt && l.startedAt) {
    durationSum += l.endedAt - l.startedAt;
    durationN += 1;
  }
}

const n = logs.length;
const pct = (c) => `${((100 * c) / n).toFixed(1)}%`;

console.log(`Matches: ${n}`);
console.log("By mode:", byMode);
console.log("By winner:", Object.fromEntries(
  Object.entries(byWinner).map(([k, v]) => [k, `${v} (${pct(v)})`]),
));
console.log("By handicap:", byHandicap);
console.log("By config:", byConfig);
console.log(
  `Averages: turns=${(turnSum / n).toFixed(1)} goCap=${(goCap / n).toFixed(2)} shogiCap=${(shogiCap / n).toFixed(2)}` +
    (durationN
      ? ` durationSec=${(durationSum / durationN / 1000).toFixed(1)}`
      : ""),
);

// CPU human-side split
const cpu = logs.filter((l) => l.mode === "cpu");
if (cpu.length) {
  const humanGo = cpu.filter((l) => l.humanSide === "go");
  const humanShogi = cpu.filter((l) => l.humanSide === "shogi");
  const winRate = (arr, side) => {
    if (!arr.length) return "n/a";
    const w = arr.filter((l) => l.winner === side).length;
    return `${((100 * w) / arr.length).toFixed(1)}% (n=${arr.length})`;
  };
  console.log("\nCPU mode:");
  console.log(`  human=go wins: ${winRate(humanGo, "go")}`);
  console.log(`  human=shogi wins: ${winRate(humanShogi, "shogi")}`);
}

const online = logs.filter((l) => l.mode === "online");
if (online.length) {
  console.log("\nOnline:");
  console.log(
    `  go ${pct(online.filter((l) => l.winner === "go").length)} / shogi ${pct(
      online.filter((l) => l.winner === "shogi").length,
    )} / draw ${pct(online.filter((l) => l.winner === "draw").length)} (n=${online.length})`,
  );
}

console.log(
  "\nFeedback tip: paste insights or say「フィードバック適用」with new logs under data/match-logs/",
);
