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
  if (env?.trim()) return env.trim();
  // Local dev only: same-host WS. Production / native require VITE_WS_URL.
  if (import.meta.env.DEV) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.hostname}:9877`;
  }
  return "";
};

/** Online rooms need an explicit WS endpoint outside local dev. */
export const isOnlineAvailable = (): boolean => Boolean(defaultUrl());

export class OnlineClient {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url = defaultUrl()) {
    this.url = url;
  }

  connect(onMessage: (msg: OnlineMessage) => void, onClose?: () => void): Promise<void> {
    if (!this.url) {
      return Promise.reject(new Error("オンラインサーバー未設定です"));
    }
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
