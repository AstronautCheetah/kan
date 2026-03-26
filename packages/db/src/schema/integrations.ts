import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { users } from "./users";

export const integrations = sqliteTable(
  "integration",
  {
    provider: text("provider").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$onUpdateFn(() => new Date()),
  },
  (table) => [
    primaryKey({
      name: "integration_pkey",
      columns: [table.userId, table.provider],
    }),
  ],
);

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
}));
