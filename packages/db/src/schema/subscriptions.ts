import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { workspaces } from "./workspaces";

export const subscription = sqliteTable("subscription", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plan: text("plan").notNull(),
  referenceId: text("referenceId").references(
    () => workspaces.publicId,
    { onDelete: "set null" },
  ),
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  status: text("status").notNull(),
  periodStart: integer("periodStart", { mode: "timestamp" }),
  periodEnd: integer("periodEnd", { mode: "timestamp" }),
  cancelAtPeriodEnd: integer("cancelAtPeriodEnd", { mode: "boolean" }),
  seats: integer("seats"),
  unlimitedSeats: integer("unlimitedSeats", { mode: "boolean" }).default(false).notNull(),
  trialStart: integer("trialStart", { mode: "timestamp" }),
  trialEnd: integer("trialEnd", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const subscriptionsRelations = relations(subscription, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [subscription.referenceId],
    references: [workspaces.publicId],
  }),
}));
