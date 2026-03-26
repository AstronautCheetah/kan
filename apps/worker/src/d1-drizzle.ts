import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "@kan/db/schema";

/**
 * Create a Drizzle D1 client with transaction support patched out.
 *
 * ## D1 transaction limitation
 *
 * D1 rejects SQL-level BEGIN / COMMIT / SAVEPOINT statements at runtime.
 * Drizzle's built-in `db.transaction()` emits SQL BEGIN, which causes an
 * error on D1.
 *
 * This factory patches the session's `transaction` method so that
 * `db.transaction(cb)` simply calls `cb(db)` — no SQL transaction
 * wrappers are emitted.  The operations still execute sequentially but
 * **without ACID atomicity**: if the callback throws midway, earlier
 * writes are NOT rolled back.
 *
 * ## When to use `db.batch()` instead
 *
 * D1 exposes a native batch API (`d1.batch([...])`) which Drizzle wraps
 * as `db.batch([stmt1, stmt2, ...])`.  Batched statements are sent to D1
 * in a single round-trip and execute **atomically** — if any statement
 * fails the entire batch is rolled back.
 *
 * Use `db.batch()` when:
 *   - All statements are **independent** (no statement reads a value
 *     produced by a previous statement in the same batch).
 *   - You can build every statement up-front before executing.
 *
 * Keep `db.transaction()` (this patched version) when:
 *   - Statements are **dependent** — e.g. you SELECT the current max
 *     index, then INSERT with index + 1, then verify for duplicates.
 *   - Control flow inside the callback depends on intermediate query
 *     results (conditionals, loops over result sets, etc.).
 *
 * In the current codebase every `db.transaction()` call site contains
 * dependent operations (read-then-write patterns for index management),
 * so none can be converted to `db.batch()`.  Each site is annotated with
 * a comment explaining the dependency.
 */
export function createD1Drizzle(d1: D1Database): DrizzleD1Database<typeof schema> {
  const db = drizzle(d1, { schema });

  // Patch the session's transaction method directly so that
  // db.transaction(cb) → cb(db) with no SQL BEGIN/COMMIT.
  const session = (db as unknown as { session: Record<string, unknown> }).session;
  session.transaction = async (
    callback: (tx: unknown) => Promise<unknown>,
  ) => {
    // Pass the db itself as the "transaction" — all operations run
    // directly on the connection.  D1 is single-writer so this is safe
    // from concurrency issues, but partial writes are possible on error.
    return callback(db);
  };

  return db;
}
