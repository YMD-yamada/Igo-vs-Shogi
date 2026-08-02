import { WebSocketServer, WebSocket } from "ws";
import {
  applyAction,
  createInitialState,
  type Action,
  type GameState,
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
}

const PORT = Number(process.env.PORT ?? 8787);
const rooms = new Map<string, Room>();
const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, "時間切れ — 囲碁パス");
    } else {
      const result = applyAction(next, { type: "resign", side: "shogi" });
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, "時間切れ — 将棋の負け");
    }
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

const wss = new WebSocketServer({ port: PORT });

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
      const room: Room = { id, state, seats: { go: ws }, turnDeadline: null };
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

      const working = { ...room.state, passCurtain: false, mode: "online" as const };
      const result = applyAction(working, action);
      if (!result.ok) {
        send(ws, { type: "error", message: result.message });
        return;
      }
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, result.message);
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

console.log(`[kuroshiro] online server on ws://0.0.0.0:${PORT}`);
