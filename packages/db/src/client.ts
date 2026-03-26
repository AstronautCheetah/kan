/// <reference types="@cloudflare/workers-types" />
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type dbClient = DrizzleD1Database<typeof schema>;

export const createDrizzleClient = (d1: D1Database): dbClient => {
  return drizzle(d1, { schema });
};
