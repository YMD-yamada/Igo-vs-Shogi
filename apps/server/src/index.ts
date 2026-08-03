import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import {
  applyAction,
  createInitialState,
  createMatchRecorder,
  encodeAction,
  finalizeMatchLog,
  recordEncodedPly,
  type Action,
  type GameState,
  type MatchLogV1,
  type MatchRecorder,
  type Side,
} from "@kuroshiro/engine";

interface ClientCommand {
  type: "create" | "join" | "action" | "ping";
  roomId?: string;
  name?: string;
  action?: Action;
}

interface Room {
  id: string;
  state: GameState;
  seats: Partial<Record<Side, WebSocket>>;
  turnDeadline: ReturnType<typeof setTimeout> | null;
  recorder: MatchRecorder;
  lastSelectedFrom: Partial<Record<Side, { row: number; col: number }>>;
  lastHandKind: Partial<Record<Side, string>>;
}

const PORT = Number(process.env.PORT ?? 9877);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR =
  process.env.MATCH_LOG_DIR ??
  path.resolve(__dirname, "../../../data/match-logs");

const rooms = new Map<string, Room>();
const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

fs.mkdirSync(LOG_DIR, { recursive: true });

const makeRoomId = (): string => {
  let id = "";
  for (let i = 0; i < 6; i += 1) {
    id += codeChars[Math.floor(Math.random() * codeChars.length)];
  }
  return rooms.has(id) ? makeRoomId() : id;
};

const send = (ws: WebSocket, payload: unknown): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
};

const broadcast = (room: Room, payload: unknown): void => {
  for (const side of ["go", "shogi"] as Side[]) {
    const seat = room.seats[side];
    if (seat) send(seat, payload);
  }
};

const broadcastState = (room: Room, lastMessage?: string): void => {
  broadcast(room, { type: "state", state: room.state, lastMessage });
};

const appendLogFile = (log: MatchLogV1): void => {
  const day = new Date(log.endedAt).toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${day}.jsonl`);
  fs.appendFileSync(file, `${JSON.stringify(log)}\n`, "utf8");
};

const persistRoomIfEnded = (room: Room): void => {
  if (!room.state.winner) return;
  const log = finalizeMatchLog(room.recorder, room.state);
  if (!log) return;
  try {
    appendLogFile({ ...log, roomId: room.id, tags: ["online", "server"] });
  } catch (err) {
    console.error("[kuroshiro] failed to write match log", err);
  }
};

const clearDeadline = (room: Room): void => {
  if (room.turnDeadline) {
    clearTimeout(room.turnDeadline);
    room.turnDeadline = null;
  }
};

const armDeadline = (room: Room): void => {
  clearDeadline(room);
  if (room.state.winner) return;
  if (!room.seats.go || !room.seats.shogi) return;

  const ms = room.state.config.onlineMoveMs;
  room.turnDeadline = setTimeout(() => {
    if (room.state.winner) return;
    const side = room.state.activeSide;
    let next = { ...room.state, passCurtain: false, mode: "online" as const };
    if (side === "go") {
      const result = applyAction(next, { type: "go_pass" });
      const code = encodeAction({ type: "go_pass" });
      if (code) recordEncodedPly(room.recorder, code, result.state, side);
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, "時間切れ — 囲碁パス");
    } else {
      const result = applyAction(next, { type: "resign", side: "shogi" });
      const code = encodeAction({ type: "resign", side: "shogi" });
      if (code) recordEncodedPly(room.recorder, code, result.state, side);
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, "時間切れ — 将棋の負け");
    }
    persistRoomIfEnded(room);
    armDeadline(room);
  }, ms);
};

const findRoomBySocket = (ws: WebSocket): { room: Room; side: Side } | null => {
  for (const room of rooms.values()) {
    for (const side of ["go", "shogi"] as Side[]) {
      if (room.seats[side] === ws) return { room, side };
    }
  }
  return null;
};

const bothSeated = (room: Room): boolean => !!room.seats.go && !!room.seats.shogi;

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const cors = (res: http.ServerResponse): void => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
};

const summarizeLogs = (): {
  files: number;
  matches: number;
  byMode: Record<string, number>;
  byWinner: Record<string, number>;
} => {
  const byMode: Record<string, number> = {};
  const byWinner: Record<string, number> = {};
  let matches = 0;
  let files = 0;
  if (!fs.existsSync(LOG_DIR)) {
    return { files: 0, matches: 0, byMode, byWinner };
  }
  for (const name of fs.readdirSync(LOG_DIR)) {
    if (!name.endsWith(".jsonl")) continue;
    files += 1;
    const text = fs.readFileSync(path.join(LOG_DIR, name), "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const log = JSON.parse(line) as MatchLogV1;
        matches += 1;
        byMode[log.mode] = (byMode[log.mode] ?? 0) + 1;
        const w = String(log.winner);
        byWinner[w] = (byWinner[w] ?? 0) + 1;
      } catch {
        // skip bad line
      }
    }
  }
  return { files, matches, byMode, byWinner };
};

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/match-logs/summary") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(summarizeLogs()));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/match-logs") {
    try {
      const body = await readBody(req);
      const log = JSON.parse(body) as MatchLogV1;
      if (!log || log.v !== 1 || !log.id || !log.winner) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid log" }));
        return;
      }
      appendLogFile({
        ...log,
        tags: [...(log.tags ?? []), "client-upload"],
      });
      res.writeHead(204);
      res.end();
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "bad request" }));
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let cmd: ClientCommand;
    try {
      cmd = JSON.parse(String(raw)) as ClientCommand;
    } catch {
      send(ws, { type: "error", message: "不正なメッセージです" });
      return;
    }

    if (cmd.type === "ping") {
      send(ws, { type: "state", state: findRoomBySocket(ws)?.room.state });
      return;
    }

    if (cmd.type === "create") {
      const id = makeRoomId();
      const state = createInitialState("online", { seed: Date.now() >>> 0 });
      const recorder = createMatchRecorder({
        state,
        handicapId: "even",
        roomId: id,
        tags: ["online"],
      });
      const room: Room = {
        id,
        state,
        seats: { go: ws },
        turnDeadline: null,
        recorder,
        lastSelectedFrom: {},
        lastHandKind: {},
      };
      rooms.set(id, room);
      send(ws, { type: "created", roomId: id, side: "go", state });
      return;
    }

    if (cmd.type === "join") {
      const id = (cmd.roomId ?? "").toUpperCase();
      const room = rooms.get(id);
      if (!room) {
        send(ws, { type: "error", message: "ルームが見つかりません" });
        return;
      }
      if (room.seats.shogi) {
        send(ws, { type: "error", message: "ルームは満員です" });
        return;
      }
      room.seats.shogi = ws;
      send(ws, { type: "joined", roomId: id, side: "shogi", state: room.state });
      broadcastState(room, "対戦開始！（一手30秒）");
      armDeadline(room);
      return;
    }

    if (cmd.type === "action") {
      const found = findRoomBySocket(ws);
      if (!found || !cmd.action) {
        send(ws, { type: "error", message: "ルームに参加していません" });
        return;
      }
      const { room, side } = found;
      if (room.state.winner) {
        send(ws, { type: "error", message: "対局は終了しています" });
        return;
      }
      if (!bothSeated(room)) {
        send(ws, { type: "error", message: "相手の参加を待っています" });
        return;
      }

      let action = cmd.action;

      if (action.type === "resign") {
        action = { type: "resign", side };
      } else if (action.type === "dismiss_curtain") {
        send(ws, { type: "error", message: "オンラインでは不要です" });
        return;
      } else if (action.type.startsWith("go_") && side !== "go") {
        send(ws, { type: "error", message: "囲碁側ではありません" });
        return;
      } else if (
        (action.type.startsWith("shogi_") || action.type === "clear_selection") &&
        side !== "shogi"
      ) {
        send(ws, { type: "error", message: "将棋側ではありません" });
        return;
      }

      if (action.type === "shogi_select") {
        room.lastSelectedFrom[side] = action.at;
      }
      if (action.type === "shogi_select_hand") {
        room.lastHandKind[side] = action.kind;
      }

      const working = { ...room.state, passCurtain: false, mode: "online" as const };
      const result = applyAction(working, action);
      if (!result.ok) {
        send(ws, { type: "error", message: result.message });
        return;
      }

      const code = encodeAction(action, {
        from: room.lastSelectedFrom[side],
        handKind: room.lastHandKind[side],
      });
      if (code) recordEncodedPly(room.recorder, code, result.state, side);

      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, result.message);
      persistRoomIfEnded(room);
      armDeadline(room);
    }
  });

  ws.on("close", () => {
    const found = findRoomBySocket(ws);
    if (!found) return;
    const { room, side } = found;
    const other: Side = side === "go" ? "shogi" : "go";
    const peer = room.seats[other];
    delete room.seats[side];
    clearDeadline(room);

    if (peer && !room.state.winner) {
      room.state = {
        ...room.state,
        winner: other,
        log: [
          `相手切断 — ${other === "go" ? "囲碁" : "将棋"}側の勝利`,
          ...room.state.log,
        ],
      };
      recordEncodedPly(room.recorder, `R:${side[0]}`, room.state, side);
      persistRoomIfEnded(room);
      send(peer, {
        type: "state",
        state: room.state,
        lastMessage: "相手が切断したため勝利",
      });
      send(peer, { type: "peer_left" });
    }

    if (!room.seats.go && !room.seats.shogi) {
      rooms.delete(room.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[kuroshiro] online server http+ws://0.0.0.0:${PORT}`);
  console.log(`[kuroshiro] match logs → ${LOG_DIR}`);
});
