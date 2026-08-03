import type { MatchLogV1 } from "@kuroshiro/engine";

const STORAGE_KEY = "kuroshiro.matchLogs.v1";
const MAX_LOGS = 250;

export const loadMatchLogs = (): MatchLogV1[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MatchLogV1[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveMatchLog = (log: MatchLogV1): void => {
  const prev = loadMatchLogs().filter((x) => x.id !== log.id);
  const next = [log, ...prev].slice(0, MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const matchLogsToJsonl = (logs: MatchLogV1[] = loadMatchLogs()): string =>
  logs.map((l) => JSON.stringify(l)).join("\n") + (logs.length ? "\n" : "");

export const downloadMatchLogs = (): void => {
  const blob = new Blob([matchLogsToJsonl()], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kuroshiro-match-logs-${new Date().toISOString().slice(0, 10)}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
};

export const summarizeLocalLogs = (): {
  total: number;
  byMode: Record<string, number>;
  byWinner: Record<string, number>;
} => {
  const logs = loadMatchLogs();
  const byMode: Record<string, number> = {};
  const byWinner: Record<string, number> = {};
  for (const l of logs) {
    byMode[l.mode] = (byMode[l.mode] ?? 0) + 1;
    const w = String(l.winner);
    byWinner[w] = (byWinner[w] ?? 0) + 1;
  }
  return { total: logs.length, byMode, byWinner };
};

/** Best-effort POST to online server (ignored if offline). */
export const tryUploadMatchLog = async (log: MatchLogV1): Promise<void> => {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  let httpBase: string;
  if (env) {
    httpBase = env.replace(/^ws/, "http");
  } else {
    const proto = location.protocol === "https:" ? "https" : "http";
    httpBase = `${proto}://${location.hostname}:9877`;
  }
  try {
    await fetch(`${httpBase}/api/match-logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(log),
    });
  } catch {
    // local-only is fine
  }
};
