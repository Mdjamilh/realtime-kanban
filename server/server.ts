import { createServer, type Server } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { parseMessage, type Message } from "../src/sync/protocol.ts";
import { TokenBucket } from "./rate-limit.ts";
import { OpStore } from "./store.ts";

const BOARD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_OPS_PER_MESSAGE = 5_000;

/**
 * Relays ops between everyone viewing the same board and keeps the log so
 * late joiners catch up. The server never interprets ops; replicas converge
 * on their own.
 */
type Options = {
  store?: OpStore;
  /** Messages per connection: a burst allowance plus a steady refill rate. */
  rateLimit?: { burst: number; perSecond: number };
};

export function createSyncServer({ store = new OpStore(), rateLimit = { burst: 100, perSecond: 20 } }: Options = {}): Server {
  const rooms = new Map<string, Set<WebSocket>>();

  const http = createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server: http, maxPayload: 2 * 1024 * 1024 });

  const send = (socket: WebSocket, message: Message) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const broadcast = (board: string, from: WebSocket, message: Message) => {
    for (const peer of rooms.get(board) ?? []) if (peer !== from) send(peer, message);
  };

  wss.on("connection", (socket) => {
    let board: string | undefined;
    const limit = new TokenBucket(rateLimit.burst, rateLimit.perSecond);

    socket.on("message", (data) => {
      if (!limit.take()) return socket.close(1008, "Rate limit exceeded");
      const message = parseMessage(data.toString());
      if (!message || !BOARD_ID.test(message.board)) return;
      if ("ops" in message && message.ops.length > MAX_OPS_PER_MESSAGE) return socket.close(1009, "Too many ops");

      // A socket belongs to the first board it speaks about.
      if (!board) {
        board = message.board;
        if (!rooms.has(board)) rooms.set(board, new Set());
        rooms.get(board)!.add(socket);
      } else if (message.board !== board) {
        return;
      }

      if (message.type === "presence") return broadcast(board, socket, message);

      const fresh = store.append(board, message.ops);
      if (fresh.length > 0) broadcast(board, socket, { type: "ops", board, ops: fresh });
      // On hello, return the full log so the newcomer gets everything it's missing.
      if (message.type === "hello") send(socket, { type: "ops", board, ops: store.all(board) });
    });

    socket.on("close", () => {
      if (!board) return;
      const room = rooms.get(board);
      room?.delete(socket);
      if (room?.size === 0) rooms.delete(board);
    });
  });

  // http.close() waits for every connection to end, and upgraded WebSocket
  // connections never end on their own, so close them first. Clients see a
  // normal "going away" close and reconnect when the server is back.
  const closeHttp = http.close.bind(http);
  http.close = (callback) => {
    for (const client of wss.clients) client.close(1001, "Server shutting down");
    wss.close();
    setTimeout(() => {
      for (const client of wss.clients) client.terminate();
    }, 1000).unref();
    return closeHttp(callback);
  };
  return http;
}
