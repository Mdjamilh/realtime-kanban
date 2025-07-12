import type { Op } from "./ops";
import { parseMessage, type Message, type Presence } from "./protocol";

export type TransportStatus = "connecting" | "online" | "offline";

export type TransportHandlers = {
  onOps: (ops: Op[]) => void;
  onPresence: (presence: Presence) => void;
  onStatus: (status: TransportStatus) => void;
};

/** How a replica talks to other replicas. `getLog` returns everything it has, for catch-up. */
export interface Transport {
  readonly kind: "tabs" | "server";
  start(handlers: TransportHandlers, getLog: () => Op[]): void;
  send(ops: Op[]): void;
  announce(presence: Presence): void;
  stop(): void;
}

/**
 * Syncs tabs of the same browser with no server. A new tab says hello with
 * its log; existing tabs answer with theirs, so everyone catches up.
 */
export class BroadcastChannelTransport implements Transport {
  readonly kind = "tabs";
  private channel?: BroadcastChannel;
  private readonly board: string;

  constructor(board: string) {
    this.board = board;
  }

  start(handlers: TransportHandlers, getLog: () => Op[]) {
    this.channel = new BroadcastChannel(`kanban:${this.board}`);
    this.channel.onmessage = (event) => {
      const message = parseMessage(event.data);
      if (!message || message.board !== this.board) return;
      if (message.type === "presence") return handlers.onPresence(message.presence);
      handlers.onOps(message.ops);
      if (message.type === "hello") this.post({ type: "ops", board: this.board, ops: getLog() });
    };
    this.post({ type: "hello", board: this.board, ops: getLog() });
    handlers.onStatus("online");
  }

  private post(message: Message) {
    this.channel?.postMessage(message);
  }

  send(ops: Op[]) {
    this.post({ type: "ops", board: this.board, ops });
  }

  announce(presence: Presence) {
    this.post({ type: "presence", board: this.board, presence });
  }

  stop() {
    this.channel?.close();
    this.channel = undefined;
  }
}

/**
 * Syncs with other users through the WebSocket server. Reconnects with
 * exponential backoff and replays the whole log on every (re)connect, so
 * edits made while offline are delivered once the connection returns.
 */
export class WebSocketTransport implements Transport {
  readonly kind = "server";
  private socket?: WebSocket;
  private stopped = false;
  private attempt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private handlers?: TransportHandlers;
  private getLog: () => Op[] = () => [];
  private readonly url: string;
  private readonly board: string;

  constructor(url: string, board: string) {
    this.url = url;
    this.board = board;
  }

  start(handlers: TransportHandlers, getLog: () => Op[]) {
    this.handlers = handlers;
    this.getLog = getLog;
    this.stopped = false;
    this.connect();
  }

  private connect() {
    this.handlers?.onStatus("connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.handlers?.onStatus("online");
      this.post({ type: "hello", board: this.board, ops: this.getLog() });
    };
    socket.onmessage = (event) => {
      const message = parseMessage(event.data);
      if (!message || message.board !== this.board) return;
      if (message.type === "presence") this.handlers?.onPresence(message.presence);
      else this.handlers?.onOps(message.ops);
    };
    socket.onclose = () => {
      if (this.stopped) return;
      this.handlers?.onStatus("offline");
      const delay = Math.min(30_000, 500 * 2 ** this.attempt++);
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  private post(message: Message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  send(ops: Op[]) {
    this.post({ type: "ops", board: this.board, ops });
  }

  announce(presence: Presence) {
    this.post({ type: "presence", board: this.board, presence });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.socket?.close();
  }
}
