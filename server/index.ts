import { mkdirSync } from "node:fs";
import path from "node:path";

import { createSyncServer } from "./server.ts";
import { OpStore } from "./store.ts";

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? ".data";

mkdirSync(DATA_DIR, { recursive: true });
const store = new OpStore(path.join(DATA_DIR, "boards.sqlite"));
const server = createSyncServer({ store });

server.listen(PORT, () => {
  console.log(`Sync server on ws://localhost:${PORT} (data in ${DATA_DIR}/boards.sqlite)`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
