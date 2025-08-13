import { create } from "zustand";

import type { ColumnView } from "../sync/board";
import type { Op } from "../sync/ops";
import { HEARTBEAT_MS, identityFor, PresenceTracker } from "../sync/presence";
import type { Presence } from "../sync/protocol";
import { Replica } from "../sync/replica";
import { BroadcastChannelTransport, WebSocketTransport, type Transport, type TransportStatus } from "../sync/transport";
import { clientId, loadOps, rememberBoard, saveOps } from "./storage";

/** Set VITE_SYNC_URL (e.g. ws://localhost:8787) to sync between users; otherwise tabs sync locally. */
const SYNC_URL = import.meta.env.VITE_SYNC_URL as string | undefined;

type BoardStore = {
  boardId: string | null;
  columns: ColumnView[];
  title: string;
  peers: Presence[];
  status: TransportStatus;
  mode: Transport["kind"];
  me: { name: string; color: string };
  replica: Replica | null;
  open: (boardId: string) => Promise<() => void>;
};

const me = identityFor(clientId());

export const useBoard = create<BoardStore>((set, getState) => ({
  boardId: null,
  columns: [],
  title: "",
  peers: [],
  status: "connecting",
  mode: SYNC_URL ? "server" : "tabs",
  me,
  replica: null,

  /** Loads a board, connects it, and returns a cleanup function. */
  async open(boardId) {
    const transport: Transport = SYNC_URL
      ? new WebSocketTransport(SYNC_URL, boardId)
      : new BroadcastChannelTransport(boardId);
    const presence = new PresenceTracker();
    const self = clientId();

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void saveOps(boardId, replica.log), 250);
    };
    let rememberedTitle: string | undefined;
    const refresh = () => {
      const title = replica.title();
      set({ columns: replica.view(), title });
      persist();
      // Keep the home page's "recent boards" list showing the current name.
      if (title !== rememberedTitle) {
        rememberedTitle = title;
        void rememberBoard({ id: boardId, name: title, lastOpened: Date.now() });
      }
    };

    const replica = new Replica(self, (op: Op) => {
      transport.send([op]);
      refresh();
    });
    set({ boardId, replica, columns: [], title: "", peers: [], status: "connecting" });

    replica.receive(await loadOps(boardId));
    // Another board may have been opened while we were loading.
    if (getState().boardId !== boardId) return () => {};

    transport.start(
      {
        onOps: (ops) => {
          if (replica.receive(ops) > 0) refresh();
        },
        onPresence: (p) => {
          presence.update(p);
          set({ peers: presence.list(Date.now(), self) });
        },
        onStatus: (status) => set({ status }),
      },
      () => replica.log,
    );

    // Seed only after giving other tabs or the server a moment to share existing state.
    const seedTimer = setTimeout(() => {
      replica.seedIfEmpty();
      refresh();
    }, 400);
    refresh();

    const beat = () => {
      transport.announce({ client: self, ...me, at: Date.now() });
      set({ peers: presence.list(Date.now(), self) });
    };
    beat();
    const heartbeat = setInterval(beat, HEARTBEAT_MS);

    return () => {
      clearTimeout(seedTimer);
      clearInterval(heartbeat);
      clearTimeout(saveTimer);
      void saveOps(boardId, replica.log);
      transport.stop();
    };
  },
}));
