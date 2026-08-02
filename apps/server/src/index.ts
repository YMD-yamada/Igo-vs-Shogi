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

const broadcastState = (room: Room, lastMessage?: string): void => {
  for (const side of ["go", "shogi"] as Side[]) {
    const seat = room.seats[side];
    if (seat) send(seat, { type: "state", state: room.state, lastMessage });
  }
};

const findRoomBySocket = (ws: WebSocket): { room: Room; side: Side } | null => {
  for (const room of rooms.values()) {
    for (const side of ["go", "shogi"] as Side[]) {
      if (room.seats[side] === ws) return { room, side };
    }
  }
  return null;
};

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
      const room: Room = { id, state, seats: { go: ws } };
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
      broadcastState(room, "対戦開始！");
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

      // Seat must match active side for move actions
      const moveTypes = new Set([
        "go_place",
        "go_pass",
        "go_release",
        "shogi_select",
        "shogi_select_hand",
        "shogi_move",
        "shogi_drop",
        "shogi_release",
        "clear_selection",
        "resign",
      ]);
      if (moveTypes.has(cmd.action.type)) {
        if (cmd.action.type === "resign") {
          // ok
        } else if (cmd.action.type === "dismiss_curtain") {
          // ignore online
        } else {
          const needsGo = cmd.action.type.startsWith("go_");
          const needsShogi = cmd.action.type.startsWith("shogi_") || cmd.action.type === "clear_selection";
          if (needsGo && side !== "go") {
            send(ws, { type: "error", message: "囲碁側ではありません" });
            return;
          }
          if (needsShogi && side !== "shogi") {
            send(ws, { type: "error", message: "将棋側ではありません" });
            return;
          }
        }
      }

      // Online has no pass curtain
      let working = { ...room.state, passCurtain: false, mode: "online" as const };
      const result = applyAction(working, cmd.action);
      if (!result.ok) {
        send(ws, { type: "error", message: result.message });
        return;
      }
      room.state = { ...result.state, passCurtain: false, mode: "online" };
      broadcastState(room, result.message);
    }
  });

  ws.on("close", () => {
    const found = findRoomBySocket(ws);
    if (!found) return;
    const { room, side } = found;
    delete room.seats[side];
    const other: Side = side === "go" ? "shogi" : "go";
    const peer = room.seats[other];
    if (peer) send(peer, { type: "peer_left" });
    if (!room.seats.go && !room.seats.shogi) {
      rooms.delete(room.id);
    }
  });
});

console.log(`[kuroshiro] online server on ws://0.0.0.0:${PORT}`);
