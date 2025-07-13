import { DatabaseSync } from "node:sqlite";

import { isOp, type Op } from "../src/sync/ops.ts";

/**
 * Append-only op log per board in SQLite (Node's built-in driver). The op id
 * is the primary key, so re-sent ops are ignored and only new ones are
 * reported back for broadcasting.
 */
export class OpStore {
  private readonly db: DatabaseSync;
  private readonly insert;
  private readonly select;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ops (
        board    TEXT NOT NULL,
        id       TEXT NOT NULL,
        body     TEXT NOT NULL,
        received INTEGER NOT NULL,
        PRIMARY KEY (board, id)
      );
    `);
    this.insert = this.db.prepare("INSERT OR IGNORE INTO ops (board, id, body, received) VALUES (?, ?, ?, ?)");
    this.select = this.db.prepare("SELECT body FROM ops WHERE board = ? ORDER BY received, rowid");
  }

  /** Stores ops and returns the ones that weren't already stored. */
  append(board: string, ops: Op[]): Op[] {
    const fresh: Op[] = [];
    const now = Date.now();
    this.db.exec("BEGIN");
    try {
      for (const op of ops) {
        if (this.insert.run(board, op.id, JSON.stringify(op), now).changes > 0) fresh.push(op);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return fresh;
  }

  all(board: string): Op[] {
    return this.select
      .all(board)
      .map((row) => JSON.parse(String((row as { body: string }).body)))
      .filter(isOp);
  }

  close() {
    this.db.close();
  }
}
