import type { Action, GameState, Side } from "@kuroshiro/engine";

export type OnlineMessage =
  | { type: "created"; roomId: string; side: Side; state: GameState }
  | { type: "joined"; roomId: string; side: Side; state: GameState }
  | { type: "state"; state: GameState; lastMessage?: string }
  | { type: "error"; message: string }
  | { type: "peer_left" };

export type ClientCommand =
  | { type: "create"; name?: string }
  | { type: "join"; roomId: string; name?: string }
  | { type: "action"; action: Action }
  | { type: "ping" };

const defaultUrl = () => {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = location.hostname;
  return `${proto}://${host}:8787`;
};

export class OnlineClient {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url = defaultUrl()) {
    this.url = url;
  }

  connect(onMessage: (msg: OnlineMessage) => void, onClose?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("接続に失敗しました"));
      ws.onclose = () => onClose?.();
      ws.onmessage = (ev) => {
        try {
          onMessage(JSON.parse(String(ev.data)) as OnlineMessage);
        } catch {
          // ignore
        }
      };
    });
  }

  send(cmd: ClientCommand): void {
    this.ws?.send(JSON.stringify(cmd));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
