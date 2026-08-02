import WebSocket from "ws";

function once(ws) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), 5000);
    ws.once("message", (d) => {
      clearTimeout(t);
      resolve(JSON.parse(String(d)));
    });
  });
}

function open() {
  const ws = new WebSocket("ws://127.0.0.1:8787");
  return new Promise((resolve, reject) => {
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

const a = await open();
a.send(JSON.stringify({ type: "create" }));
const created = await once(a);
console.log("created", created.type, created.roomId, created.side);

const b = await open();
b.send(JSON.stringify({ type: "join", roomId: created.roomId }));
const joined = await once(b);
console.log("joined", joined.type, joined.side);

// drain start broadcast on a
const start = await once(a);
console.log("start", start.type, start.lastMessage);

a.send(
  JSON.stringify({
    type: "action",
    action: { type: "go_place", at: { row: 4, col: 4 } },
  }),
);
const afterA = await once(a);
const afterB = await once(b);
console.log(
  "move",
  afterA.state?.activeSide,
  afterA.state?.goBoard?.[4]?.[4],
  afterB.state?.activeSide,
);

// Forged payload claims go resigned; server must bind to shogi seat → go wins
b.send(JSON.stringify({ type: "action", action: { type: "resign", side: "go" } }));
const forged = await once(b);
console.log(
  "resign-from-shogi-seat winner",
  forged.state?.winner,
  "expected go (seat-bound)",
);

if (forged.state?.winner !== "go") {
  console.error("FAIL: resign seat binding broken");
  process.exit(1);
}
if (afterA.state?.goBoard?.[4]?.[4] !== "black") {
  console.error("FAIL: stone not placed");
  process.exit(1);
}

a.close();
b.close();
console.log("ONLINE_SMOKE_OK");
process.exit(0);
