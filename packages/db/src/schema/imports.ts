import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { labels } from "./labels";
import { lists } from "./lists";
import { users } from "./users";

export const importSources = ["trello", "github"] as const;
export type ImportSource = (typeof importSources)[number];

export const importStatuses = ["started", "success", "failed"] as const;
export type ImportStatus = (typeof importStatuses)[number];

export const imports = sqliteTable("import", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: text("publicId").notNull().unique(),
  source: text("source", { enum: importSources }).notNull(),
  status: text("status", { enum: importStatuses }).notNull(),
  createdBy: text("createdBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const importsRelations = relations(imports, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [imports.createdBy],
    references: [users.id],
    relationName: "importsCreatedByUser",
  }),
  boards: many(boards),
  cards: many(cards),
  lists: many(lists),
  labels: many(labels),
}));
